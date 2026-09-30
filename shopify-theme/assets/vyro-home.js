/*
  VYRO Athletics: home page choreography
  GSAP + ScrollTrigger for motion, Lenis (set up in vyro-theme.js) for
  momentum scrolling, Three.js (vyro-gl.js) for the hero sequence and the
  product card hover distortion.
*/
(function () {
  'use strict';

  const V = window.Vyro;
  const T = window.VyroTheme || {};
  const doc = document.documentElement;
  const $ = V.$, $$ = V.$$;
  const reduced = V.reduced;
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const G = window.VyroGarments;
  const designMode = !!T.designMode;

  let mm = null;
  let hover = null;
  let hero = null;
  let heroCanvasEl = null;
  let heroTimer = null;

  /* ------------------------------------------------------------------ *
   * Helpers
   * ------------------------------------------------------------------ */
  function splitWords(el) {
    const text = el.getAttribute('aria-label') || el.textContent.trim();
    const words = text.split(/\s+/);
    el.setAttribute('aria-label', text);
    el.innerHTML = words.map(function (w) { return '<span class="w" aria-hidden="true">' + V.esc(w) + '</span>'; }).join(' ');
    return $$('.w', el);
  }

  function splitChars(el) {
    const text = el.getAttribute('aria-label') || el.textContent;
    el.setAttribute('aria-label', text.trim());
    el.innerHTML = text.split(/(\s+)/).map(function (part) {
      if (/^\s+$/.test(part)) return ' ';
      return '<span style="display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:0.06em" aria-hidden="true">' +
        part.split('').map(function (c) { return '<span class="ch">' + V.esc(c) + '</span>'; }).join('') + '</span>';
    }).join('');
    return $$('.ch', el);
  }

  function hexToRgba(hex, a) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex || '');
    if (!m) return 'rgba(197, 208, 216, ' + a + ')';
    return 'rgba(' + parseInt(m[1], 16) + ', ' + parseInt(m[2], 16) + ', ' + parseInt(m[3], 16) + ', ' + a + ')';
  }
  // Dark glows need more opacity to read on the black stage
  function glowFor(hex) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex || '');
    if (!m) return hexToRgba(hex, 0.12);
    const lum = (0.2126 * parseInt(m[1], 16) + 0.7152 * parseInt(m[2], 16) + 0.0722 * parseInt(m[3], 16)) / 255;
    return hexToRgba(hex, lum < 0.45 ? 0.26 : lum > 0.8 ? 0.1 : 0.16);
  }

  function brushPoly(p, seed) {
    const pts = [];
    const N = 16;
    for (let i = 0; i <= N; i++) {
      const y = (i / N) * 100;
      const j = Math.sin(i * 2.3 + seed) * 4 + Math.sin(i * 5.7 + seed * 2) * 2.2;
      pts.push((p * 132 - 16 + j).toFixed(2) + '% ' + y.toFixed(2) + '%');
    }
    return 'polygon(0% 0%, ' + pts.join(', ') + ', 0% 100%)';
  }

  function brushWipe(el, duration, seed) {
    if (!el) return gsap.to({}, { duration: 0.01 });
    const o = { p: 0 };
    el.style.clipPath = brushPoly(0, seed);
    return gsap.to(o, {
      p: 1, duration: duration, ease: 'power3.inOut',
      onUpdate: function () { el.style.clipPath = brushPoly(o.p, seed); },
      onComplete: function () { el.style.clipPath = 'none'; }
    });
  }

  // Same edge feather as the CSS mask on .pimg
  function feather(x, w, h) {
    x.globalCompositeOperation = 'destination-in';
    let g = x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.07, '#000'); g.addColorStop(0.93, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.06, '#000'); g.addColorStop(0.94, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'source-over';
  }

  // Redraws exactly what the card shows (stage + contained, feathered photos)
  // so the WebGL hover layer can take over seamlessly
  function drawCard(card, w, h) {
    const media = $('.pcard__media', card);
    const mr = media.getBoundingClientRect();
    const k = w / mr.width;
    const imgs = $$('.pimg:not(.is-out)', media);
    return Promise.all(imgs.map(V.whenLoaded)).then(function (loaded) {
      const c = document.createElement('canvas');
      c.width = Math.round(w); c.height = Math.round(h);
      const x = c.getContext('2d');
      x.save();
      x.translate(w * 0.5, h * 0.35);
      x.scale(w * 1.2, h * 0.9);
      const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, '#272728'); g.addColorStop(0.6, '#1D1D1E'); g.addColorStop(1, '#171718');
      x.fillStyle = g;
      x.fillRect(-2, -2, 4, 4);
      x.restore();
      loaded.forEach(function (img) {
        if (!img) return;
        const r = img.getBoundingClientRect();
        const bw = Math.round(r.width * k), bh = Math.round(r.height * k);
        if (!bw || !bh) return;
        const t = document.createElement('canvas');
        t.width = bw; t.height = bh;
        const tx = t.getContext('2d');
        const sc = Math.min(bw / img.naturalWidth, bh / img.naturalHeight);
        const dw = img.naturalWidth * sc, dh = img.naturalHeight * sc;
        try {
          tx.drawImage(img, (bw - dw) / 2, (bh - dh) / 2, dw, dh);
        } catch (e) { return; }
        feather(tx, bw, bh);
        x.drawImage(t, (r.left - mr.left) * k, (r.top - mr.top) * k);
      });
      return c;
    });
  }

  function scrollToY(y, duration) {
    if (V.lenis) V.lenis.scrollTo(y, { duration: duration || 1.4 });
    else window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
  }

  /* ------------------------------------------------------------------ *
   * Static content (runs even without GSAP)
   * ------------------------------------------------------------------ */
  function initStatic(root) {
    if (G) $$('[data-garment]', root).forEach(G.render);
    V.wrapPimgs(root);
    // Every <img data-photo> is optional. Missing files fall back to the stand-in.
    $$('img[data-photo]', root).forEach(function (img) {
      if (img.hasAttribute('data-hero-slide')) return;
      function ok() { img.classList.add('is-loaded'); img.parentElement.classList.add('has-photo'); }
      function fail() { img.remove(); }
      if (img.complete) { img.naturalWidth ? ok() : fail(); }
      else { img.addEventListener('load', ok, { once: true }); img.addEventListener('error', fail, { once: true }); }
    });
  }

  /* ------------------------------------------------------------------ *
   * Hero
   * ------------------------------------------------------------------ */
  function initHero() {
    const heroEl = $('[data-hero]');
    if (!heroEl) return null;
    const canvas = $('[data-hero-gl]', heroEl);
    const slides = $$('[data-hero-slide]', heroEl);
    const ticks = $$('.hero__tick i', heroEl);
    const note = $('[data-hero-note]', heroEl);
    if (note) note.hidden = true;

    function setTicks(i, hold) {
      ticks.forEach(function (t, k) {
        gsap.killTweensOf(t);
        gsap.set(t, { scaleX: k < i ? 1 : 0 });
      });
      if (!reduced && ticks[i]) gsap.to(ticks[i], { scaleX: 1, duration: hold + 2.2, ease: 'none' });
    }

    // Wide screens get three portrait shots per slide; phones get one
    let srcs = slides.map(function (i) { return i.getAttribute('src'); });
    try {
      const wide = JSON.parse((canvas && canvas.dataset.slidesWide) || 'null');
      if (wide && window.matchMedia('(min-width: 900px)').matches) srcs = wide;
    } catch (e) { /* keep single-photo slides */ }

    if (canvas && canvas !== heroCanvasEl && T.webgl !== false && window.VyroGL && window.VyroGL.supported()) {
      heroCanvasEl = canvas;
      hero = window.VyroGL.initHero(canvas, srcs, {
        reduced: reduced,
        onChange: function (i, hold) { setTicks(i, hold); }
      });
    }
    if (hero && heroCanvasEl === canvas) {
      doc.classList.add('has-gl');
    } else {
      // DOM fallback: crossfade the hero photos
      if (canvas) canvas.remove();
      doc.classList.remove('has-gl');
      const loaded = [];
      slides.forEach(function (img) {
        img.addEventListener('load', function () { img.classList.add('is-loaded'); loaded.push(img); if (loaded.length === 1) img.classList.add('is-current'); }, { once: true });
        img.addEventListener('error', function () { img.remove(); }, { once: true });
        if (img.complete && img.naturalWidth) img.dispatchEvent(new Event('load'));
      });
      clearInterval(heroTimer);
      if (!reduced) {
        let k = 0;
        heroTimer = setInterval(function () {
          if (loaded.length < 2) return;
          loaded[k].classList.remove('is-current');
          k = (k + 1) % loaded.length;
          loaded[k].classList.add('is-current');
          setTicks(k, 4.3);
        }, 6500);
      }
    }

    // Hero scroll: image darkens, content lifts, logo rises out of the crop
    const heroLogo = $('[data-hero-logo]', heroEl);
    if (!reduced) {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: heroEl, start: 'top top', end: 'bottom top', scrub: true,
          onUpdate: function (s) { if (hero && hero.setScroll) hero.setScroll(s.progress); }
        }
      }).to($('.hero__content', heroEl), { yPercent: -18, opacity: 0.1, ease: 'none' }, 0)
        .to($('.hero__media', heroEl), { yPercent: 22, scale: 1.06, ease: 'none' }, 0);
      if (heroLogo) tl.to(heroLogo, { yPercent: -60, ease: 'none' }, 0);
    }
    return heroEl;
  }

  /* ------------------------------------------------------------------ *
   * Drop: pinned product rotating through colorways
   * ------------------------------------------------------------------ */
  function initDrop() {
    const dropPin = $('[data-drop-pin]');
    if (!dropPin) return;
    const layers = $$('[data-drop-layer]', dropPin);
    if (!layers.length) return;
    const dropName = $('[data-drop-name]', dropPin);
    const dropIndex = $('[data-drop-index]');
    const dropGlow = $('[data-drop-glow]', dropPin);
    const dropSwatches = $$('[data-drop-swatches] .swatch', dropPin);
    const dropAdd = $('[data-drop-link]', dropPin);
    let current = -1;
    let dropST = null;

    function setUI(i) {
      const layer = layers[i];
      const changed = i !== current;
      current = i;
      dropSwatches.forEach(function (s, k) { s.setAttribute('aria-checked', String(k === i)); });
      if (dropIndex) dropIndex.textContent = String(i + 1);
      if (dropAdd && layer.dataset.href) dropAdd.href = layer.dataset.href;
      if (dropGlow) dropGlow.style.background = 'radial-gradient(45% 50% at 50% 50%, ' + glowFor(layer.dataset.glow) + ', transparent 72%)';
      if (dropName) {
        if (changed && !reduced) gsap.fromTo(dropName, { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, ease: 'power3.out' });
        dropName.textContent = layer.dataset.name;
      }
    }
    function showStatic(i) {
      layers.forEach(function (l, k) { l.style.clipPath = k <= i ? 'inset(0% 0% 0% 0%)' : 'inset(100% 0% 0% 0%)'; });
      setUI(i);
    }

    mm.add({ motion: '(prefers-reduced-motion: no-preference)', desktop: '(min-width: 900px)' }, function (ctx) {
      if (!ctx.conditions.motion || layers.length < 2) { showStatic(0); return; }
      gsap.set(layers.slice(1), { clipPath: 'inset(100% 0% 0% 0%)' });
      const inner = layers.map(function (l) { return l.firstElementChild; });
      const tl = gsap.timeline({ defaults: { ease: 'none' } });
      for (let i = 1; i < layers.length; i++) {
        const at = i - 1;
        tl.to(layers[i], { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'power2.inOut' }, at)
          .fromTo(inner[i], { yPercent: 6, scale: 1.04 }, { yPercent: 0, scale: 1, duration: 1, ease: 'power2.out' }, at);
      }
      tl.to({}, { duration: 0.35 }); // hold on the last colorway

      dropST = ScrollTrigger.create({
        trigger: dropPin,
        start: 'top top',
        end: function () { return '+=' + window.innerHeight * (ctx.conditions.desktop ? 3.2 : 2.6) * ((layers.length - 1) / 2); },
        pin: true,
        scrub: 0.8,
        animation: tl,
        anticipatePin: 1,
        onUpdate: function (self) {
          // each colorway transition is 1 unit of timeline time
          const i = Math.min(layers.length - 1, Math.round(self.progress * tl.duration()));
          if (i !== current) setUI(i);
        }
      });
      return function () {
        dropST = null;
        gsap.set(layers, { clearProps: 'clipPath' });
        gsap.set(inner, { clearProps: 'transform' });
      };
    });

    setUI(0);

    dropSwatches.forEach(function (s, i) {
      s.addEventListener('click', function () {
        if (dropST) {
          const total = dropST.end - dropST.start;
          const tlDur = dropST.animation.duration();
          scrollToY(dropST.start + total * (i / tlDur) + 2);
        } else {
          showStatic(i);
        }
      });
    });
    V.radioKeys($('[data-drop-swatches]', dropPin));
  }

  /* ------------------------------------------------------------------ *
   * Product rail: horizontal pinned rail on desktop, native swipe on phones
   * ------------------------------------------------------------------ */
  function initRail() {
    const collection = $('[data-collection]');
    const track = $('[data-rail-track]');
    const railBar = $('[data-rail-progress]');
    if (!collection || !track) return;
    mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', function () {
      doc.classList.add('has-pin');
      function dist() { return Math.max(0, track.scrollWidth - window.innerWidth); }
      const tween = gsap.to(track, {
        x: function () { return -dist(); },
        ease: 'none',
        scrollTrigger: {
          trigger: collection,
          start: 'top top',
          end: function () { return '+=' + dist(); },
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          onUpdate: function (s) { if (railBar) gsap.set(railBar, { scaleX: s.progress }); }
        }
      });
      // cards lift into view as the rail moves
      $$('.pcard', track).forEach(function (card) {
        gsap.from(card.querySelector('.pcard__media, .display') || card, {
          clipPath: 'inset(12% 0% 12% 0%)', ease: 'none',
          scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left 100%', end: 'left 55%', scrub: true }
        });
      });
      ScrollTrigger.refresh();
      return function () { doc.classList.remove('has-pin'); };
    });

    const cards = $$('[data-pcard]', track);
    hover = (!reduced && T.webgl !== false && window.VyroGL && window.THREE) ? window.VyroGL.initHover(cards, drawCard) : null;
  }

  /* ------------------------------------------------------------------ *
   * Scroll reveals
   * ------------------------------------------------------------------ */
  function initReveals() {
    $$('[data-scale-words]').forEach(function (el) {
      const words = splitWords(el);
      if (reduced) return;
      gsap.fromTo(words,
        { opacity: 0.06, scale: 1.35, yPercent: 30, transformOrigin: '0% 100%' },
        {
          opacity: 1, scale: 1, yPercent: 0, ease: 'power2.out', stagger: 0.12,
          scrollTrigger: { trigger: el, start: 'top 88%', end: 'bottom 55%', scrub: 0.6 }
        });
    });

    $$('[data-split-rise]').forEach(function (el) {
      const chars = splitChars(el);
      if (reduced) return;
      gsap.from(chars, {
        yPercent: 110, duration: 1, stagger: 0.025, ease: 'power4.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true }
      });
    });

    // Categories: names split on entry, image mask reveal
    $$('[data-cat]').forEach(function (row) {
      const name = $('.cat__name', row);
      const chars = name ? splitChars(name) : [];
      const media = $('.cat__media', row);
      if (reduced || !media) return;
      const tl = gsap.timeline({ scrollTrigger: { trigger: row, start: 'top 88%', once: true } });
      tl.from(chars, { yPercent: 110, duration: 0.9, stagger: 0.018, ease: 'power4.out' }, 0)
        .fromTo(media, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power4.inOut' }, 0.1)
        .from(media.children, { scale: 1.25, duration: 1.4, ease: 'power3.out' }, 0.1)
        .from([$('.cat__desc', row), $('.cat__count', row)].filter(Boolean), { opacity: 0, y: 12, duration: 0.8, ease: 'power3.out' }, 0.3);
    });

    if (!reduced) {
      // Lookbook: columns drift at different speeds, frames unmask on entry
      $$('.look__item').forEach(function (item) {
        const media = $('.look__media', item);
        if (!media) return;
        gsap.fromTo(media, { clipPath: 'inset(100% 0% 0% 0%)' }, {
          clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'power4.inOut',
          scrollTrigger: { trigger: item, start: 'top 92%', once: true }
        });
        const img = $('img', media);
        if (img) gsap.fromTo(img, { yPercent: -5 }, {
          yPercent: 5, ease: 'none',
          scrollTrigger: { trigger: item, start: 'top bottom', end: 'bottom top', scrub: true }
        });
      });
      mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', function () {
        $$('[data-look-col]').forEach(function (col) {
          const speed = [-60, 40, -140][+col.dataset.lookCol] || 0;
          gsap.to(col, {
            y: speed, ease: 'none',
            scrollTrigger: { trigger: col.closest('.look__grid') || col, start: 'top bottom', end: 'bottom top', scrub: true }
          });
        });
      });

      const portrait = $('.story__portrait-media');
      if (portrait) {
        gsap.fromTo(portrait, { clipPath: 'inset(0% 0% 100% 0%)' }, {
          clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'power4.inOut',
          scrollTrigger: { trigger: portrait, start: 'top 85%', once: true }
        });
        const pimg = $('img', portrait);
        if (pimg) gsap.fromTo(pimg, { scale: 1.2 }, {
          scale: 1, ease: 'none',
          scrollTrigger: { trigger: portrait, start: 'top bottom', end: 'bottom top', scrub: true }
        });
      }

      // Details: mask reveal, slow drift inside the frame
      $$('[data-detail]').forEach(function (d) {
        const media = $('.detail__media', d);
        if (!media) return;
        const img = $('img', media);
        gsap.fromTo(media, { clipPath: 'inset(100% 0% 0% 0%)' }, {
          clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'power4.inOut',
          scrollTrigger: { trigger: d, start: 'top 88%', once: true }
        });
        if (img) gsap.fromTo(img, { yPercent: -6, scale: 1.12 }, {
          yPercent: 6, scale: 1, ease: 'none',
          scrollTrigger: { trigger: d, start: 'top bottom', end: 'bottom top', scrub: true }
        });
      });

      // Story + signup: parallax backdrop
      $$('[data-parallax-wrap]').forEach(function (wrap) {
        const el = $('[data-parallax]', wrap);
        if (!el) return;
        gsap.fromTo(el, { yPercent: -10 }, {
          yPercent: 10, ease: 'none',
          scrollTrigger: { trigger: wrap.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
        });
      });
    }

    // Story: words light up as you read
    $$('[data-reveal-words]').forEach(function (el) {
      const words = splitWords(el);
      if (reduced) return;
      gsap.fromTo(words, { opacity: 0.12 }, {
        opacity: 1, stagger: 0.1, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true }
      });
    });

    if (!reduced) {
      if ($('[data-pillar]')) gsap.from('[data-pillar]', {
        y: 40, opacity: 0, duration: 1, stagger: 0.12, ease: 'power3.out',
        scrollTrigger: { trigger: '.pillars', start: 'top 85%', once: true }
      });
      if ($('.story__body p')) gsap.from('.story__body p', {
        y: 24, opacity: 0, duration: 1, stagger: 0.1, ease: 'power3.out',
        scrollTrigger: { trigger: '.story__body', start: 'top 85%', once: true }
      });

      // Community: mask reveal on photos, staggered column drift on desktop
      $$('.review').forEach(function (r) {
        const shot = $('.shot', r);
        if (!shot) return;
        gsap.fromTo(shot, { clipPath: 'inset(0% 0% 100% 0%)' }, {
          clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'power4.inOut',
          scrollTrigger: { trigger: r, start: 'top 90%', once: true }
        });
      });
      mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', function () {
        $$('[data-review-col]').forEach(function (col, i) {
          gsap.to(col, {
            y: i % 2 ? -90 : -30, ease: 'none',
            scrollTrigger: { trigger: '[data-reviews]', start: 'top bottom', end: 'bottom top', scrub: true }
          });
        });
      });
    }
  }

  /* ------------------------------------------------------------------ *
   * Intro: brush-wipe logo reveal, then the hero lands
   * ------------------------------------------------------------------ */
  function playIntro(nav, heroEl) {
    const introLogo = $('.intro__logo');
    const heroLines = heroEl ? $$('.hero__title .line > span', heroEl) : [];
    const heroAside = $('[data-hero-aside]');
    const heroLogo = $('[data-hero-logo]');

    function heroIn(tl, at) {
      if (heroLines.length) tl.from(heroLines, { yPercent: 110, duration: 1.2, stagger: 0.09, ease: 'power4.out' }, at);
      if (heroAside) tl.from(heroAside, { y: 24, opacity: 0, duration: 1, ease: 'power3.out' }, at + 0.35);
      if (heroLogo) tl.add(brushWipe(heroLogo, 1.3, 4.2), at + 0.1);
      if ($('.hero__progress')) tl.from('.hero__progress', { opacity: 0, duration: 0.8 }, at + 0.6);
      tl.call(function () { if (nav) nav.classList.remove('is-pre'); }, null, at + 0.2);
    }

    // The intro plays once per visit. Coming back from a product page (or
    // landing on a #section link) goes straight to the content.
    let seen = false, returnTo = null;
    try {
      seen = sessionStorage.getItem('vyro-intro') === '1';
      sessionStorage.setItem('vyro-intro', '1');
      const nav0 = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      const ret = JSON.parse(sessionStorage.getItem('vyro-return') || 'null');
      if (ret && ret.path === location.pathname && nav0 && nav0.type === 'back_forward' && !location.hash) returnTo = ret.y;
      sessionStorage.removeItem('vyro-return');
    } catch (e) { /* storage off: always play */ }
    let jumpTo = null;
    try { jumpTo = location.hash && location.hash.length > 1 ? $(location.hash) : null; } catch (e) { jumpTo = null; }
    const introOn = document.body.classList.contains('is-loading') && $('.intro');

    function settle() {
      ScrollTrigger.refresh();
      if (jumpTo) {
        const y = jumpTo.getBoundingClientRect().top + window.scrollY;
        if (V.lenis) V.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y);
      } else if (returnTo !== null) {
        if (V.lenis) V.lenis.scrollTo(returnTo, { immediate: true, force: true }); else window.scrollTo(0, returnTo);
      }
    }

    if (reduced || designMode || seen || jumpTo || returnTo !== null || !introOn) {
      document.body.classList.remove('is-loading');
      const intro = $('.intro');
      if (intro) intro.style.display = 'none';
      if (window.history.scrollRestoration) window.history.scrollRestoration = 'manual';
      if (document.readyState === 'complete') requestAnimationFrame(settle);
      else window.addEventListener('load', function () { requestAnimationFrame(settle); });
      if (!reduced && !designMode && !jumpTo && returnTo === null) heroIn(gsap.timeline(), 0.1);
    } else {
      if (nav) nav.classList.add('is-pre');
      if (V.lenis) V.lenis.stop();
      window.scrollTo(0, 0);
      const tl = gsap.timeline({
        onComplete: function () {
          document.body.classList.remove('is-loading');
          if (V.lenis) V.lenis.start();
          ScrollTrigger.refresh();
        }
      });
      tl.add(brushWipe(introLogo, 1.1, 1.3), 0.15)
        .to('.intro', { clipPath: 'inset(0% 0% 100% 0%)', duration: 1, ease: 'power4.inOut' }, 1.5);
      if ($('.hero__media')) tl.from('.hero__media', { scale: 1.12, duration: 2.2, ease: 'power3.out' }, 1.5);
      heroIn(tl, 1.9);
    }
  }

  /* ------------------------------------------------------------------ *
   * Init
   * ------------------------------------------------------------------ */
  initStatic(document);

  // No GSAP: show everything statically and stop here.
  if (!gsap || !ScrollTrigger) {
    document.body.classList.remove('is-loading');
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  const nav = $('[data-nav]');
  const menu = $('[data-menu]');
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: function (self) {
      if (!nav) return;
      const y = self.scroll();
      nav.classList.toggle('is-scrolled', y > 40);
      nav.classList.toggle('is-hidden', (!menu || menu.hidden) && self.direction === 1 && y > window.innerHeight * 0.6);
    }
  });

  // In-page anchors (#drop, #story …) glide with Lenis
  document.addEventListener('click', function (e) {
    const a = e.target.closest('a[href^="#"], a[href^="/#"]');
    if (!a) return;
    const id = a.getAttribute('href').replace(/^\//, '');
    if (id.length < 2) return;
    let el = null;
    try { el = $(id); } catch (err) { return; }
    if (!el) return;
    e.preventDefault();
    V.closeMenu();
    const y = id === '#top' ? 0 : el.getBoundingClientRect().top + window.scrollY;
    scrollToY(y);
    el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  });

  function build() {
    mm = gsap.matchMedia();
    const heroEl = initHero();
    initDrop();
    initRail();
    initReveals();
    return heroEl;
  }

  const heroEl = build();
  playIntro(nav, heroEl);

  document.addEventListener('vyro:card-switched', function (e) { if (hover) hover.refresh(e.target); });

  // Recalculate pins once fonts and photos have settled
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });

  // Theme editor: rebuild the choreography when a section changes
  if (designMode) {
    let t = null;
    const rebuild = function (e) {
      clearTimeout(t);
      t = setTimeout(function () {
        if (mm) mm.revert();
        ScrollTrigger.getAll().forEach(function (st) { st.kill(true); });
        if (e && e.target) { initStatic(e.target); V.initCards(e.target); }
        build();
        ScrollTrigger.refresh();
      }, 60);
    };
    ['shopify:section:load', 'shopify:section:unload', 'shopify:section:reorder'].forEach(function (ev) {
      document.addEventListener(ev, rebuild);
    });
    // Selecting a drop block shows that colorway
    document.addEventListener('shopify:block:select', function (e) {
      const layer = e.target.closest && e.target.closest('[data-drop-layer]');
      if (!layer) return;
      const i = $$('[data-drop-layer]').indexOf(layer);
      const sw = $$('[data-drop-swatches] .swatch')[i];
      if (sw) sw.click();
    });
  }
})();

/*
  VYRO Athletics: page choreography
  GSAP + ScrollTrigger for motion, Lenis for momentum scrolling,
  Three.js (see gl.js) for the hero sequence and card hover distortion.
*/
(function () {
  const doc = document.documentElement;
  doc.classList.remove('no-js');

  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const G = window.VyroGarments;
  const Shop = window.VyroShop;

  /* ------------------------------------------------------------------ *
   * Content: garments + photo slots
   * ------------------------------------------------------------------ */
  $$('[data-garment]').forEach(G.render);

  // Shop rail: product cards come from the shared catalogue (js/shop.js)
  let hover = null;
  const railEnd = $('[data-rail-track] .pcard--end');
  const cards = Shop.mountCards($('[data-rail-track]'), Shop.PRODUCTS, {
    before: railEnd,
    reduced: reduced,
    onDone: function (card) { if (hover) hover.refresh(card); }
  });
  Shop.wrapPimgs(document);
  // Remember the scroll position when leaving for a product page
  $$('a[href^="product.html"]').forEach(function (a) {
    a.addEventListener('click', function () {
      try { sessionStorage.setItem('vyro-return', JSON.stringify({ path: location.pathname, y: window.scrollY })); } catch (e) { /* storage off */ }
    });
  });

  // Every <img data-photo> is optional. Missing files fall back to the stand-in.
  $$('img[data-photo]').forEach(function (img) {
    if (img.hasAttribute('data-hero-slide')) return; // handled by the hero
    function ok() { img.classList.add('is-loaded'); img.parentElement.classList.add('has-photo'); }
    function fail() { img.remove(); }
    if (img.complete) { img.naturalWidth ? ok() : fail(); }
    else { img.addEventListener('load', ok, { once: true }); img.addEventListener('error', fail, { once: true }); }
  });

  // No GSAP (CDN blocked): show everything statically and stop here.
  if (!gsap || !ScrollTrigger) {
    document.body.classList.remove('is-loading');
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  /* ------------------------------------------------------------------ *
   * Lenis momentum scroll
   * ------------------------------------------------------------------ */
  let lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.95 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  function scrollToY(y) {
    if (lenis) lenis.scrollTo(y, { duration: 1.4 });
    else window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
  }

  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const el = $(id);
      if (!el) return;
      e.preventDefault();
      closeMenu();
      const y = id === '#top' ? 0 : el.getBoundingClientRect().top + window.scrollY;
      scrollToY(y);
      el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    });
  });

  /* ------------------------------------------------------------------ *
   * Helpers: text splitting
   * ------------------------------------------------------------------ */
  function splitWords(el) {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute('aria-label', el.textContent.trim());
    el.innerHTML = words.map(function (w) { return '<span class="w" aria-hidden="true">' + w + '</span>'; }).join(' ');
    return $$('.w', el);
  }

  function splitChars(el) {
    const text = el.textContent;
    el.setAttribute('aria-label', text.trim());
    el.innerHTML = text.split(/(\s+)/).map(function (part) {
      if (/^\s+$/.test(part)) return ' ';
      return '<span style="display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:0.06em" aria-hidden="true">' +
        part.split('').map(function (c) { return '<span class="ch">' + c + '</span>'; }).join('') + '</span>';
    }).join('');
    return $$('.ch', el);
  }

  /* ------------------------------------------------------------------ *
   * Nav + mobile menu
   * ------------------------------------------------------------------ */
  const nav = $('[data-nav]');
  const menuBtn = $('[data-menu-toggle]');
  const menu = $('[data-menu]');
  let menuOpen = false;

  function closeMenu() {
    if (!menuOpen) return;
    menuOpen = false;
    menuBtn.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
    if (lenis) lenis.start();
  }
  menuBtn.addEventListener('click', function () {
    menuOpen = !menuOpen;
    menuBtn.setAttribute('aria-expanded', String(menuOpen));
    menu.hidden = !menuOpen;
    if (menuOpen) {
      if (lenis) lenis.stop();
      nav.classList.remove('is-hidden');
      if (!reduced) gsap.from($$('a', menu), { yPercent: 60, opacity: 0, duration: 0.7, stagger: 0.05, ease: 'power3.out' });
    } else if (lenis) lenis.start();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });

  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: function (self) {
      const y = self.scroll();
      nav.classList.toggle('is-scrolled', y > 40);
      nav.classList.toggle('is-hidden', !menuOpen && self.direction === 1 && y > window.innerHeight * 0.6);
    }
  });

  /* ------------------------------------------------------------------ *
   * Hero: WebGL sequence
   * ------------------------------------------------------------------ */
  const heroCanvas = $('[data-hero-gl]');
  const heroSlides = $$('[data-hero-slide]');
  const ticks = $$('.hero__tick i');

  function setTicks(i, hold) {
    ticks.forEach(function (t, k) {
      gsap.killTweensOf(t);
      gsap.set(t, { scaleX: k < i ? 1 : 0 });
    });
    if (!reduced && ticks[i]) gsap.to(ticks[i], { scaleX: 1, duration: hold + 2.2, ease: 'none' });
  }

  // While a slide is a rendered stand-in, say which photo file belongs there
  const heroNote = $('[data-hero-note]');
  // Wide screens get three portrait shots per slide; phones get one
  let heroSrcs = heroSlides.map(function (i) { return i.getAttribute('src'); });
  try {
    const wide = JSON.parse(heroCanvas.dataset.slidesWide || 'null');
    if (wide && window.matchMedia('(min-width: 900px)').matches) heroSrcs = wide;
  } catch (e) { /* keep single-photo slides */ }
  const heroHasPhoto = heroSrcs.map(function () { return false; });
  let heroIdx = 0;
  function updateNote() {
    heroNote.hidden = heroHasPhoto[heroIdx];
    heroNote.textContent = 'Stand-in image. Add your photo at ' + [].concat(heroSrcs[heroIdx]).join(', ');
  }

  let hero = null;
  if (window.VyroGL && window.VyroGL.supported()) {
    hero = window.VyroGL.initHero(heroCanvas, heroSrcs, {
      reduced: reduced,
      onChange: function (i, hold) { heroIdx = i; updateNote(); setTicks(i, hold); },
      onPhoto: function (i) { heroHasPhoto[i] = true; updateNote(); }
    });
    updateNote();
  }
  if (hero) {
    doc.classList.add('has-gl');
  } else {
    // DOM fallback: crossfade whichever hero photos exist
    heroCanvas.remove();
    const loaded = [];
    heroSlides.forEach(function (img) {
      img.addEventListener('load', function () { img.classList.add('is-loaded'); loaded.push(img); if (loaded.length === 1) img.classList.add('is-current'); }, { once: true });
      img.addEventListener('error', function () { img.remove(); }, { once: true });
      if (img.complete && img.naturalWidth) img.dispatchEvent(new Event('load'));
    });
    if (!reduced) {
      let k = 0;
      setInterval(function () {
        if (loaded.length < 2) return;
        loaded[k].classList.remove('is-current');
        k = (k + 1) % loaded.length;
        loaded[k].classList.add('is-current');
      }, 6500);
    }
  }

  // Hero scroll: image darkens, content lifts, logo rises out of the crop
  const heroEl = $('[data-hero]');
  const heroLogo = $('[data-hero-logo]');
  if (!reduced) {
    gsap.timeline({
      scrollTrigger: {
        trigger: heroEl, start: 'top top', end: 'bottom top', scrub: true,
        onUpdate: function (s) { if (hero) hero.setScroll(s.progress); }
      }
    })
      .to('.hero__content', { yPercent: -18, opacity: 0.1, ease: 'none' }, 0)
      .to(heroLogo, { yPercent: -60, ease: 'none' }, 0)
      .to('.hero__media', { yPercent: 22, scale: 1.06, ease: 'none' }, 0);
  }

  /* ------------------------------------------------------------------ *
   * Intro: brush-wipe logo reveal, then the hero lands
   * ------------------------------------------------------------------ */
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
    const o = { p: 0 };
    el.style.clipPath = brushPoly(0, seed);
    return gsap.to(o, {
      p: 1, duration: duration, ease: 'power3.inOut',
      onUpdate: function () { el.style.clipPath = brushPoly(o.p, seed); },
      onComplete: function () { el.style.clipPath = 'none'; }
    });
  }

  const introLogo = $('.intro__logo');
  const heroLines = $$('.hero__title .line > span');
  const heroAside = $('[data-hero-aside]');

  function heroIn(tl, at) {
    tl.from(heroLines, { yPercent: 110, duration: 1.2, stagger: 0.09, ease: 'power4.out' }, at)
      .from(heroAside, { y: 24, opacity: 0, duration: 1, ease: 'power3.out' }, at + 0.35)
      .add(brushWipe(heroLogo, 1.3, 4.2), at + 0.1)
      .from('.hero__progress', { opacity: 0, duration: 0.8 }, at + 0.6)
      .call(function () { nav.classList.remove('is-pre'); }, null, at + 0.2);
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
  const jumpTo = location.hash && location.hash.length > 1 ? $(location.hash) : null;

  function settle() {
    ScrollTrigger.refresh();
    if (jumpTo) {
      const y = jumpTo.getBoundingClientRect().top + window.scrollY;
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y);
    } else if (returnTo !== null) {
      if (lenis) lenis.scrollTo(returnTo, { immediate: true, force: true }); else window.scrollTo(0, returnTo);
    }
  }

  if (reduced || seen || jumpTo || returnTo !== null) {
    document.body.classList.remove('is-loading');
    if (window.history.scrollRestoration) window.history.scrollRestoration = 'manual';
    window.addEventListener('load', function () { requestAnimationFrame(settle); });
    if (!reduced && !jumpTo && returnTo === null) {
      const tl = gsap.timeline();
      heroIn(tl, 0.1);
    }
  } else {
    nav.classList.add('is-pre');
    if (lenis) lenis.stop();
    window.scrollTo(0, 0);
    const tl = gsap.timeline({
      onComplete: function () {
        document.body.classList.remove('is-loading');
        if (lenis) lenis.start();
        ScrollTrigger.refresh();
      }
    });
    tl.add(brushWipe(introLogo, 1.1, 1.3), 0.15)
      .to('.intro', { clipPath: 'inset(0% 0% 100% 0%)', duration: 1, ease: 'power4.inOut' }, 1.5)
      .from('.hero__media', { scale: 1.12, duration: 2.2, ease: 'power3.out' }, 1.5);
    heroIn(tl, 1.9);
  }

  /* ------------------------------------------------------------------ *
   * Statement + CTA headline: words scale down into place
   * ------------------------------------------------------------------ */
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

  /* ------------------------------------------------------------------ *
   * Section titles: characters rise out of a mask
   * ------------------------------------------------------------------ */
  $$('[data-split-rise]').forEach(function (el) {
    const chars = splitChars(el);
    if (reduced) return;
    gsap.from(chars, {
      yPercent: 110, duration: 1, stagger: 0.025, ease: 'power4.out',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true }
    });
  });

  /* ------------------------------------------------------------------ *
   * Drop 01: pinned product rotating through colorways
   * ------------------------------------------------------------------ */
  const COLOR_ORDER = ['black', 'navy', 'gray'];
  const GLOW = {
    black: 'rgba(197, 208, 216, 0.10)',
    navy: 'rgba(60, 90, 170, 0.26)',
    gray: 'rgba(210, 212, 216, 0.16)'
  };
  const dropPin = $('[data-drop-pin]');
  const layers = $$('[data-drop-layer]');
  const dropName = $('[data-drop-name]');
  const dropIndex = $('[data-drop-index]');
  const dropGlow = $('[data-drop-glow]');
  const dropSwatches = $$('[data-drop-swatches] .swatch');
  const dropAdd = $('[data-drop-link]');
  let dropCurrent = 0;
  let dropST = null;

  function setDropUI(i) {
    const color = COLOR_ORDER[i];
    const changed = i !== dropCurrent;
    dropCurrent = i;
    dropSwatches.forEach(function (s, k) { s.setAttribute('aria-checked', String(k === i)); });
    dropIndex.textContent = String(i + 1);
    dropAdd.href = Shop.url('athletics-club-hoodie', color);
    dropGlow.style.background = 'radial-gradient(45% 50% at 50% 50%, ' + GLOW[color] + ', transparent 72%)';
    if (changed && !reduced) {
      gsap.fromTo(dropName, { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, ease: 'power3.out' });
    }
    dropName.textContent = Shop.colorName(color);
  }

  function showDropStatic(i) {
    layers.forEach(function (l, k) { l.style.clipPath = k <= i ? 'inset(0% 0% 0% 0%)' : 'inset(100% 0% 0% 0%)'; });
    setDropUI(i);
  }

  const mm = gsap.matchMedia();

  mm.add({ motion: '(prefers-reduced-motion: no-preference)', desktop: '(min-width: 900px)' }, function (ctx) {
    if (!ctx.conditions.motion) {
      showDropStatic(0);
      return;
    }
    gsap.set(layers.slice(1), { clipPath: 'inset(100% 0% 0% 0%)' });
    const garments = layers.map(function (l) { return l.firstElementChild; });
    const tl = gsap.timeline({ defaults: { ease: 'none' } });
    for (let i = 1; i < layers.length; i++) {
      const at = i - 1;
      tl.to(layers[i], { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'power2.inOut' }, at)
        .fromTo(garments[i], { yPercent: 6, scale: 1.04 }, { yPercent: 0, scale: 1, duration: 1, ease: 'power2.out' }, at);
    }
    tl.to({}, { duration: 0.35 }); // hold on the last colorway

    dropST = ScrollTrigger.create({
      trigger: dropPin,
      start: 'top top',
      end: function () { return '+=' + window.innerHeight * (ctx.conditions.desktop ? 3.2 : 2.6); },
      pin: true,
      scrub: 0.8,
      animation: tl,
      anticipatePin: 1,
      onUpdate: function (self) {
        // each colorway transition is 1 unit of timeline time
        const i = Math.min(COLOR_ORDER.length - 1, Math.round(self.progress * tl.duration()));
        if (i !== dropCurrent) setDropUI(i);
      }
    });
    return function () {
      dropST = null;
      gsap.set(layers, { clearProps: 'clipPath' });
      gsap.set(garments, { clearProps: 'transform' });
    };
  });

  setDropUI(0);

  dropSwatches.forEach(function (s, i) {
    s.addEventListener('click', function () {
      if (dropST) {
        const total = dropST.end - dropST.start;
        const tlDur = dropST.animation.duration();
        scrollToY(dropST.start + total * (i / tlDur) + 2);
      } else {
        showDropStatic(i);
      }
    });
  });
  Shop.radioKeys($('[data-drop-swatches]'));

  /* ------------------------------------------------------------------ *
   * Collection: horizontal pinned rail on desktop, native swipe on phones
   * ------------------------------------------------------------------ */
  const collection = $('[data-collection]');
  const track = $('[data-rail-track]');
  const railBar = $('[data-rail-progress]');

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
        onUpdate: function (s) { gsap.set(railBar, { scaleX: s.progress }); }
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

  /* ------------------------------------------------------------------ *
   * Product cards: colorway switching + WebGL hover
   * ------------------------------------------------------------------ */
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
    return Promise.all(imgs.map(Shop.whenLoaded)).then(function (loaded) {
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
        tx.drawImage(img, (bw - dw) / 2, (bh - dh) / 2, dw, dh);
        feather(tx, bw, bh);
        x.drawImage(t, (r.left - mr.left) * k, (r.top - mr.top) * k);
      });
      return c;
    });
  }

  hover = (!reduced && window.VyroGL) ? window.VyroGL.initHover(cards, drawCard) : null;

  /* ------------------------------------------------------------------ *
   * Categories: names split on entry, image mask reveal
   * ------------------------------------------------------------------ */
  $$('[data-cat]').forEach(function (row) {
    const name = $('.cat__name', row);
    const chars = splitChars(name);
    const media = $('.cat__media', row);
    if (reduced) return;
    const tl = gsap.timeline({ scrollTrigger: { trigger: row, start: 'top 88%', once: true } });
    tl.from(chars, { yPercent: 110, duration: 0.9, stagger: 0.018, ease: 'power4.out' }, 0)
      .fromTo(media, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power4.inOut' }, 0.1)
      .from(media.children, { scale: 1.25, duration: 1.4, ease: 'power3.out' }, 0.1)
      .from([$('.cat__desc', row), $('.cat__count', row)], { opacity: 0, y: 12, duration: 0.8, ease: 'power3.out' }, 0.3);
  });

  /* ------------------------------------------------------------------ *
   * Lookbook: columns drift at different speeds, frames unmask on entry
   * ------------------------------------------------------------------ */
  if (!reduced) {
    $$('.look__item').forEach(function (item) {
      const media = $('.look__media', item);
      gsap.fromTo(media, { clipPath: 'inset(100% 0% 0% 0%)' }, {
        clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'power4.inOut',
        scrollTrigger: { trigger: item, start: 'top 92%', once: true }
      });
      gsap.fromTo($('img', media), { yPercent: -5 }, {
        yPercent: 5, ease: 'none',
        scrollTrigger: { trigger: item, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });
    mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', function () {
      $$('[data-look-col]').forEach(function (col) {
        const speed = [-60, 40, -140][+col.dataset.lookCol];
        gsap.to(col, {
          y: speed, ease: 'none',
          scrollTrigger: { trigger: '.look__grid', start: 'top bottom', end: 'bottom top', scrub: true }
        });
      });
    });

    const portrait = $('.story__portrait-media');
    if (portrait) {
      gsap.fromTo(portrait, { clipPath: 'inset(0% 0% 100% 0%)' }, {
        clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'power4.inOut',
        scrollTrigger: { trigger: portrait, start: 'top 85%', once: true }
      });
      gsap.fromTo($('img', portrait), { scale: 1.2 }, {
        scale: 1, ease: 'none',
        scrollTrigger: { trigger: portrait, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    }
  }

  /* ------------------------------------------------------------------ *
   * Details: mask reveal, slow drift inside the frame
   * ------------------------------------------------------------------ */
  if (!reduced) {
    $$('[data-detail]').forEach(function (d) {
      const media = $('.detail__media', d);
      const img = $('img', media);
      gsap.fromTo(media, { clipPath: 'inset(100% 0% 0% 0%)' }, {
        clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'power4.inOut',
        scrollTrigger: { trigger: d, start: 'top 88%', once: true }
      });
      gsap.fromTo(img, { yPercent: -6, scale: 1.12 }, {
        yPercent: 6, scale: 1, ease: 'none',
        scrollTrigger: { trigger: d, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Story: parallax backdrop, words light up as you read
   * ------------------------------------------------------------------ */
  if (!reduced) {
    $$('[data-parallax-wrap]').forEach(function (wrap) {
      const el = $('[data-parallax]', wrap);
      gsap.fromTo(el, { yPercent: -10 }, {
        yPercent: 10, ease: 'none',
        scrollTrigger: { trigger: wrap.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });
  }

  $$('[data-reveal-words]').forEach(function (el) {
    const words = splitWords(el);
    if (reduced) return;
    gsap.fromTo(words, { opacity: 0.12 }, {
      opacity: 1, stagger: 0.1, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true }
    });
  });

  if (!reduced) {
    gsap.from('[data-pillar]', {
      y: 40, opacity: 0, duration: 1, stagger: 0.12, ease: 'power3.out',
      scrollTrigger: { trigger: '.pillars', start: 'top 85%', once: true }
    });
    gsap.from('.story__body p', {
      y: 24, opacity: 0, duration: 1, stagger: 0.1, ease: 'power3.out',
      scrollTrigger: { trigger: '.story__body', start: 'top 85%', once: true }
    });
  }

  /* ------------------------------------------------------------------ *
   * Community: mask reveal on photos, staggered column drift on desktop
   * ------------------------------------------------------------------ */
  if (!reduced) {
    $$('.review').forEach(function (r) {
      const shot = $('.shot', r);
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

  /* ------------------------------------------------------------------ *
   * Drop alert signup
   * ------------------------------------------------------------------ */
  const form = $('[data-signup]');
  const input = $('#signup-email');
  const msg = $('#signup-msg');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const v = input.value.trim();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    msg.classList.remove('is-error', 'is-ok');
    if (!valid) {
      input.setAttribute('aria-invalid', 'true');
      msg.textContent = v ? 'That email address looks incomplete. Check it and try again.' : 'Enter your email address to get drop alerts.';
      msg.classList.add('is-error');
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    // Hook your email provider here (Klaviyo, Shopify Email, Mailchimp...).
    form.classList.add('is-done');
    msg.textContent = "You're on the list. We'll email " + v + ' before Drop 02 goes live.';
    msg.classList.add('is-ok');
  });

  // Recalculate pins once fonts have settled
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();

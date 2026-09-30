/*
  VYRO product page: variant picking (colour swatches + size buttons),
  colour-filtered gallery, quantity, AJAX add to bag, Complete the Look
  refresh, Shopify product recommendations and the entrance motion.
*/
(function () {
  'use strict';

  const V = window.Vyro;
  const T = window.VyroTheme || {};
  const strings = T.strings || {};
  const $ = V.$, $$ = V.$$;
  const gsap = window.gsap;
  const reduced = V.reduced;

  /* ------------------------------------------------------------------ *
   * Always open a product at the top. Browsers restore the old scroll
   * position on reload and back/forward, so take over scroll restoration.
   * Once the visitor scrolls themselves we stop forcing it.
   * ------------------------------------------------------------------ */
  if (!T.designMode) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    let userScrolled = false;
    ['wheel', 'touchmove', 'keydown'].forEach(function (ev) {
      window.addEventListener(ev, function () { userScrolled = true; }, { passive: true, once: true });
    });
    const toTop = function (force) {
      if (userScrolled && !force) return;
      if (V.lenis) V.lenis.scrollTo(0, { immediate: true, force: true });
      window.scrollTo(0, 0);
    };
    toTop(true);
    requestAnimationFrame(function () { toTop(); });
    window.addEventListener('load', function () { toTop(); });
    window.addEventListener('pageshow', function (e) { if (e.persisted) { userScrolled = false; toTop(true); } });
  }

  function init(root) {
    if (!root || root.dataset.ready) return;
    root.dataset.ready = '1';

    let product = null;
    try { product = JSON.parse($('[data-product-json]', root).textContent); } catch (e) { return; }
    const colorPos = parseInt(root.dataset.colorIndex, 10) || 0;
    const form = $('[data-product-form]', root) || $('form[action*="/cart/add"]', root);
    const idInput = $('[data-variant-id]', root);
    const addBtn = $('[data-add]', root);
    const addError = $('[data-add-error]', root);
    const priceEl = $('.pdp__price-value', root);
    const track = $('[data-gallery]', root);
    const counter = $('[data-counter]', root);
    const total = $('[data-total]', root);
    const groups = $$('[data-option]', root);
    const sizeGroup = $('[data-size-option]', root);
    const sizeError = $('[data-size-error]', root);
    const requireSize = !!(sizeGroup && !$('[aria-checked="true"]', sizeGroup));
    let sizeChosen = !requireSize;
    let variant = product.variants.filter(function (v) { return String(v.id) === idInput.value; })[0] || product.variants[0];

    /* ---------------- gallery ---------------- */
    let io = null;
    function setupGallery() {
      if (!track) return;
      V.wrapPimgs(track);
      const shots = $$('.pdp__shot', track);
      if (total) total.textContent = String(shots.length);
      if (counter) counter.textContent = '1';
      if (io) io.disconnect();
      if ('IntersectionObserver' in window) {
        io = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting && e.intersectionRatio > 0.6) counter.textContent = String(shots.indexOf(e.target) + 1);
          });
        }, { root: track, threshold: [0.6] });
        shots.forEach(function (s) { io.observe(s); });
      }
      shots.forEach(function (s) { $$('.pimg', s).forEach(V.fitPimg); });
    }

    // Show the shots whose alt text names the colour; if none do, show all.
    // Other colours are taken out of the track (not just hidden) so the
    // gallery grid's first/last-child layout still applies.
    const allShots = track ? $$('.pdp__shot', track) : [];
    function filterGallery(color) {
      if (!track || !allShots.length) return;
      const needle = String(color || '').toLowerCase();
      const hit = needle ? allShots.filter(function (s) { return (s.dataset.mediaAlt || '').indexOf(needle) > -1; }) : [];
      const show = hit.length ? hit : allShots;
      allShots.forEach(function (s) { if (show.indexOf(s) < 0 && s.parentNode) s.remove(); });
      show.forEach(function (s) { track.appendChild(s); });
    }

    /* ---------------- variants ---------------- */
    function selected() {
      return groups.map(function (g) {
        const on = $('[aria-checked="true"]', g);
        return on ? on.dataset.value : null;
      });
    }
    function findVariant(opts) {
      return product.variants.filter(function (v) {
        return opts.every(function (o, i) { return o === null || v.options[i] === o; });
      })[0] || null;
    }
    function groupIndex(g) { return (parseInt(g.dataset.option, 10) || 1) - 1; }

    function refreshAvailability() {
      const opts = selected();
      groups.forEach(function (g) {
        const gi = groupIndex(g);
        if (gi === colorPos - 1) return;
        $$('[data-value]', g).forEach(function (b) {
          const probe = opts.slice();
          probe[gi] = b.dataset.value;
          const v = findVariant(probe);
          const off = !v || !v.available;
          b.classList.toggle('is-soldout', off);
          b.setAttribute('aria-disabled', String(off));
        });
      });
    }

    function setButton() {
      if (!addBtn) return;
      if (!variant) { addBtn.disabled = true; addBtn.textContent = strings.unavailable; return; }
      addBtn.disabled = !variant.available;
      addBtn.textContent = variant.available ? strings.addToCart : strings.soldOut;
    }

    function setPrice() {
      if (!priceEl || !variant) return;
      let html = V.money(variant.price);
      const sale = variant.compare_at_price && variant.compare_at_price > variant.price;
      if (sale) html += ' <s class="price__compare">' + V.money(variant.compare_at_price) + '</s>';
      priceEl.classList.toggle('is-sale', !!sale);
      priceEl.innerHTML = html;
    }

    function update(changedGroup) {
      const opts = selected();
      const v = findVariant(opts);
      variant = v;
      if (v) {
        idInput.value = v.id;
        if (!T.designMode) {
          const u = new URL(location.href);
          u.searchParams.set('variant', v.id);
          history.replaceState(history.state, '', u.pathname + u.search + u.hash);
        }
      }
      setButton();
      setPrice();
      refreshAvailability();
      if (changedGroup && groupIndex(changedGroup) === colorPos - 1) colorChanged(opts[colorPos - 1]);
    }

    function colorChanged(color) {
      $$('.pdp__wish', root).forEach(function (w) { w.dataset.color = color; });
      refreshLook();
      if (!track) return;
      if (gsap && !reduced) {
        gsap.to(track, {
          opacity: 0, duration: 0.25, onComplete: function () {
            filterGallery(color);
            track.scrollLeft = 0;
            setupGallery();
            gsap.to(track, { opacity: 1, duration: 0.45 });
          }
        });
      } else {
        filterGallery(color);
        setupGallery();
      }
    }

    groups.forEach(function (g) {
      V.radioKeys(g);
      $$('[data-value]', g).forEach(function (b) {
        b.addEventListener('click', function () {
          $$('[data-value]', g).forEach(function (o) { o.setAttribute('aria-checked', String(o === b)); });
          const label = $('[data-option-name="' + g.dataset.option + '"]', root);
          if (label) label.textContent = b.dataset.value;
          if (g === sizeGroup) {
            sizeChosen = true;
            if (sizeError) sizeError.textContent = '';
            g.classList.remove('is-invalid');
          }
          if (addError) addError.textContent = '';
          update(g);
        });
      });
    });

    // Size guide link opens the fit accordion
    const guide = $('[data-guide]', root);
    if (guide) guide.addEventListener('click', function (e) {
      e.preventDefault();
      const d = $('#fit details', root);
      if (!d) return;
      d.open = true;
      V.scrollTo(d.getBoundingClientRect().top + window.scrollY - 120, 1);
    });

    /* ---------------- quantity ---------------- */
    const qtyInput = $('[data-qty-input]', root);
    function setQty(n) {
      if (!qtyInput) return;
      qtyInput.value = String(Math.max(1, Math.min(10, Math.round(+n) || 1)));
    }
    $$('[data-qty]', root).forEach(function (b) {
      b.addEventListener('click', function () { setQty((+qtyInput.value || 1) + (+b.dataset.qty)); });
    });
    if (qtyInput) qtyInput.addEventListener('change', function () { setQty(qtyInput.value); });

    /* ---------------- add to bag ---------------- */
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!sizeChosen) {
        if (sizeError) sizeError.textContent = strings.selectSize;
        sizeGroup.classList.add('is-invalid');
        const first = $('[data-value]', sizeGroup);
        if (first) first.focus();
        return;
      }
      if (!variant || !variant.available) return;
      if (addError) addError.textContent = '';
      addBtn.disabled = true;
      addBtn.classList.add('is-busy');
      const fd = new FormData(form);
      const props = {};
      fd.forEach(function (val, key) {
        const m = /^properties\[(.+)\]$/.exec(key);
        if (m && val !== '') props[m[1]] = val;
      });
      V.addToCart([{ id: variant.id, quantity: +(qtyInput ? qtyInput.value : 1) || 1, properties: props }]).then(function () {
        addBtn.classList.remove('is-busy');
        addBtn.disabled = false;
        addBtn.textContent = strings.added;
        addBtn.classList.add('is-done');
        setTimeout(function () { setButton(); addBtn.classList.remove('is-done'); }, 1800);
      }, function (err) {
        addBtn.classList.remove('is-busy');
        setButton();
        if (addError) addError.textContent = err.message || strings.cartError;
      });
    });

    /* ---------------- Complete the look ---------------- */
    function refreshLook() {
      const look = $('[data-look][data-section]');
      if (!look || !variant) return;
      const url = String(T.routes && T.routes.root || '/').replace(/\/?$/, '/') + 'products/' + product.handle + '?variant=' + variant.id + '&section_id=' + encodeURIComponent(look.dataset.section);
      fetch(url).then(function (r) { return r.text(); }).then(function (html) {
        const fresh = $('[data-look]', new DOMParser().parseFromString(html, 'text/html'));
        if (!fresh) return;
        look.innerHTML = fresh.innerHTML;
        V.syncWish(look);
      }).catch(function () { /* keep the current look */ });
    }

    /* ---------------- back to shop ---------------- */
    $$('[data-back]', root).forEach(function (a) {
      a.addEventListener('click', function (e) {
        let ret = null;
        try { ret = JSON.parse(sessionStorage.getItem('vyro-return') || 'null'); } catch (err) { /* ignore */ }
        // Came straight here from the shop: step back so it restores its scroll position
        let fromShop = false;
        try { fromShop = ret && document.referrer && new URL(document.referrer).pathname === ret.path && ret.path !== location.pathname; } catch (err) { fromShop = false; }
        if (fromShop && history.length > 1) {
          e.preventDefault();
          history.back();
        }
      });
    });

    /* ---------------- first paint ---------------- */
    if (colorPos) {
      const cg = groups.filter(function (g) { return groupIndex(g) === colorPos - 1; })[0];
      const on = cg && $('[aria-checked="true"]', cg);
      if (on) filterGallery(on.dataset.value);
    }
    setupGallery();
    refreshAvailability();
    V.syncWish(root);

    if (gsap && !reduced && !T.designMode) {
      gsap.from($$('.pdp__shot', root), { clipPath: 'inset(100% 0% 0% 0%)', duration: 1.1, stagger: 0.08, ease: 'power4.inOut' });
      gsap.from($$('.pdp__sticky > *', root), { y: 18, opacity: 0, duration: 0.8, stagger: 0.04, ease: 'power3.out', delay: 0.15 });
    }
  }

  /* ------------------------------------------------------------------ *
   * You might also like: Shopify product recommendations
   * ------------------------------------------------------------------ */
  function loadRelated(section) {
    if (!section || section.dataset.loaded || !section.dataset.url) return;
    section.dataset.loaded = '1';
    fetch(section.dataset.url).then(function (r) { return r.text(); }).then(function (html) {
      const fresh = $('[data-related]', new DOMParser().parseFromString(html, 'text/html'));
      const target = $('[data-related]', section);
      if (!fresh || !target || !$('[data-pcard]', fresh)) return;
      target.innerHTML = fresh.innerHTML;
      V.initCards(target);
    }).catch(function () { /* keep the fallback cards */ });
  }

  $$('[data-pdp]').forEach(init);
  $$('[data-related-section]').forEach(loadRelated);

  document.addEventListener('shopify:section:load', function (e) {
    $$('[data-pdp]', e.target).forEach(init);
    $$('[data-related-section]', e.target).forEach(loadRelated);
  });
})();

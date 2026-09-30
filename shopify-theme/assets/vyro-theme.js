/*
  VYRO Athletics: shared theme script (every page)
  Momentum scroll, header, mobile menu, dialogs, toast, product photo
  fitting, product card colorways, wishlist hearts, search overlay and the
  AJAX cart drawer (Shopify Cart API + Section Rendering API).
*/
(function () {
  'use strict';

  const T = window.VyroTheme || {};
  const routes = T.routes || {};
  const strings = T.strings || {};
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gsap = window.gsap;
  const isHome = document.body.dataset.page === 'home';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  /* ------------------------------------------------------------------ *
   * Money (matches Liquid's money_without_trailing_zeros)
   * ------------------------------------------------------------------ */
  function formatMoney(cents, format) {
    cents = Math.round(+cents || 0);
    format = format || T.moneyFormat || '€{{amount}}';
    function fmt(n, dec, thou, sep) {
      const fixed = (n / 100).toFixed(dec);
      const parts = fixed.split('.');
      const whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thou);
      return parts[1] && !/^0+$/.test(parts[1]) ? whole + sep + parts[1] : whole;
    }
    return format.replace(/\{\{\s*(\w+)\s*\}\}/, function (m, key) {
      switch (key) {
        case 'amount_no_decimals': return fmt(cents, 0, ',', '.');
        case 'amount_with_comma_separator': return fmt(cents, 2, '.', ',');
        case 'amount_no_decimals_with_comma_separator': return fmt(cents, 0, '.', ',');
        case 'amount_with_space_separator': return fmt(cents, 2, ' ', ',');
        case 'amount_no_decimals_with_space_separator': return fmt(cents, 0, ' ', ',');
        case 'amount_with_apostrophe_separator': return fmt(cents, 2, "'", '.');
        default: return fmt(cents, 2, ',', '.');
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Scroll lock + momentum scroll
   * ------------------------------------------------------------------ */
  const lockers = [];
  let locks = 0;
  function lock(on) {
    locks = Math.max(0, locks + (on ? 1 : -1));
    document.documentElement.classList.toggle('is-locked', locks > 0);
    lockers.forEach(function (fn) { fn(locks > 0); });
  }

  let lenis = null;
  if (!reduced && window.Lenis && gsap && !T.designMode) {
    lenis = isHome
      ? new window.Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.95 })
      : new window.Lenis({ lerp: 0.1, smoothWheel: true });
    if (window.ScrollTrigger) lenis.on('scroll', window.ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }
  lockers.push(function (on) { if (lenis) { on ? lenis.stop() : lenis.start(); } });

  function scrollToY(y, duration) {
    if (lenis) lenis.scrollTo(y, { duration: duration || 1.2 });
    else window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
  }

  // Keep keyboard focus inside an open dialog
  function trap(panel, e) {
    if (e.key !== 'Tab') return;
    const f = $$('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])', panel)
      .filter(function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // Generic dialog open/close with focus return
  function dialog(root, panel) {
    let opener = null;
    const d = {
      open: function () {
        if (!root.hidden) return;
        opener = document.activeElement;
        root.hidden = false;
        requestAnimationFrame(function () { root.classList.add('is-open'); });
        lock(true);
      },
      close: function () {
        if (root.hidden) return;
        root.classList.remove('is-open');
        lock(false);
        setTimeout(function () { root.hidden = true; }, 380);
        if (opener && opener.focus) opener.focus();
      },
      isOpen: function () { return !root.hidden; }
    };
    root.addEventListener('keydown', function (e) { trap(panel(), e); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !root.hidden) d.close();
    });
    return d;
  }

  /* ------------------------------------------------------------------ *
   * Header + mobile menu
   * ------------------------------------------------------------------ */
  const nav = $('[data-nav]');
  const menuBtn = $('[data-menu-toggle]');
  const menu = $('[data-menu]');
  function setMenu(open) {
    if (!menu || open === !menu.hidden) return;
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    if (nav) nav.classList.remove('is-hidden');
    lock(open);
  }
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', function () { setMenu(menu.hidden); });
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  }

  // Inner pages: solid header, hides while scrolling down (home: vyro-home.js)
  if (!isHome && nav) {
    document.body.classList.remove('is-loading');
    let lastY = 0;
    nav.classList.add('is-scrolled');
    window.addEventListener('scroll', function () {
      const y = window.scrollY;
      nav.classList.toggle('is-hidden', (!menu || menu.hidden) && y > lastY && y > 300);
      lastY = y;
    }, { passive: true });
  }

  /* ------------------------------------------------------------------ *
   * Toast
   * ------------------------------------------------------------------ */
  let toastT = null;
  function toast(msg) {
    const el = $('[data-toast]');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { el.classList.remove('is-on'); }, 2800);
  }

  /* ------------------------------------------------------------------ *
   * Product photos: sized to the photo's own aspect inside a slot, so the
   * CSS edge feather lands on the photo, not on letterboxing
   * ------------------------------------------------------------------ */
  function fitPimg(img) {
    const slot = img.parentElement;
    const W = slot.clientWidth, H = slot.clientHeight;
    const nw = img.naturalWidth || +img.getAttribute('width');
    const nh = img.naturalHeight || +img.getAttribute('height');
    if (!W || !H || !nw || !nh) return;
    const k = Math.min(W / nw, H / nh);
    const w = nw * k, h = nh * k;
    img.style.width = w + 'px';
    img.style.height = h + 'px';
    img.style.left = (W - w) / 2 + 'px';
    img.style.top = (H - h) / 2 + 'px';
  }
  const slotObserver = window.ResizeObserver ? new ResizeObserver(function (entries) {
    entries.forEach(function (e) { $$('.pimg', e.target).forEach(fitPimg); });
  }) : null;

  function wrapPimgs(root) {
    $$('.pimg', root).forEach(function (img) {
      if (img.parentElement.classList.contains('pslot')) return;
      const slot = document.createElement('span');
      slot.className = 'pslot' + (img.classList.contains('pimg--l') ? ' pslot--l' : '') + (img.classList.contains('pimg--r') ? ' pslot--r' : '');
      img.parentNode.insertBefore(slot, img);
      slot.appendChild(img);
      fitPimg(img);
      img.addEventListener('load', function () { fitPimg(img); });
      if (slotObserver) slotObserver.observe(slot);
    });
  }

  function whenLoaded(img) {
    if (img.complete && img.naturalWidth) return Promise.resolve(img);
    return new Promise(function (res) {
      img.addEventListener('load', function () { res(img); }, { once: true });
      img.addEventListener('error', function () { res(null); }, { once: true });
    });
  }

  // Arrow keys move through a role=radiogroup (swatches, sizes)
  function radioKeys(group) {
    if (!group || group.dataset.radioKeys) return;
    group.dataset.radioKeys = '1';
    const items = $$('[role="radio"]', group);
    items.forEach(function (it, i) {
      it.tabIndex = it.getAttribute('aria-checked') === 'true' ? 0 : -1;
      it.addEventListener('keydown', function (e) {
        let n = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % items.length;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + items.length) % items.length;
        if (n === null) return;
        e.preventDefault();
        items.forEach(function (o) { o.tabIndex = -1; });
        items[n].tabIndex = 0;
        items[n].focus();
        items[n].click();
      });
      it.addEventListener('click', function () {
        items.forEach(function (o) { o.tabIndex = -1; });
        it.tabIndex = 0;
      });
    });
    if (!items.some(function (i) { return i.tabIndex === 0; }) && items[0]) items[0].tabIndex = 0;
  }

  /* ------------------------------------------------------------------ *
   * Product cards: colorway switch, the new photo wipes up over the old one
   * ------------------------------------------------------------------ */
  function switchCard(card, swatch) {
    const color = swatch.dataset.color;
    if (card.dataset.color === color) return;
    card.dataset.color = color;
    $$('.swatch', card).forEach(function (s) { s.setAttribute('aria-checked', String(s === swatch)); });
    if (swatch.dataset.url) $$('[data-card-link]', card).forEach(function (a) { a.href = swatch.dataset.url; });
    $$('[data-wish]', card).forEach(function (w) { w.dataset.color = color; });
    const media = $('.pcard__media', card);
    const src = swatch.dataset.image;
    const olds = $$('.pimg:not(.is-out)', media);
    if (!src || !olds.length) return;
    const animate = gsap && !reduced;
    const title = (card.querySelector('.pcard__name') || {}).textContent || '';
    const incoming = olds.map(function (old) {
      old.classList.add('is-out');
      const n = old.cloneNode();
      n.classList.remove('is-out');
      n.removeAttribute('loading');
      n.removeAttribute('style');
      n.alt = title.trim() + ' ' + color.toLowerCase();
      if (swatch.dataset.width) n.setAttribute('width', swatch.dataset.width);
      if (swatch.dataset.height) n.setAttribute('height', swatch.dataset.height);
      if (animate) n.style.clipPath = 'inset(100% 0% 0% 0%)';
      n.src = src;
      old.after(n);
      fitPimg(n);
      n.addEventListener('load', function () { fitPimg(n); });
      return n;
    });
    Promise.all(incoming.map(whenLoaded)).then(function () {
      function done() {
        incoming.forEach(function (n) { n.style.clipPath = ''; });
        olds.forEach(function (o) { o.remove(); });
        card.dispatchEvent(new CustomEvent('vyro:card-switched', { bubbles: true }));
      }
      if (!animate) { done(); return; }
      gsap.to(incoming, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.75, ease: 'power3.inOut', onComplete: done });
      gsap.fromTo(incoming, { yPercent: 4 }, { yPercent: 0, duration: 0.9, ease: 'power3.out' });
    });
  }

  function initCards(root) {
    root = root || document;
    wrapPimgs(root);
    $$('[data-pcard]', root).forEach(function (card) {
      if (card.dataset.ready) return;
      card.dataset.ready = '1';
      $$('.swatch', card).forEach(function (s) {
        s.addEventListener('click', function () { switchCard(card, s); });
      });
      radioKeys($('.swatches', card));
    });
    syncWish(root);
  }

  // Remember where we were when leaving for a product page
  document.addEventListener('click', function (e) {
    const a = e.target.closest('a[href*="/products/"]');
    if (!a) return;
    try { sessionStorage.setItem('vyro-return', JSON.stringify({ path: location.pathname, y: window.scrollY })); } catch (err) { /* storage off */ }
  });

  /* ------------------------------------------------------------------ *
   * Wishlist: saved per customer in this browser (Shopify has no native
   * wishlist; hearts ask signed-out shoppers to log in first)
   * ------------------------------------------------------------------ */
  const WISH_KEY = 'vyro-wishlist-' + (T.customer ? T.customer.id : 'guest');
  const PENDING_KEY = 'vyro-wish-pending';
  function readWish() {
    try { return JSON.parse(localStorage.getItem(WISH_KEY) || '[]') || []; } catch (e) { return []; }
  }
  function writeWish(list) {
    try { localStorage.setItem(WISH_KEY, JSON.stringify(list)); } catch (e) { /* storage off */ }
    window.dispatchEvent(new CustomEvent('vyro:wishlist'));
  }
  function isWished(handle) { return readWish().some(function (w) { return w.handle === handle; }); }
  function toggleWish(item) {
    const list = readWish();
    const i = list.findIndex(function (w) { return w.handle === item.handle; });
    if (i > -1) list.splice(i, 1);
    else list.unshift({ handle: item.handle, color: item.color || '', title: item.title || '', added: Date.now() });
    writeWish(list);
    const on = i < 0;
    toast((item.title ? item.title + ' ' : '') + (on ? strings.wishSaved : strings.wishRemoved));
    return on;
  }
  function syncWish(root) {
    const list = readWish();
    $$('[data-wish]', root || document).forEach(function (b) {
      const on = list.some(function (w) { return w.handle === b.dataset.handle; });
      b.setAttribute('aria-pressed', String(on));
    });
  }
  window.addEventListener('vyro:wishlist', function () { syncWish(); });
  window.addEventListener('storage', function (e) { if (e.key === WISH_KEY) syncWish(); });

  const authRoot = $('[data-auth]');
  const authDlg = authRoot ? dialog(authRoot, function () { return $('.modal__panel', authRoot); }) : null;
  if (authRoot) $$('[data-auth-close]', authRoot).forEach(function (b) { b.addEventListener('click', authDlg.close); });

  function openAuth(item) {
    if (!authDlg) { location.href = routes.login; return; }
    try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(item)); } catch (e) { /* storage off */ }
    const back = location.pathname + location.search;
    $$('[data-auth-login], [data-auth-register]', authRoot).forEach(function (a) {
      const u = new URL(a.getAttribute('href'), location.origin);
      u.searchParams.set('return_url', back);
      a.href = u.pathname + u.search;
    });
    authDlg.open();
    setTimeout(function () { const f = $('[data-auth-register]', authRoot); if (f) f.focus(); }, 60);
  }

  document.addEventListener('click', function (e) {
    const b = e.target.closest('[data-wish]');
    if (!b) return;
    e.preventDefault();
    const item = { handle: b.dataset.handle, color: b.dataset.color, title: b.dataset.title };
    if (T.customer) toggleWish(item); else openAuth(item);
  });

  // A heart tapped before logging in is saved once the shopper is signed in
  if (T.customer) {
    try {
      const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null');
      sessionStorage.removeItem(PENDING_KEY);
      if (pending && pending.handle && !isWished(pending.handle)) toggleWish(pending);
    } catch (e) { /* storage off */ }
  }

  /* ------------------------------------------------------------------ *
   * Cart: AJAX add / change, drawer and cart page re-rendered by Shopify
   * ------------------------------------------------------------------ */
  const drawerRoot = $('[data-drawer]');
  const drawerPanel = function () { return $('.drawer__panel', drawerRoot); };
  const drawer = drawerRoot ? dialog(drawerRoot, drawerPanel) : null;
  if (drawerRoot) {
    drawerRoot.addEventListener('click', function (e) { if (e.target.closest('[data-drawer-close]')) drawer.close(); });
  }

  function cartSections() {
    const ids = [];
    if (drawerRoot) ids.push('cart-drawer');
    const page = $('[data-cart][data-section]');
    if (page) ids.push(page.dataset.section);
    return ids;
  }

  function parse(html) { return new DOMParser().parseFromString(html, 'text/html'); }

  function renderCount(count, bump) {
    $$('[data-bag-count]').forEach(function (el) { el.textContent = String(count); });
    if (bump) $$('[data-bag]').forEach(function (b) {
      b.classList.add('bump');
      setTimeout(function () { b.classList.remove('bump'); }, 600);
    });
  }

  function renderSections(sections) {
    if (!sections) return;
    let count = null;
    if (sections['cart-drawer'] && drawerRoot) {
      const fresh = $('[data-drawer]', parse(sections['cart-drawer']));
      if (fresh) {
        const hadFocus = drawerRoot.contains(document.activeElement);
        drawerPanel().innerHTML = $('.drawer__panel', fresh).innerHTML;
        drawerRoot.dataset.cartCount = fresh.dataset.cartCount;
        count = +fresh.dataset.cartCount;
        if (hadFocus && !drawerRoot.hidden) drawerPanel().focus();
      }
    }
    const page = $('[data-cart][data-section]');
    if (page && sections[page.dataset.section]) {
      const fresh = $('[data-cart]', parse(sections[page.dataset.section]));
      if (fresh) {
        page.innerHTML = fresh.innerHTML;
        if (window.Shopify && window.Shopify.PaymentButton) window.Shopify.PaymentButton.init();
      }
    }
    return count;
  }

  function cartFetch(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || j.status) throw new Error(j.description || j.message || strings.cartError);
        return j;
      });
    });
  }

  function openDrawer() {
    if (!drawer) { location.href = routes.cart; return; }
    drawer.open();
    setTimeout(function () { drawerPanel().focus(); }, 60);
  }

  // items: [{ id, quantity, properties }]
  function addToCart(items) {
    const sections = cartSections();
    return cartFetch(routes.cartAdd + '.js', { items: items, sections: sections, sections_url: location.pathname })
      .then(function (res) {
        if (T.cartType === 'page') { location.href = routes.cart; return res; }
        let count = renderSections(res.sections);
        if (count === null) {
          return fetch(routes.cart + '.js').then(function (r) { return r.json(); }).then(function (c) {
            renderCount(c.item_count, true); openDrawer(); return res;
          });
        }
        renderCount(count, true);
        openDrawer();
        return res;
      });
  }

  function changeLine(key, quantity) {
    const sections = cartSections();
    return cartFetch(routes.cartChange + '.js', { id: key, quantity: quantity, sections: sections, sections_url: location.pathname })
      .then(function (res) {
        renderSections(res.sections);
        renderCount(res.item_count, false);
        return res;
      });
  }

  // One delegated handler for quantity / remove on any bag list
  document.addEventListener('click', function (e) {
    const q = e.target.closest('[data-line-qty]');
    const r = e.target.closest('[data-line-remove]');
    const line = e.target.closest('[data-line-key]');
    if (!line || (!q && !r)) return;
    e.preventDefault();
    const current = parseInt(($('.qty__value', line) || {}).textContent, 10) || 1;
    const name = ($('.line__name', line) || {}).textContent || '';
    const next = r ? 0 : Math.max(0, current + (+q.dataset.lineQty));
    line.classList.add('is-busy');
    changeLine(line.dataset.lineKey, next).then(function () {
      if (r) toast(name.trim() + ' ' + strings.removed);
    }, function (err) {
      line.classList.remove('is-busy');
      toast(err.message || strings.cartError);
    });
  });

  // Cart page order note
  document.addEventListener('change', function (e) {
    if (!e.target.matches('#cart-note')) return;
    cartFetch(routes.cartUpdate + '.js', { note: e.target.value }).catch(function () { /* saved on checkout anyway */ });
  });

  const bag = $('[data-bag]');
  if (bag && drawer && T.cartType !== 'page' && T.template !== 'cart') {
    bag.addEventListener('click', function (e) { e.preventDefault(); openDrawer(); });
  }

  /* ------------------------------------------------------------------ *
   * Search overlay: Shopify predictive search
   * ------------------------------------------------------------------ */
  const searchRoot = $('[data-search]');
  if (searchRoot) {
    const searchDlg = dialog(searchRoot, function () { return $('.search__panel', searchRoot); });
    const input = $('[data-search-input]', searchRoot);
    const results = $('[data-search-results]', searchRoot);
    const status = $('[data-search-status]', searchRoot);
    const all = $('[data-search-all]', searchRoot);
    let timer = null, ctrl = null;

    const runSearch = function () {
      const q = input.value.trim();
      $('[data-search-suggest]', searchRoot).hidden = !!q;
      all.hidden = !q;
      all.href = routes.search + '?type=product&q=' + encodeURIComponent(q);
      if (ctrl) ctrl.abort();
      if (!q) { results.innerHTML = ''; status.textContent = ''; return; }
      ctrl = window.AbortController ? new AbortController() : null;
      const url = routes.predictiveSearch + '?q=' + encodeURIComponent(q) +
        '&resources[type]=product&resources[limit]=8&resources[options][unavailable_products]=last&section_id=predictive-search';
      fetch(url, ctrl ? { signal: ctrl.signal } : {}).then(function (r) { return r.text(); }).then(function (html) {
        const doc = parse(html);
        const minis = $$('.mini', doc);
        results.innerHTML = minis.map(function (m) { return m.outerHTML; }).join('');
        status.textContent = minis.length
          ? String(strings.searchCount || '[count]').replace('[count]', minis.length)
          : String(strings.searchNone || '').replace('[terms]', q);
      }).catch(function () { /* aborted or offline */ });
    };
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(runSearch, 160); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { const f = $('a', results); if (f) { e.preventDefault(); f.focus(); } }
    });
    results.addEventListener('keydown', function (e) {
      const items = $$('a', results);
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' && i < items.length - 1) { e.preventDefault(); items[i + 1].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? items[i - 1] : input).focus(); }
    });
    $$('[data-search-term]', searchRoot).forEach(function (b) {
      b.addEventListener('click', function () { input.value = b.dataset.searchTerm; runSearch(); input.focus(); });
    });
    const openSearch = function () {
      setMenu(false);
      searchDlg.open();
      setTimeout(function () { input.focus(); input.select(); }, 50);
    };
    $$('[data-search-open]').forEach(function (b) { b.addEventListener('click', openSearch); });
    $$('[data-search-close]', searchRoot).forEach(function (b) { b.addEventListener('click', searchDlg.close); });
    document.addEventListener('keydown', function (e) {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
      if (!typing && (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'))) { e.preventDefault(); openSearch(); }
    });
  }

  /* ------------------------------------------------------------------ *
   * Init + theme editor
   * ------------------------------------------------------------------ */
  initCards(document);
  wrapPimgs(document);

  document.addEventListener('shopify:section:load', function (e) { initCards(e.target); });

  window.Vyro = {
    $: $, $$: $$, esc: esc, reduced: reduced, lenis: lenis,
    lock: lock, onLock: function (fn) { lockers.push(fn); }, dialog: dialog,
    scrollTo: scrollToY, closeMenu: function () { setMenu(false); },
    toast: toast, money: formatMoney,
    fitPimg: fitPimg, wrapPimgs: wrapPimgs, whenLoaded: whenLoaded, radioKeys: radioKeys,
    initCards: initCards, switchCard: switchCard,
    wishlist: readWish, isWished: isWished, toggleWish: toggleWish, syncWish: syncWish,
    addToCart: addToCart, changeLine: changeLine, openDrawer: openDrawer, renderCount: renderCount
  };
  document.dispatchEvent(new CustomEvent('vyro:ready'));
})();

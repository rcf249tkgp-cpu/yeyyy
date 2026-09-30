/*
  VYRO customer pages: account tabs (addressable as /account#orders,
  #wishlist, #addresses, #settings), the wishlist grid, the log in /
  password recovery switch and the address book forms.
*/
(function () {
  'use strict';

  const V = window.Vyro;
  const $ = V.$, $$ = V.$$;
  const gsap = window.gsap;
  let wishToken = 0;

  /* ------------------------------------------------------------------ *
   * Log in page: switch between log in and password recovery
   * ------------------------------------------------------------------ */
  const auth = $('[data-auth-root]');
  if (auth) {
    const view = function (v) {
      auth.dataset.view = v;
      const f = $('[data-form="' + v + '"] input[type="email"]', auth);
      if (f) setTimeout(function () { f.focus(); }, 30);
    };
    $$('[data-auth-view]', auth).forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        view(b.dataset.authView);
        history.replaceState(null, '', b.dataset.authView === 'forgot' ? '#recover' : location.pathname + location.search);
      });
    });
    if (location.hash === '#recover' || $('[data-recover-success]', auth) || $('[data-form="forgot"] .form__error', auth)) auth.dataset.view = 'forgot';
  }

  /* ------------------------------------------------------------------ *
   * Account tabs
   * ------------------------------------------------------------------ */
  const account = $('[data-account]');
  if (account) {
    const names = $$('[data-tab]', account).map(function (t) { return t.dataset.tab; });
    const fromHash = function () {
      const h = location.hash.slice(1);
      return names.indexOf(h) > -1 ? h : 'profile';
    };
    const show = function (tab, focus) {
      $$('[data-tab]', account).forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.tab === tab)); });
      $$('[data-panel]', account).forEach(function (p) { p.hidden = p.dataset.panel !== tab; });
      const panel = $('[data-panel="' + tab + '"]', account);
      if (tab === 'wishlist') renderWishlist();
      if (focus && panel) panel.focus({ preventScroll: true });
      if (panel && gsap && !V.reduced) gsap.from(panel.children, { y: 16, opacity: 0, duration: 0.5, stagger: 0.04, ease: 'power3.out', clearProps: 'all' });
    };
    account.addEventListener('click', function (e) {
      const t = e.target.closest('[data-tab]');
      if (!t) return;
      e.preventDefault();
      history.replaceState(null, '', '#' + t.dataset.tab);
      show(t.dataset.tab, true);
    });
    // Arrow keys move between tabs
    $('.acct__tabs', account).addEventListener('keydown', function (e) {
      const tabs = $$('[data-tab]', account);
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      let n = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % tabs.length;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + tabs.length) % tabs.length;
      if (n === null) return;
      e.preventDefault();
      tabs[n].focus();
      tabs[n].click();
    });
    window.addEventListener('hashchange', function () { show(fromHash(), false); });
    window.addEventListener('vyro:wishlist', function () { if (fromHash() === 'wishlist') renderWishlist(); });
    show(fromHash(), false);
  }

  /* ------------------------------------------------------------------ *
   * Wishlist: cards rendered by Shopify for each saved product
   * ------------------------------------------------------------------ */
  function renderWishlist() {
    const grid = $('[data-wish-grid]');
    const empty = $('[data-wish-empty]');
    const count = $('[data-wish-count]');
    if (!grid) return;
    const list = V.wishlist();
    if (count) count.textContent = list.length ? '(' + list.length + ')' : '';
    if (empty) empty.hidden = list.length > 0;
    const token = ++wishToken;
    if (!list.length) { grid.innerHTML = ''; return; }
    const root = (window.VyroTheme && window.VyroTheme.routes && window.VyroTheme.routes.root) || '/';
    Promise.all(list.map(function (item) {
      return fetch(root.replace(/\/$/, '') + '/products/' + encodeURIComponent(item.handle) + '?section_id=wishlist-card')
        .then(function (r) { return r.ok ? r.text() : ''; })
        .then(function (html) {
          const card = html && $('[data-pcard]', new DOMParser().parseFromString(html, 'text/html'));
          return card ? { card: card, color: item.color } : null;
        })
        .catch(function () { return null; });
    })).then(function (cards) {
      if (token !== wishToken) return;
      cards = cards.filter(Boolean);
      grid.innerHTML = '';
      cards.forEach(function (c) { grid.appendChild(document.importNode(c.card, true)); });
      if (empty) empty.hidden = cards.length > 0;
      V.initCards(grid);
      // Show each piece in the colorway it was saved in
      $$('[data-pcard]', grid).forEach(function (card, i) {
        const want = cards[i] && cards[i].color;
        if (!want) return;
        const sw = $$('.swatch', card).filter(function (s) { return s.dataset.color === want; })[0];
        if (sw) V.switchCard(card, sw);
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Address book
   * ------------------------------------------------------------------ */
  const book = $('[data-addresses]');
  if (book) {
    const toggle = function (id, open) {
      const panel = document.getElementById(id === 'new' ? 'add-address' : 'edit-' + id);
      if (!panel) return;
      panel.hidden = !open;
      const btn = id === 'new' ? $('[data-addr-add]', book) : $('[data-addr-edit="' + id + '"]', book);
      if (btn) btn.setAttribute('aria-expanded', String(open));
      if (open) { const f = $('input:not([type="hidden"])', panel); if (f) f.focus(); }
    };
    book.addEventListener('click', function (e) {
      const edit = e.target.closest('[data-addr-edit]');
      const add = e.target.closest('[data-addr-add]');
      const cancel = e.target.closest('[data-addr-cancel]');
      if (edit) toggle(edit.dataset.addrEdit, edit.getAttribute('aria-expanded') !== 'true');
      if (add) toggle('new', add.getAttribute('aria-expanded') !== 'true');
      if (cancel) toggle(cancel.dataset.addrCancel, false);
    });
    $$('[data-addr-delete]', book).forEach(function (f) {
      f.addEventListener('submit', function (e) { if (!window.confirm(f.dataset.confirm)) e.preventDefault(); });
    });
    // Pre-select each saved country
    $$('select[data-default]', book).forEach(function (s) {
      const v = s.dataset.default;
      if (!v) return;
      const opt = $$('option', s).filter(function (o) { return o.value === v || o.textContent.trim() === v; })[0];
      if (opt) s.value = opt.value;
    });
    // Reopen a form that came back with errors
    $$('.addr-form', book).forEach(function (f) {
      if ($('.form__error', f)) { const p = f.closest('[hidden]'); if (p) p.hidden = false; }
    });
  }
})();

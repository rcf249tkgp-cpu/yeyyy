/*
  VYRO site chrome, shared by every page:
  header (search, account, bag), mobile menu, footer, toast,
  cart drawer, search overlay, log in / create account modal and the
  wishlist hearts on product cards.

  Pages place <div data-chrome-header></div> and <div data-chrome-footer></div>
  and set <body data-page="home|product|shop|cart|account">.
*/
(function () {
  const I18n = window.VyroI18n;
  const t = I18n.t;
  // Static page text (data-i18n) first, before any page script reads it
  I18n.apply(document);
  const Shop = window.VyroShop;
  const Account = window.VyroAccount;
  const esc = Shop.esc;
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  const page = document.body.dataset.page || 'home';
  const home = page === 'home' ? '' : 'index.html';

  /* ------------------------------------------------------------------ *
   * Scroll lock (pages with Lenis subscribe via VyroChrome.onLock)
   * ------------------------------------------------------------------ */
  const lockers = [];
  let locks = 0;
  function lock(on) {
    locks = Math.max(0, locks + (on ? 1 : -1));
    document.documentElement.classList.toggle('is-locked', locks > 0);
    lockers.forEach(function (fn) { fn(locks > 0); });
  }

  // Keep keyboard focus inside an open dialog
  function trap(panel, e) {
    if (e.key !== 'Tab') return;
    const f = $$('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])', panel)
      .filter(function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  const icon = {
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
    user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c1.2-3.9 4-5.8 7.5-5.8s6.3 1.9 7.5 5.8"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>'
  };

  /* ------------------------------------------------------------------ *
   * Header, menu, footer
   * ------------------------------------------------------------------ */
  const links = [
    ['shop.html', t('nav.shop')],
    [home + '#drop', t('nav.drop')],
    [home + '#story', t('nav.why')],
    [home + '#community', t('nav.community')]
  ];
  function navLinks() {
    return links.map(function (l) {
      const current = (page === 'shop' && l[0] === 'shop.html') ? ' aria-current="page"' : '';
      return '<a href="' + l[0] + '"' + current + '>' + l[1] + '</a>';
    }).join('');
  }

  const headerHTML =
    '<header class="nav" data-nav>' +
      '<a class="nav__logo" href="' + (home || '#top') + '" aria-label="' + t('nav.homeLink') + '"><img src="assets/logo/vyro-logo.png" alt="VYRO" width="1300" height="662"></a>' +
      '<nav class="nav__links" aria-label="' + t('nav.primary') + '">' + navLinks() + '</nav>' +
      '<div class="nav__actions">' +
        I18n.switcherHTML('lang--nav') +
        '<button class="nav__icon" type="button" data-search-open aria-label="' + t('nav.search') + '">' + icon.search + '</button>' +
        '<a class="nav__icon nav__account" href="account.html" data-account-link aria-label="' + t('nav.accountSignedOut') + '">' + icon.user + '<span data-account-label></span></a>' +
        '<button class="nav__bag" type="button" data-bag aria-haspopup="dialog" aria-label="' + t('nav.bagOpen') + '">' + t('nav.bag') + ' <span data-bag-count>0</span></button>' +
        '<button class="nav__menu" type="button" aria-expanded="false" aria-controls="mobile-menu" data-menu-toggle>' +
          '<span class="sr-only">' + t('nav.menu') + '</span><span class="nav__menu-bar"></span><span class="nav__menu-bar"></span>' +
        '</button>' +
      '</div>' +
    '</header>' +
    '<div class="mobile-menu" id="mobile-menu" hidden data-menu>' +
      '<nav aria-label="' + t('nav.mobile') + '">' + navLinks() +
        '<a href="account.html">' + t('nav.account') + '</a>' +
        '<a href="' + home + '#join">' + t('nav.dropAlerts') + '</a>' +
      '</nav>' +
      I18n.switcherHTML('lang--menu') +
    '</div>';

  const footerHTML =
    '<footer class="footer">' +
      '<div class="footer__logo" aria-hidden="true"><img src="assets/logo/vyro-logo.png" alt="" width="1300" height="662" loading="lazy"></div>' +
      '<div class="footer__cols">' +
        '<div><h3>' + t('footer.shop') + '</h3><ul><li><a href="shop.html">' + t('footer.allProducts') + '</a></li><li><a href="shop.html?new=1">' + t('footer.newArrivals') + '</a></li><li><a href="' + home + '#drop">' + t('footer.drop') + '</a></li><li><a href="cart.html">' + t('footer.bag') + '</a></li></ul></div>' +
        '<div><h3>' + t('footer.account') + '</h3><ul><li><a href="account.html">' + t('footer.myAccount') + '</a></li><li><a href="account.html#orders">' + t('footer.orders') + '</a></li><li><a href="account.html#wishlist">' + t('footer.wishlist') + '</a></li></ul></div>' +
        '<div><h3>' + t('footer.follow') + '</h3><ul><li><a href="https://instagram.com/" rel="noopener" target="_blank">Instagram</a></li><li><a href="https://tiktok.com/" rel="noopener" target="_blank">TikTok</a></li></ul></div>' +
      '</div>' +
      '<p class="footer__legal">' + t('footer.legal') + '</p>' +
    '</footer>';

  function mount(sel, html) {
    const el = $(sel);
    if (el) el.outerHTML = html;
  }
  mount('[data-chrome-header]', headerHTML);
  mount('[data-chrome-footer]', footerHTML);

  document.body.insertAdjacentHTML('beforeend',
    '<div class="toast" role="status" aria-live="polite" data-toast></div>' +

    // Cart drawer
    '<div class="drawer" data-drawer hidden>' +
      '<div class="drawer__scrim" data-drawer-close></div>' +
      '<section class="drawer__panel" role="dialog" aria-modal="true" aria-labelledby="drawer-title" tabindex="-1" data-lenis-prevent>' +
        '<header class="drawer__head">' +
          '<h2 class="drawer__title display" id="drawer-title">' + t('drawer.title') + ' <span data-drawer-count></span></h2>' +
          '<button class="icon-btn" type="button" data-drawer-close aria-label="' + t('drawer.close') + '">' + icon.close + '</button>' +
        '</header>' +
        '<div class="ship-meter" data-ship></div>' +
        '<div class="drawer__body" data-drawer-items></div>' +
        '<footer class="drawer__foot" data-drawer-foot>' +
          '<div class="drawer__row"><span>' + t('common.subtotal') + '</span><strong data-drawer-subtotal></strong></div>' +
          '<p class="drawer__note">' + t('drawer.note') + '</p>' +
          '<div class="drawer__ctas">' +
            '<a class="btn btn--ghost" href="cart.html">' + t('drawer.viewCart') + '</a>' +
            '<a class="btn btn--solid" href="cart.html?checkout=1">' + t('common.checkout') + '</a>' +
          '</div>' +
        '</footer>' +
      '</section>' +
    '</div>' +

    // Search
    '<div class="search" data-search hidden>' +
      '<div class="search__scrim" data-search-close></div>' +
      '<section class="search__panel" role="dialog" aria-modal="true" aria-label="' + t('search.label') + '" data-lenis-prevent>' +
        '<form class="search__bar" role="search" action="shop.html" data-search-form>' +
          icon.search +
          '<label class="sr-only" for="site-search">' + t('search.label') + '</label>' +
          '<input id="site-search" name="q" type="search" autocomplete="off" spellcheck="false" placeholder="' + esc(t('search.placeholder')) + '" data-search-input aria-controls="search-results" aria-describedby="search-status">' +
          '<button class="icon-btn" type="button" data-search-close aria-label="' + t('search.close') + '">' + icon.close + '</button>' +
        '</form>' +
        '<div class="search__body">' +
          '<div class="search__suggest" data-search-suggest>' +
            '<p class="search__label">' + t('search.popular') + '</p>' +
            '<div class="chips">' + I18n.raw('search.chips').map(function (term) {
              return '<button type="button" class="chip" data-search-term="' + esc(term) + '">' + esc(term) + '</button>';
            }).join('') + '</div>' +
          '</div>' +
          '<p class="search__status" id="search-status" role="status" aria-live="polite" data-search-status></p>' +
          '<div class="search__results" id="search-results" data-search-results></div>' +
          '<a class="btn btn--ghost search__all" href="shop.html" data-search-all hidden>' + t('search.viewAll') + '</a>' +
        '</div>' +
      '</section>' +
    '</div>' +

    // Log in / create account
    '<div class="modal" data-auth hidden>' +
      '<div class="modal__scrim" data-auth-close></div>' +
      '<section class="modal__panel" role="dialog" aria-modal="true" aria-labelledby="auth-title" data-lenis-prevent>' +
        '<button class="icon-btn modal__close" type="button" data-auth-close aria-label="' + t('common.close') + '">' + icon.close + '</button>' +
        '<h2 class="modal__title display" id="auth-title" data-auth-title>' + t('auth.title') + '</h2>' +
        '<p class="modal__lede" data-auth-lede></p>' +
        '<div data-auth-forms></div>' +
      '</section>' +
    '</div>'
  );

  /* ------------------------------------------------------------------ *
   * Mobile menu + account label
   * ------------------------------------------------------------------ */
  const nav = $('[data-nav]');
  const menuBtn = $('[data-menu-toggle]');
  const menu = $('[data-menu]');
  function setMenu(open) {
    if (open === !menu.hidden) return;
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    nav.classList.remove('is-hidden');
    lock(open);
  }
  menuBtn.addEventListener('click', function () { setMenu(menu.hidden); });
  $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });

  function renderAccountLabel() {
    const u = Account.user();
    const label = $('[data-account-label]');
    const link = $('[data-account-link]');
    label.textContent = u ? u.name.split(' ')[0] : '';
    link.setAttribute('aria-label', u ? t('nav.accountSignedIn', { name: u.name }) : t('nav.accountSignedOut'));
    link.classList.toggle('is-in', !!u);
  }
  window.addEventListener('vyro:auth', renderAccountLabel);

  /* ------------------------------------------------------------------ *
   * Generic dialog open/close with focus return
   * ------------------------------------------------------------------ */
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
    root.addEventListener('keydown', function (e) { trap(panel, e); });
    // Escape closes the dialog even if focus was lost to a re-render
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !root.hidden) d.close();
    });
    return d;
  }

  /* ------------------------------------------------------------------ *
   * Bag line component (drawer + cart page)
   * ------------------------------------------------------------------ */
  function lineHTML(item) {
    const p = item.product;
    const href = Shop.url(p.slug, item.color);
    return '' +
      '<article class="line" data-line="' + item.index + '">' +
        '<a class="line__img" href="' + href + '" tabindex="-1" aria-hidden="true"><img src="' + Shop.thumb(p, item.color) + '" alt=""></a>' +
        '<div class="line__info">' +
          '<a class="line__name" href="' + href + '">' + esc(p.name) + '</a>' +
          '<p class="line__meta">' + esc(Shop.colorName(item.color) + ' / ' + item.size) + '</p>' +
          '<p class="line__unit">' + Shop.money(item.unit) + '</p>' +
          '<div class="line__controls">' +
            '<div class="qty qty--sm" role="group" aria-label="' + esc(t('common.quantityFor', { name: p.name })) + '">' +
              '<button type="button" class="qty__btn" data-line-qty="-1" aria-label="' + t('common.decrease') + '"' + (item.qty <= 1 ? ' disabled' : '') + '>−</button>' +
              '<span class="qty__value" aria-live="polite">' + item.qty + '</span>' +
              '<button type="button" class="qty__btn" data-line-qty="1" aria-label="' + t('common.increase') + '"' + (item.qty >= 10 ? ' disabled' : '') + '>+</button>' +
            '</div>' +
            '<button type="button" class="line__remove" data-line-remove>' + t('common.remove') + '</button>' +
          '</div>' +
        '</div>' +
        '<p class="line__total">' + Shop.money(item.line) + '</p>' +
      '</article>';
  }
  // One delegated handler for quantity / remove on any bag list
  document.addEventListener('click', function (e) {
    const q = e.target.closest('[data-line-qty]');
    const r = e.target.closest('[data-line-remove]');
    const line = e.target.closest('[data-line]');
    if (!line || (!q && !r)) return;
    const index = +line.dataset.line;
    const item = Shop.bagItems()[index];
    if (!item) return;
    if (q) Shop.setQty(index, item.qty + (+q.dataset.lineQty));
    if (r) { Shop.removeItem(index); Shop.toast(t('drawer.removed', { name: item.product.name })); }
  });

  function shipHTML() {
    const tot = Shop.totals();
    if (!Shop.bagCount()) return '';
    const pct = Math.min(100, (tot.subtotal / Shop.FREE_SHIPPING) * 100);
    return '<p>' + (tot.toFree > 0 ? t('ship.remaining_html', { amount: Shop.money(tot.toFree) }) : t('ship.unlocked_html')) + '</p>' +
      '<div class="ship-meter__bar"><i style="width:' + pct + '%"></i></div>';
  }

  /* ------------------------------------------------------------------ *
   * Cart drawer
   * ------------------------------------------------------------------ */
  const drawerRoot = $('[data-drawer]');
  const drawerPanel = $('.drawer__panel', drawerRoot);
  const drawer = dialog(drawerRoot, drawerPanel);

  function renderDrawer() {
    const items = Shop.bagItems();
    const count = Shop.bagCount();
    $('[data-drawer-count]').textContent = count ? '(' + count + ')' : '';
    $('[data-ship]').innerHTML = shipHTML();
    $('[data-drawer-items]').innerHTML = items.length
      ? items.map(lineHTML).join('')
      : '<div class="empty"><p class="empty__title display">' + t('drawer.emptyTitle') + '</p><p>' + t('drawer.emptyText') + '</p><a class="btn btn--solid" href="shop.html">' + t('drawer.emptyCta') + '</a></div>';
    $('[data-drawer-foot]').hidden = !items.length;
    $('[data-drawer-subtotal]').textContent = Shop.money(Shop.totals().subtotal);
    // Keep focus inside the drawer when the control that had it was re-rendered
    if (!drawerRoot.hidden && (!document.activeElement || document.activeElement === document.body)) drawerPanel.focus();
  }
  window.addEventListener('vyro:bag', renderDrawer);
  window.addEventListener('vyro:added', function () {
    renderDrawer();
    drawer.open();
    setTimeout(function () { drawerPanel.focus(); }, 60);
  });
  $('[data-bag]').addEventListener('click', function () {
    renderDrawer();
    drawer.open();
    setTimeout(function () { drawerPanel.focus(); }, 60);
  });
  $$('[data-drawer-close]', drawerRoot).forEach(function (b) { b.addEventListener('click', drawer.close); });

  /* ------------------------------------------------------------------ *
   * Search
   * ------------------------------------------------------------------ */
  const searchRoot = $('[data-search]');
  const searchPanel = $('.search__panel', searchRoot);
  const searchDlg = dialog(searchRoot, searchPanel);
  const input = $('[data-search-input]');
  const results = $('[data-search-results]');
  const status = $('[data-search-status]');
  const all = $('[data-search-all]');

  function runSearch() {
    const q = input.value.trim();
    $('[data-search-suggest]').hidden = !!q;
    all.hidden = !q;
    all.href = 'shop.html?q=' + encodeURIComponent(q);
    if (!q) { results.innerHTML = ''; status.textContent = ''; return; }
    const hits = Shop.search(q);
    status.textContent = hits.length ? t('search.found', { count: hits.length }) : t('search.none', { q: q });
    results.innerHTML = hits.map(function (h) { return Shop.miniHTML(h.product, h.color); }).join('');
  }
  input.addEventListener('input', runSearch);
  $('[data-search-form]').addEventListener('submit', function (e) {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    const hits = Shop.search(q);
    location.href = hits.length === 1 ? Shop.url(hits[0].product.slug, hits[0].color) : 'shop.html?q=' + encodeURIComponent(q);
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { const f = $('a', results); if (f) { e.preventDefault(); f.focus(); } }
  });
  results.addEventListener('keydown', function (e) {
    const items = $$('a', results);
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' && i < items.length - 1) { e.preventDefault(); items[i + 1].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? items[i - 1] : input).focus(); }
  });
  $$('[data-search-term]').forEach(function (b) {
    b.addEventListener('click', function () { input.value = b.dataset.searchTerm; runSearch(); input.focus(); });
  });
  function openSearch() {
    searchDlg.open();
    setTimeout(function () { input.focus(); input.select(); }, 50);
  }
  $('[data-search-open]').addEventListener('click', openSearch);
  $$('[data-search-close]', searchRoot).forEach(function (b) { b.addEventListener('click', searchDlg.close); });
  document.addEventListener('keydown', function (e) {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (!typing && (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'))) { e.preventDefault(); openSearch(); }
  });

  /* ------------------------------------------------------------------ *
   * Auth forms (modal + account page)
   * ------------------------------------------------------------------ */
  function field(id, label, type, attrs) {
    return '<div class="field"><label for="' + id + '">' + label + '</label>' +
      '<input id="' + id + '" name="' + id.split('-').pop() + '" type="' + type + '" ' + (attrs || '') + '>' +
      '<p class="field__error" data-error-for="' + id.split('-').pop() + '"></p></div>';
  }
  function modeNote() {
    return Account.mode === 'local'
      ? '<p class="mode-note">' + t('auth.modeNote') + '</p>'
      : '';
  }
  function authHTML(prefix, view) {
    view = view || 'login';
    return '' +
      '<div class="auth" data-auth-root data-view="' + view + '">' +
        '<div class="auth__tabs" role="tablist" aria-label="' + t('auth.tabs') + '">' +
          '<button type="button" role="tab" class="auth__tab" data-auth-view="login">' + t('auth.login') + '</button>' +
          '<button type="button" role="tab" class="auth__tab" data-auth-view="register">' + t('auth.register') + '</button>' +
        '</div>' +
        '<form class="auth__form" data-form="login" novalidate>' +
          field(prefix + '-login-email', t('auth.email'), 'email', 'autocomplete="email" required') +
          field(prefix + '-login-password', t('auth.password'), 'password', 'autocomplete="current-password" required') +
          '<p class="form__error" data-form-error role="alert"></p>' +
          '<button class="btn btn--solid auth__submit" type="submit">' + t('auth.login') + '</button>' +
          '<button class="link-btn" type="button" data-auth-view="forgot">' + t('auth.forgot') + '</button>' +
        '</form>' +
        '<form class="auth__form" data-form="register" novalidate>' +
          field(prefix + '-reg-name', t('auth.fullName'), 'text', 'autocomplete="name" required') +
          field(prefix + '-reg-email', t('auth.email'), 'email', 'autocomplete="email" required') +
          field(prefix + '-reg-password', t('auth.password'), 'password', 'autocomplete="new-password" minlength="8" required aria-describedby="' + prefix + '-pw-hint"') +
          '<p class="field__hint" id="' + prefix + '-pw-hint">' + t('auth.pwHint') + '</p>' +
          '<label class="check"><input type="checkbox" name="marketing"> <span>' + t('auth.marketing') + '</span></label>' +
          '<p class="form__error" data-form-error role="alert"></p>' +
          '<button class="btn btn--solid auth__submit" type="submit">' + t('auth.register') + '</button>' +
        '</form>' +
        '<form class="auth__form" data-form="forgot" novalidate>' +
          '<p class="auth__text">' + t('auth.forgotText') + '</p>' +
          field(prefix + '-forgot-email', t('auth.email'), 'email', 'autocomplete="email" required') +
          '<p class="form__error" data-form-error role="alert"></p>' +
          '<p class="form__ok" data-form-ok role="status"></p>' +
          '<button class="btn btn--solid auth__submit" type="submit">' + t('auth.sendLink') + '</button>' +
          '<button class="link-btn" type="button" data-auth-view="login">' + t('auth.backToLogin') + '</button>' +
        '</form>' +
        modeNote() +
      '</div>';
  }

  function showErrors(form, err) {
    $$('.field__error', form).forEach(function (el) { el.textContent = ''; });
    $$('input', form).forEach(function (i) { i.removeAttribute('aria-invalid'); });
    $('[data-form-error]', form).textContent = '';
    if (!err) return;
    const target = err.field && $('[data-error-for="' + err.field + '"]', form);
    if (target) {
      target.textContent = err.message;
      const inp = target.previousElementSibling;
      if (inp) { inp.setAttribute('aria-invalid', 'true'); inp.focus(); }
    } else {
      $('[data-form-error]', form).textContent = err.message;
    }
  }
  function busy(form, on, label) {
    const b = $('[type="submit"]', form);
    if (on) { b.dataset.label = b.textContent; b.textContent = label; b.disabled = true; }
    else { b.textContent = b.dataset.label || b.textContent; b.disabled = false; }
  }

  function bindAuth(root, opts) {
    opts = opts || {};
    const auth = $('[data-auth-root]', root);
    function view(v) {
      auth.dataset.view = v;
      $$('[data-auth-view]', auth).forEach(function (t) { if (t.getAttribute('role') === 'tab') t.setAttribute('aria-selected', String(t.dataset.authView === v)); });
      const f = $('[data-form="' + v + '"] input', auth);
      if (f && opts.focus !== false) setTimeout(function () { f.focus(); }, 30);
    }
    $$('[data-auth-view]', auth).forEach(function (b) { b.addEventListener('click', function () { view(b.dataset.authView); }); });
    view(auth.dataset.view);

    function val(form, name) { const i = $('[name="' + name + '"]', form); return i.type === 'checkbox' ? i.checked : i.value; }

    $('[data-form="login"]', auth).addEventListener('submit', function (e) {
      e.preventDefault();
      const f = e.currentTarget;
      showErrors(f); busy(f, true, t('auth.busyLogin'));
      Account.login({ email: val(f, 'email'), password: val(f, 'password') })
        .then(function (u) { busy(f, false); if (opts.onSuccess) opts.onSuccess(u, 'login'); }, function (err) { busy(f, false); showErrors(f, err); });
    });
    $('[data-form="register"]', auth).addEventListener('submit', function (e) {
      e.preventDefault();
      const f = e.currentTarget;
      showErrors(f); busy(f, true, t('auth.busyRegister'));
      Account.register({ name: val(f, 'name'), email: val(f, 'email'), password: val(f, 'password'), marketing: val(f, 'marketing') })
        .then(function (u) { busy(f, false); if (opts.onSuccess) opts.onSuccess(u, 'register'); }, function (err) { busy(f, false); showErrors(f, err); });
    });
    $('[data-form="forgot"]', auth).addEventListener('submit', function (e) {
      e.preventDefault();
      const f = e.currentTarget;
      const ok = $('[data-form-ok]', f);
      showErrors(f); ok.innerHTML = ''; busy(f, true, t('auth.busySending'));
      Account.forgot(val(f, 'email')).then(function (r) {
        busy(f, false);
        ok.innerHTML = esc(t('auth.resetSent')) +
          (r.devResetLink ? '<br><span class="dev-link">' + t('auth.devLink_html', { url: esc(r.devResetLink) }) + '</span>' : '');
      }, function (err) { busy(f, false); showErrors(f, err); });
    });
    return { view: view };
  }

  /* ------------------------------------------------------------------ *
   * Auth modal (used when an action needs an account)
   * ------------------------------------------------------------------ */
  const authRoot = $('[data-auth]');
  const authPanel = $('.modal__panel', authRoot);
  const authDlg = dialog(authRoot, authPanel);
  let pending = null;
  $$('[data-auth-close]', authRoot).forEach(function (b) { b.addEventListener('click', function () { pending = null; authDlg.close(); }); });

  function openAuth(o) {
    o = o || {};
    pending = o.then || null;
    $('[data-auth-title]').textContent = o.title || t('auth.title');
    $('[data-auth-lede]').textContent = o.lede || t('auth.lede');
    $('[data-auth-forms]').innerHTML = authHTML('m', o.view || 'register');
    bindAuth(authRoot, {
      onSuccess: function (u, how) {
        authDlg.close();
        Shop.toast(t(how === 'register' ? 'auth.welcomeNew' : 'auth.welcomeBack', { name: u.name.split(' ')[0] }));
        const next = pending; pending = null;
        if (next) next(u);
      }
    });
    authDlg.open();
  }

  /* ------------------------------------------------------------------ *
   * Wishlist hearts (delegated, works for cards rendered at any time)
   * ------------------------------------------------------------------ */
  function syncWish(root) {
    $$('[data-wish]', root || document).forEach(function (b) {
      const on = Account.isWished(b.dataset.slug);
      b.setAttribute('aria-pressed', String(on));
      const name = Shop.get(b.dataset.slug).name;
      b.setAttribute('aria-label', t(on ? 'wish.remove' : 'wish.save', { name: name }));
    });
  }
  window.addEventListener('vyro:wishlist', function () { syncWish(); });

  function toggleWish(slug, color) {
    return Account.toggleWish(slug, color).then(function (on) {
      Shop.toast(t(on ? 'wish.saved' : 'wish.removed', { name: Shop.get(slug).name }));
    }, function (err) { Shop.toast(err.message); });
  }
  document.addEventListener('click', function (e) {
    const b = e.target.closest('[data-wish]');
    if (!b) return;
    e.preventDefault();
    const slug = b.dataset.slug, color = b.dataset.color;
    if (Account.user()) { toggleWish(slug, color); return; }
    openAuth({
      view: 'register',
      title: t('wish.modalTitle'),
      lede: t('wish.modalLede', { name: Shop.get(slug).name }),
      then: function () { if (!Account.isWished(slug)) toggleWish(slug, color); }
    });
  });

  /* ------------------------------------------------------------------ *
   * Init
   * ------------------------------------------------------------------ */
  Shop.renderBagCount(false);
  renderDrawer();
  Account.ready.then(function () { renderAccountLabel(); syncWish(); });

  window.VyroChrome = {
    onLock: function (fn) { lockers.push(fn); },
    syncWish: syncWish,
    openAuth: openAuth,
    authHTML: authHTML,
    bindAuth: bindAuth,
    lineHTML: lineHTML,
    shipHTML: shipHTML,
    modeNote: modeNote,
    openDrawer: function () { renderDrawer(); drawer.open(); },
    closeMenu: function () { setMenu(false); }
  };
})();

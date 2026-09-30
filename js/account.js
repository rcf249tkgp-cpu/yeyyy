/*
  VYRO My Account: log in / create account / reset password when signed out;
  Profile, Orders, Wishlist, Addresses and Settings when signed in.
  Tabs are addressable: account.html#orders, #wishlist, #addresses, #settings
*/
(function () {
  const Shop = window.VyroShop;
  const Account = window.VyroAccount;
  const Chrome = window.VyroChrome;
  const I18n = window.VyroI18n;
  const t = I18n.t;
  const esc = Shop.esc;
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  const root = $('[data-account]');
  const TABS = [
    ['profile', t('account.tabs.profile')], ['orders', t('account.tabs.orders')], ['wishlist', t('account.tabs.wishlist')], ['addresses', t('account.tabs.addresses')], ['settings', t('account.tabs.settings')]
  ];
  let resetToken = new URLSearchParams(location.search).get('reset');

  function tabFromHash() {
    const h = location.hash.slice(1);
    return TABS.some(function (t) { return t[0] === h; }) ? h : 'profile';
  }
  let tab = tabFromHash();

  function date(s) {
    const d = new Date(String(s).replace(' ', 'T') + (String(s).indexOf('Z') < 0 && String(s).indexOf('T') < 0 ? 'Z' : ''));
    return isNaN(d) ? '' : I18n.date(d);
  }

  // Shared form helpers
  function errors(form, err) {
    $$('.field__error', form).forEach(function (e) { e.textContent = ''; });
    const fe = $('[data-form-error]', form); if (fe) fe.textContent = '';
    if (!err) return;
    const t = err.field && $('[data-error-for="' + err.field + '"]', form);
    if (t) { t.textContent = err.message; const i = t.previousElementSibling; if (i && i.focus) i.focus(); }
    else if (fe) fe.textContent = err.message;
  }
  function field(name, label, type, value, attrs) {
    return '<div class="field"><label for="a-' + name + '">' + label + '</label><input id="a-' + name + '" name="' + name + '" type="' + (type || 'text') + '" value="' + esc(value || '') + '" ' + (attrs || '') + '><p class="field__error" data-error-for="' + name + '"></p></div>';
  }
  function submitting(form, on, label) {
    const b = $('[type="submit"]', form);
    if (!b) return;
    if (on) { b.dataset.label = b.textContent; b.textContent = label || t('common.saving'); b.disabled = true; }
    else { b.textContent = b.dataset.label; b.disabled = false; }
  }
  function values(form) {
    const o = {};
    $$('input, select', form).forEach(function (i) { if (i.name) o[i.name] = i.type === 'checkbox' ? i.checked : i.value; });
    return o;
  }

  /* ------------------------------------------------------------------ *
   * Signed out
   * ------------------------------------------------------------------ */
  function renderSignedOut() {
    if (resetToken) {
      root.innerHTML =
        '<section class="acct__gate">' +
          '<h1 class="acct__title display">' + t('account.resetTitle') + '</h1>' +
          '<form class="auth__form acct__reset" data-reset novalidate>' +
            field('password', t('account.newPassword'), 'password', '', 'autocomplete="new-password" minlength="8" required') +
            '<p class="field__hint">' + t('auth.pwHint') + '</p>' +
            '<p class="form__error" data-form-error role="alert"></p>' +
            '<button class="btn btn--solid" type="submit">' + t('account.savePassword') + '</button>' +
          '</form>' + Chrome.modeNote() +
        '</section>';
      $('[data-reset]').addEventListener('submit', function (e) {
        e.preventDefault();
        const f = e.currentTarget;
        errors(f); submitting(f, true);
        const t = resetToken;
        resetToken = null;
        Account.reset(t, values(f).password).then(function () {
          history.replaceState(null, '', 'account.html');
          Shop.toast(t('account.resetDone'));
        }, function (err) { resetToken = t; submitting(f, false); errors(f, err); });
      });
      return;
    }
    root.innerHTML =
      '<section class="acct__gate">' +
        '<h1 class="acct__title display">' + t('account.gateTitle') + '</h1>' +
        '<p class="acct__lede">' + t('account.gateLede') + '</p>' +
        '<div data-gate-forms>' + Chrome.authHTML('p', tab === 'register' ? 'register' : 'login') + '</div>' +
      '</section>';
    Chrome.bindAuth(root, { focus: false, onSuccess: function (u, how) { Shop.toast(t(how === 'register' ? 'auth.welcomeNew' : 'auth.welcomeBack', { name: u.name.split(' ')[0] })); } });
  }

  /* ------------------------------------------------------------------ *
   * Signed in
   * ------------------------------------------------------------------ */
  function renderSignedIn() {
    const u = Account.user();
    root.innerHTML =
      '<header class="acct__head">' +
        '<p class="acct__hello">' + esc(t('account.signedInAs', { email: u.email })) + '</p>' +
        '<h1 class="acct__title display">' + esc(t('account.hi', { name: u.name.split(' ')[0] })) + '</h1>' +
      '</header>' +
      (Account.mode === 'local' ? Chrome.modeNote() : '') +
      '<div class="acct__layout">' +
        '<nav class="acct__tabs" role="tablist" aria-label="' + t('account.sections') + '">' +
          TABS.map(function (t) {
            return '<a href="#' + t[0] + '" role="tab" id="tab-' + t[0] + '" aria-controls="panel" aria-selected="' + (t[0] === tab) + '" class="acct__tab" data-tab="' + t[0] + '">' + t[1] + '</a>';
          }).join('') +
          '<button type="button" class="acct__tab acct__logout" data-logout>' + t('account.logout') + '</button>' +
        '</nav>' +
        '<section class="acct__panel" id="panel" role="tabpanel" aria-labelledby="tab-' + tab + '" tabindex="-1" data-panel></section>' +
      '</div>';
    $('[data-logout]').addEventListener('click', function () {
      Account.logout().then(function () { Shop.toast(t('account.loggedOut')); });
    });
    renderPanel();
  }

  const panels = {
    profile: function (el) {
      const u = Account.user();
      el.innerHTML =
        '<h2 class="acct__h2 display">' + t('account.profile') + '</h2>' +
        '<form class="acct__form" data-profile novalidate>' +
          field('name', t('auth.fullName'), 'text', u.name, 'autocomplete="name" required') +
          field('email', t('auth.email'), 'email', u.email, 'autocomplete="email" required') +
          '<p class="form__error" data-form-error role="alert"></p>' +
          '<button class="btn btn--solid" type="submit">' + t('account.saveChanges') + '</button>' +
        '</form>' +
        '<p class="acct__meta">' + esc(t('account.memberSince', { date: date(u.createdAt) })) + '</p>';
      $('[data-profile]', el).addEventListener('submit', function (e) {
        e.preventDefault(); const f = e.currentTarget;
        errors(f); submitting(f, true);
        Account.updateProfile(values(f)).then(function () { Shop.toast(t('account.profileSaved')); }, function (err) { submitting(f, false); errors(f, err); });
      });
    },

    orders: function (el) {
      el.innerHTML = '<h2 class="acct__h2 display">' + t('account.orders') + '</h2><p class="acct__loading">' + t('account.ordersLoading') + '</p>';
      Account.orders().then(function (list) {
        if (!list.length) {
          el.innerHTML = '<h2 class="acct__h2 display">' + t('account.orders') + '</h2><div class="empty"><p class="empty__title display">' + t('account.noOrdersTitle') + '</p><p>' + t('account.noOrdersText') + '</p><a class="btn btn--solid" href="shop.html">' + t('account.shopDrop') + '</a></div>';
          return;
        }
        el.innerHTML = '<h2 class="acct__h2 display">' + t('account.orders') + '</h2>' + list.map(function (o) {
          return '<details class="order">' +
            '<summary><span class="order__no">' + esc(o.number) + '</span><span class="order__date">' + date(o.createdAt) + '</span><span class="order__status">' + esc(I18n.has('account.status.' + o.status) ? t('account.status.' + o.status) : o.status) + '</span><span class="order__total">' + Shop.money(o.total) + '</span></summary>' +
            '<div class="order__body">' +
              o.items.map(function (i) { const p = Shop.get(i.slug); return p ? Shop.miniHTML(p, i.color, { meta: t('common.itemMeta', { color: Shop.colorName(i.color), size: i.size, qty: i.qty }) }) : ''; }).join('') +
              '<p class="order__addr">' + esc(t('account.shippingTo', { address: [o.address.name, o.address.line1, o.address.city, o.address.postcode, o.address.country].filter(Boolean).join(', ') })) + '</p>' +
            '</div>' +
          '</details>';
        }).join('');
      }, function (err) { el.innerHTML = '<h2 class="acct__h2 display">' + t('account.orders') + '</h2><p class="form__error">' + esc(err.message) + '</p>'; });
    },

    wishlist: function (el) {
      const list = Account.wishlist().filter(function (i) { return Shop.get(i.slug); });
      if (!list.length) {
        el.innerHTML = '<h2 class="acct__h2 display">' + t('account.wishlist') + '</h2><div class="empty"><p class="empty__title display">' + t('account.wishEmptyTitle') + '</p><p>' + t('account.wishEmptyText') + '</p><a class="btn btn--solid" href="shop.html">' + t('account.wishEmptyCta') + '</a></div>';
        return;
      }
      el.innerHTML = '<h2 class="acct__h2 display">' + t('account.wishlist') + ' <span>(' + list.length + ')</span></h2><div class="acct__grid" data-wish-grid></div>';
      const grid = $('[data-wish-grid]', el);
      const colors = {};
      list.forEach(function (i) { colors[i.slug] = i.color; });
      Shop.mountCards(grid, list.map(function (i) { return Shop.get(i.slug); }), { color: function (p) { return colors[p.slug]; } });
    },

    addresses: function (el) {
      el.innerHTML = '<h2 class="acct__h2 display">' + t('account.addresses') + '</h2><p class="acct__loading">' + t('common.loading') + '</p>';
      Account.addresses().then(function (list) { drawAddresses(el, list, null); }, function (err) { el.innerHTML = '<p class="form__error">' + esc(err.message) + '</p>'; });
    },

    settings: function (el) {
      const u = Account.user();
      el.innerHTML =
        '<h2 class="acct__h2 display">' + t('account.settings') + '</h2>' +
        '<form class="acct__form" data-prefs>' +
          '<h3 class="acct__h3">' + t('account.preferences') + '</h3>' +
          '<label class="check"><input type="checkbox" name="marketing"' + (u.marketing ? ' checked' : '') + '> <span>' + t('account.marketing') + '</span></label>' +
          '<div class="field"><label for="a-units">' + t('account.units') + '</label><select id="a-units" name="units"><option value="metric"' + (u.units !== 'imperial' ? ' selected' : '') + '>' + t('account.metric') + '</option><option value="imperial"' + (u.units === 'imperial' ? ' selected' : '') + '>' + t('account.imperial') + '</option></select></div>' +
          '<button class="btn btn--solid" type="submit">' + t('account.savePrefs') + '</button>' +
        '</form>' +
        '<form class="acct__form" data-password novalidate>' +
          '<h3 class="acct__h3">' + t('account.changePassword') + '</h3>' +
          field('current', t('account.currentPassword'), 'password', '', 'autocomplete="current-password" required') +
          field('password', t('account.newPassword'), 'password', '', 'autocomplete="new-password" minlength="8" required') +
          '<p class="field__hint">' + t('auth.pwHint') + '</p>' +
          '<p class="form__error" data-form-error role="alert"></p>' +
          '<button class="btn btn--solid" type="submit">' + t('account.updatePassword') + '</button>' +
        '</form>' +
        '<form class="acct__form acct__danger" data-delete novalidate>' +
          '<h3 class="acct__h3">' + t('account.deleteTitle') + '</h3>' +
          '<p class="acct__meta">' + t('account.deleteText') + '</p>' +
          field('password', t('account.confirmPassword'), 'password', '', 'autocomplete="current-password" required') +
          '<p class="form__error" data-form-error role="alert"></p>' +
          '<button class="btn btn--ghost" type="submit">' + t('account.deleteButton') + '</button>' +
        '</form>';
      $('[data-prefs]', el).addEventListener('submit', function (e) {
        e.preventDefault(); const f = e.currentTarget; submitting(f, true);
        Account.updateSettings(values(f)).then(function () { Shop.toast(t('account.prefsSaved')); }, function (err) { submitting(f, false); Shop.toast(err.message); });
      });
      $('[data-password]', el).addEventListener('submit', function (e) {
        e.preventDefault(); const f = e.currentTarget; errors(f); submitting(f, true);
        Account.changePassword(values(f)).then(function () { submitting(f, false); f.reset(); Shop.toast(t('account.passwordUpdated')); }, function (err) { submitting(f, false); errors(f, err); });
      });
      $('[data-delete]', el).addEventListener('submit', function (e) {
        e.preventDefault(); const f = e.currentTarget; errors(f);
        if (!window.confirm(t('account.deleteConfirm'))) return;
        submitting(f, true, t('account.deleting'));
        Account.deleteAccount(values(f)).then(function () { Shop.toast(t('account.deleted')); }, function (err) { submitting(f, false); errors(f, err); });
      });
    }
  };

  function addressForm(a) {
    a = a || {};
    return '<form class="acct__form addr-form" data-addr-form novalidate>' +
      '<h3 class="acct__h3">' + (a.id ? t('account.editAddress') : t('account.addAddress')) + '</h3>' +
      (a.id ? '<input type="hidden" name="id" value="' + a.id + '">' : '') +
      field('name', t('address.fullName'), 'text', a.name, 'autocomplete="name" required') +
      field('line1', t('address.line1'), 'text', a.line1, 'autocomplete="address-line1" required') +
      field('line2', t('address.line2'), 'text', a.line2, 'autocomplete="address-line2"') +
      '<div class="field-row">' + field('city', t('address.city'), 'text', a.city, 'autocomplete="address-level2" required') + field('postcode', t('address.postcode'), 'text', a.postcode, 'autocomplete="postal-code" required') + '</div>' +
      field('country', t('address.country'), 'text', a.country, 'autocomplete="country-name" required') +
      field('phone', t('address.phone'), 'tel', a.phone, 'autocomplete="tel"') +
      '<label class="check"><input type="checkbox" name="isDefault"' + (a.isDefault ? ' checked' : '') + '> <span>' + t('account.useDefault') + '</span></label>' +
      '<p class="form__error" data-form-error role="alert"></p>' +
      '<div class="addr-form__ctas"><button class="btn btn--solid" type="submit">' + t('account.saveAddress') + '</button><button class="btn btn--ghost" type="button" data-addr-cancel>' + t('common.cancel') + '</button></div>' +
    '</form>';
  }

  function drawAddresses(el, list, editing) {
    el.innerHTML = '<h2 class="acct__h2 display">' + t('account.addresses') + '</h2>' +
      (list.length ? '<div class="addr-grid">' + list.map(function (a) {
        return '<article class="addr">' +
          (a.isDefault ? '<span class="tag">' + t('account.default') + '</span>' : '') +
          '<p><strong>' + esc(a.name) + '</strong><br>' + esc(a.line1) + (a.line2 ? '<br>' + esc(a.line2) : '') + '<br>' + esc(a.city) + ' ' + esc(a.postcode) + '<br>' + esc(a.country) + (a.phone ? '<br>' + esc(a.phone) : '') + '</p>' +
          '<div class="addr__ctas"><button type="button" class="link-btn" data-addr-edit="' + a.id + '">' + t('common.edit') + '</button><button type="button" class="link-btn" data-addr-remove="' + a.id + '">' + t('common.remove') + '</button></div>' +
        '</article>';
      }).join('') + '</div>' : '<p class="acct__meta">' + t('account.noAddresses') + '</p>') +
      (editing ? addressForm(editing === 'new' ? null : editing) : '<button type="button" class="btn btn--ghost" data-addr-add>' + t('account.addAddress') + '</button>');

    const add = $('[data-addr-add]', el);
    if (add) add.addEventListener('click', function () { drawAddresses(el, list, 'new'); $('[data-addr-form] input:not([type="hidden"])', el).focus(); });
    $$('[data-addr-edit]', el).forEach(function (b) {
      b.addEventListener('click', function () { drawAddresses(el, list, list.filter(function (a) { return String(a.id) === b.dataset.addrEdit; })[0]); });
    });
    $$('[data-addr-remove]', el).forEach(function (b) {
      b.addEventListener('click', function () {
        Account.removeAddress(b.dataset.addrRemove).then(function (l) { drawAddresses(el, l, null); Shop.toast(t('account.addressRemoved')); });
      });
    });
    const form = $('[data-addr-form]', el);
    if (form) {
      $('[data-addr-cancel]', form).addEventListener('click', function () { drawAddresses(el, list, null); });
      form.addEventListener('submit', function (e) {
        e.preventDefault(); errors(form); submitting(form, true);
        const v = values(form);
        (v.id ? Account.updateAddress(v) : Account.addAddress(v)).then(function (l) { drawAddresses(el, l, null); Shop.toast(t('account.addressSaved')); },
          function (err) { submitting(form, false); errors(form, err); });
      });
    }
  }

  function renderPanel() {
    const el = $('[data-panel]');
    if (!el) return;
    $$('[data-tab]').forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.tab === tab)); });
    el.setAttribute('aria-labelledby', 'tab-' + tab);
    panels[tab](el);
  }

  function render() {
    if (Account.user()) renderSignedIn(); else renderSignedOut();
  }

  root.addEventListener('click', function (e) {
    const t = e.target.closest('[data-tab]');
    if (!t) return;
    e.preventDefault();
    tab = t.dataset.tab;
    history.replaceState(null, '', '#' + tab);
    renderPanel();
    $('[data-panel]').focus({ preventScroll: true });
  });
  window.addEventListener('hashchange', function () { tab = tabFromHash(); if (Account.user()) renderPanel(); });
  window.addEventListener('vyro:auth', render);
  window.addEventListener('vyro:wishlist', function () { if (Account.user() && tab === 'wishlist') renderPanel(); });

  root.innerHTML = '<p class="acct__loading">' + t('account.loading') + '</p>';
  Account.ready.then(render);
})();

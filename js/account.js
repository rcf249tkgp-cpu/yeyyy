/*
  VYRO My Account: log in / create account / reset password when signed out;
  Profile, Orders, Wishlist, Addresses and Settings when signed in.
  Tabs are addressable: account.html#orders, #wishlist, #addresses, #settings
*/
(function () {
  const Shop = window.VyroShop;
  const Account = window.VyroAccount;
  const Chrome = window.VyroChrome;
  const esc = Shop.esc;
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  const root = $('[data-account]');
  const TABS = [
    ['profile', 'Profile'], ['orders', 'Orders'], ['wishlist', 'Wishlist'], ['addresses', 'Addresses'], ['settings', 'Settings']
  ];
  let resetToken = new URLSearchParams(location.search).get('reset');

  function tabFromHash() {
    const h = location.hash.slice(1);
    return TABS.some(function (t) { return t[0] === h; }) ? h : 'profile';
  }
  let tab = tabFromHash();

  function date(s) {
    const d = new Date(String(s).replace(' ', 'T') + (String(s).indexOf('Z') < 0 && String(s).indexOf('T') < 0 ? 'Z' : ''));
    return isNaN(d) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
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
    if (on) { b.dataset.label = b.textContent; b.textContent = label || 'Saving…'; b.disabled = true; }
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
          '<h1 class="acct__title display">Set a new password</h1>' +
          '<form class="auth__form acct__reset" data-reset novalidate>' +
            field('password', 'New password', 'password', '', 'autocomplete="new-password" minlength="8" required') +
            '<p class="field__hint">At least 8 characters.</p>' +
            '<p class="form__error" data-form-error role="alert"></p>' +
            '<button class="btn btn--solid" type="submit">Save new password</button>' +
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
          Shop.toast('Password updated. You\'re logged in.');
        }, function (err) { resetToken = t; submitting(f, false); errors(f, err); });
      });
      return;
    }
    root.innerHTML =
      '<section class="acct__gate">' +
        '<h1 class="acct__title display">Your account</h1>' +
        '<p class="acct__lede">Track orders, save your wishlist and check out faster.</p>' +
        '<div data-gate-forms>' + Chrome.authHTML('p', tab === 'register' ? 'register' : 'login') + '</div>' +
      '</section>';
    Chrome.bindAuth(root, { focus: false, onSuccess: function (u, how) { Shop.toast(how === 'register' ? 'Welcome to VYRO, ' + u.name.split(' ')[0] + '.' : 'Welcome back, ' + u.name.split(' ')[0] + '.'); } });
  }

  /* ------------------------------------------------------------------ *
   * Signed in
   * ------------------------------------------------------------------ */
  function renderSignedIn() {
    const u = Account.user();
    root.innerHTML =
      '<header class="acct__head">' +
        '<p class="acct__hello">Signed in as ' + esc(u.email) + '</p>' +
        '<h1 class="acct__title display">Hi, ' + esc(u.name.split(' ')[0]) + '</h1>' +
      '</header>' +
      (Account.mode === 'local' ? Chrome.modeNote() : '') +
      '<div class="acct__layout">' +
        '<nav class="acct__tabs" role="tablist" aria-label="Account sections">' +
          TABS.map(function (t) {
            return '<a href="#' + t[0] + '" role="tab" id="tab-' + t[0] + '" aria-controls="panel" aria-selected="' + (t[0] === tab) + '" class="acct__tab" data-tab="' + t[0] + '">' + t[1] + '</a>';
          }).join('') +
          '<button type="button" class="acct__tab acct__logout" data-logout>Log out</button>' +
        '</nav>' +
        '<section class="acct__panel" id="panel" role="tabpanel" aria-labelledby="tab-' + tab + '" tabindex="-1" data-panel></section>' +
      '</div>';
    $('[data-logout]').addEventListener('click', function () {
      Account.logout().then(function () { Shop.toast('You\'re logged out.'); });
    });
    renderPanel();
  }

  const panels = {
    profile: function (el) {
      const u = Account.user();
      el.innerHTML =
        '<h2 class="acct__h2 display">Profile</h2>' +
        '<form class="acct__form" data-profile novalidate>' +
          field('name', 'Full name', 'text', u.name, 'autocomplete="name" required') +
          field('email', 'Email', 'email', u.email, 'autocomplete="email" required') +
          '<p class="form__error" data-form-error role="alert"></p>' +
          '<button class="btn btn--solid" type="submit">Save changes</button>' +
        '</form>' +
        '<p class="acct__meta">Member since ' + date(u.createdAt) + '</p>';
      $('[data-profile]', el).addEventListener('submit', function (e) {
        e.preventDefault(); const f = e.currentTarget;
        errors(f); submitting(f, true);
        Account.updateProfile(values(f)).then(function () { Shop.toast('Profile saved.'); }, function (err) { submitting(f, false); errors(f, err); });
      });
    },

    orders: function (el) {
      el.innerHTML = '<h2 class="acct__h2 display">Orders</h2><p class="acct__loading">Loading your orders…</p>';
      Account.orders().then(function (list) {
        if (!list.length) {
          el.innerHTML = '<h2 class="acct__h2 display">Orders</h2><div class="empty"><p class="empty__title display">No orders yet</p><p>When you place an order it will show up here with its status.</p><a class="btn btn--solid" href="shop.html">Shop Drop 01</a></div>';
          return;
        }
        el.innerHTML = '<h2 class="acct__h2 display">Orders</h2>' + list.map(function (o) {
          return '<details class="order">' +
            '<summary><span class="order__no">' + esc(o.number) + '</span><span class="order__date">' + date(o.createdAt) + '</span><span class="order__status">' + esc(o.status) + '</span><span class="order__total">' + Shop.money(o.total) + '</span></summary>' +
            '<div class="order__body">' +
              o.items.map(function (i) { const p = Shop.get(i.slug); return p ? Shop.miniHTML(p, i.color, { meta: Shop.colorName(i.color) + ' / ' + i.size + ' × ' + i.qty }) : ''; }).join('') +
              '<p class="order__addr">Shipping to ' + esc([o.address.name, o.address.line1, o.address.city, o.address.postcode, o.address.country].filter(Boolean).join(', ')) + '</p>' +
            '</div>' +
          '</details>';
        }).join('');
      }, function (err) { el.innerHTML = '<h2 class="acct__h2 display">Orders</h2><p class="form__error">' + esc(err.message) + '</p>'; });
    },

    wishlist: function (el) {
      const list = Account.wishlist().filter(function (i) { return Shop.get(i.slug); });
      if (!list.length) {
        el.innerHTML = '<h2 class="acct__h2 display">Wishlist</h2><div class="empty"><p class="empty__title display">Nothing saved yet</p><p>Tap the heart on any product to save it here.</p><a class="btn btn--solid" href="shop.html">Browse the shop</a></div>';
        return;
      }
      el.innerHTML = '<h2 class="acct__h2 display">Wishlist <span>(' + list.length + ')</span></h2><div class="acct__grid" data-wish-grid></div>';
      const grid = $('[data-wish-grid]', el);
      const colors = {};
      list.forEach(function (i) { colors[i.slug] = i.color; });
      Shop.mountCards(grid, list.map(function (i) { return Shop.get(i.slug); }), { color: function (p) { return colors[p.slug]; } });
    },

    addresses: function (el) {
      el.innerHTML = '<h2 class="acct__h2 display">Addresses</h2><p class="acct__loading">Loading…</p>';
      Account.addresses().then(function (list) { drawAddresses(el, list, null); }, function (err) { el.innerHTML = '<p class="form__error">' + esc(err.message) + '</p>'; });
    },

    settings: function (el) {
      const u = Account.user();
      el.innerHTML =
        '<h2 class="acct__h2 display">Settings</h2>' +
        '<form class="acct__form" data-prefs>' +
          '<h3 class="acct__h3">Preferences</h3>' +
          '<label class="check"><input type="checkbox" name="marketing"' + (u.marketing ? ' checked' : '') + '> <span>Email me about new drops and early access</span></label>' +
          '<div class="field"><label for="a-units">Size guide units</label><select id="a-units" name="units"><option value="metric"' + (u.units !== 'imperial' ? ' selected' : '') + '>Metric (cm, kg)</option><option value="imperial"' + (u.units === 'imperial' ? ' selected' : '') + '>Imperial (in, lb)</option></select></div>' +
          '<button class="btn btn--solid" type="submit">Save preferences</button>' +
        '</form>' +
        '<form class="acct__form" data-password novalidate>' +
          '<h3 class="acct__h3">Change password</h3>' +
          field('current', 'Current password', 'password', '', 'autocomplete="current-password" required') +
          field('password', 'New password', 'password', '', 'autocomplete="new-password" minlength="8" required') +
          '<p class="field__hint">At least 8 characters.</p>' +
          '<p class="form__error" data-form-error role="alert"></p>' +
          '<button class="btn btn--solid" type="submit">Update password</button>' +
        '</form>' +
        '<form class="acct__form acct__danger" data-delete novalidate>' +
          '<h3 class="acct__h3">Delete account</h3>' +
          '<p class="acct__meta">This permanently deletes your account, wishlist and saved addresses. It can\'t be undone.</p>' +
          field('password', 'Confirm with your password', 'password', '', 'autocomplete="current-password" required') +
          '<p class="form__error" data-form-error role="alert"></p>' +
          '<button class="btn btn--ghost" type="submit">Delete my account</button>' +
        '</form>';
      $('[data-prefs]', el).addEventListener('submit', function (e) {
        e.preventDefault(); const f = e.currentTarget; submitting(f, true);
        Account.updateSettings(values(f)).then(function () { Shop.toast('Preferences saved.'); }, function (err) { submitting(f, false); Shop.toast(err.message); });
      });
      $('[data-password]', el).addEventListener('submit', function (e) {
        e.preventDefault(); const f = e.currentTarget; errors(f); submitting(f, true);
        Account.changePassword(values(f)).then(function () { submitting(f, false); f.reset(); Shop.toast('Password updated.'); }, function (err) { submitting(f, false); errors(f, err); });
      });
      $('[data-delete]', el).addEventListener('submit', function (e) {
        e.preventDefault(); const f = e.currentTarget; errors(f);
        if (!window.confirm('Delete your VYRO account permanently?')) return;
        submitting(f, true, 'Deleting…');
        Account.deleteAccount(values(f)).then(function () { Shop.toast('Your account has been deleted.'); }, function (err) { submitting(f, false); errors(f, err); });
      });
    }
  };

  function addressForm(a) {
    a = a || {};
    return '<form class="acct__form addr-form" data-addr-form novalidate>' +
      '<h3 class="acct__h3">' + (a.id ? 'Edit address' : 'Add an address') + '</h3>' +
      (a.id ? '<input type="hidden" name="id" value="' + a.id + '">' : '') +
      field('name', 'Full name', 'text', a.name, 'autocomplete="name" required') +
      field('line1', 'Address', 'text', a.line1, 'autocomplete="address-line1" required') +
      field('line2', 'Apartment, suite (optional)', 'text', a.line2, 'autocomplete="address-line2"') +
      '<div class="field-row">' + field('city', 'Town or city', 'text', a.city, 'autocomplete="address-level2" required') + field('postcode', 'Postcode', 'text', a.postcode, 'autocomplete="postal-code" required') + '</div>' +
      field('country', 'Country', 'text', a.country, 'autocomplete="country-name" required') +
      field('phone', 'Phone (optional)', 'tel', a.phone, 'autocomplete="tel"') +
      '<label class="check"><input type="checkbox" name="isDefault"' + (a.isDefault ? ' checked' : '') + '> <span>Use as my default address</span></label>' +
      '<p class="form__error" data-form-error role="alert"></p>' +
      '<div class="addr-form__ctas"><button class="btn btn--solid" type="submit">Save address</button><button class="btn btn--ghost" type="button" data-addr-cancel>Cancel</button></div>' +
    '</form>';
  }

  function drawAddresses(el, list, editing) {
    el.innerHTML = '<h2 class="acct__h2 display">Addresses</h2>' +
      (list.length ? '<div class="addr-grid">' + list.map(function (a) {
        return '<article class="addr">' +
          (a.isDefault ? '<span class="tag">Default</span>' : '') +
          '<p><strong>' + esc(a.name) + '</strong><br>' + esc(a.line1) + (a.line2 ? '<br>' + esc(a.line2) : '') + '<br>' + esc(a.city) + ' ' + esc(a.postcode) + '<br>' + esc(a.country) + (a.phone ? '<br>' + esc(a.phone) : '') + '</p>' +
          '<div class="addr__ctas"><button type="button" class="link-btn" data-addr-edit="' + a.id + '">Edit</button><button type="button" class="link-btn" data-addr-remove="' + a.id + '">Remove</button></div>' +
        '</article>';
      }).join('') + '</div>' : '<p class="acct__meta">No saved addresses yet. Add one to check out faster.</p>') +
      (editing ? addressForm(editing === 'new' ? null : editing) : '<button type="button" class="btn btn--ghost" data-addr-add>Add an address</button>');

    const add = $('[data-addr-add]', el);
    if (add) add.addEventListener('click', function () { drawAddresses(el, list, 'new'); $('[data-addr-form] input:not([type="hidden"])', el).focus(); });
    $$('[data-addr-edit]', el).forEach(function (b) {
      b.addEventListener('click', function () { drawAddresses(el, list, list.filter(function (a) { return String(a.id) === b.dataset.addrEdit; })[0]); });
    });
    $$('[data-addr-remove]', el).forEach(function (b) {
      b.addEventListener('click', function () {
        Account.removeAddress(b.dataset.addrRemove).then(function (l) { drawAddresses(el, l, null); Shop.toast('Address removed.'); });
      });
    });
    const form = $('[data-addr-form]', el);
    if (form) {
      $('[data-addr-cancel]', form).addEventListener('click', function () { drawAddresses(el, list, null); });
      form.addEventListener('submit', function (e) {
        e.preventDefault(); errors(form); submitting(form, true);
        const v = values(form);
        (v.id ? Account.updateAddress(v) : Account.addAddress(v)).then(function (l) { drawAddresses(el, l, null); Shop.toast('Address saved.'); },
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

  root.innerHTML = '<p class="acct__loading">Loading your account…</p>';
  Account.ready.then(render);
})();

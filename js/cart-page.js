/*
  VYRO cart page: edit quantities, remove items, totals, and a test checkout
  that records the order (no payment is taken; connect a payment provider
  before going live).
*/
(function () {
  const Shop = window.VyroShop;
  const Account = window.VyroAccount;
  const Chrome = window.VyroChrome;
  const esc = Shop.esc;
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  const root = $('[data-cart]');
  let step = new URLSearchParams(location.search).get('checkout') ? 'checkout' : 'bag';
  let placed = null;
  let addresses = [];

  function summaryHTML() {
    const t = Shop.totals();
    return '' +
      '<div class="summary__rows">' +
        '<div class="summary__row"><span>Subtotal</span><span>' + Shop.money(t.subtotal) + '</span></div>' +
        '<div class="summary__row"><span>Shipping</span><span>' + (t.shipping ? Shop.money(t.shipping) : 'Free') + '</span></div>' +
        '<div class="summary__row summary__row--total"><span>Total</span><strong>' + Shop.money(t.total) + '</strong></div>' +
      '</div>' +
      '<div class="ship-meter">' + Chrome.shipHTML() + '</div>';
  }

  function addressFields(a) {
    a = a || {};
    function f(name, label, attrs, val) {
      return '<div class="field"><label for="co-' + name + '">' + label + '</label><input id="co-' + name + '" name="' + name + '" ' + attrs + ' value="' + esc(val || '') + '"><p class="field__error" data-error-for="' + name + '"></p></div>';
    }
    return f('name', 'Full name', 'autocomplete="name" required', a.name) +
      f('line1', 'Address', 'autocomplete="address-line1" required', a.line1) +
      f('line2', 'Apartment, suite (optional)', 'autocomplete="address-line2"', a.line2) +
      '<div class="field-row">' + f('city', 'Town or city', 'autocomplete="address-level2" required', a.city) + f('postcode', 'Postcode', 'autocomplete="postal-code" required', a.postcode) + '</div>' +
      f('country', 'Country', 'autocomplete="country-name" required', a.country) +
      f('phone', 'Phone (optional)', 'type="tel" autocomplete="tel"', a.phone);
  }

  function checkoutHTML() {
    const u = Account.user();
    const saved = u && addresses.length
      ? '<div class="field"><label for="co-saved">Ship to</label><select id="co-saved" data-saved>' +
          addresses.map(function (a, i) { return '<option value="' + i + '">' + esc(a.name + ', ' + a.line1 + ', ' + a.city) + '</option>'; }).join('') +
          '<option value="new">A new address</option></select></div>'
      : '';
    return '' +
      '<form class="checkout" data-checkout novalidate>' +
        '<h2 class="summary__title display">Checkout</h2>' +
        (u ? '<p class="checkout__who">Ordering as <strong>' + esc(u.email) + '</strong></p>'
           : '<div class="field"><label for="co-email">Email</label><input id="co-email" name="email" type="email" autocomplete="email" required><p class="field__error" data-error-for="email"></p></div>' +
             '<p class="checkout__who"><button type="button" class="link-btn" data-login>Log in</button> to use saved addresses and track this order.</p>') +
        saved +
        '<div data-addr-fields' + (saved ? ' hidden' : '') + '>' + addressFields(u ? { name: u.name } : null) + '</div>' +
        summaryHTML() +
        '<p class="form__error" data-form-error role="alert"></p>' +
        '<button type="submit" class="btn btn--solid summary__cta">Place order</button>' +
        '<p class="checkout__note">This is a test checkout. No payment is taken.</p>' +
        '<button type="button" class="link-btn" data-back-bag>Back to bag</button>' +
      '</form>';
  }

  function confirmHTML(o) {
    const u = Account.user();
    return '' +
      '<section class="confirm">' +
        '<p class="confirm__kicker">Order ' + esc(o.number) + '</p>' +
        '<h1 class="confirm__title display">Order placed</h1>' +
        '<p>Thanks for your order. A confirmation will go to <strong>' + esc(o.email) + '</strong>.</p>' +
        '<div class="confirm__items">' + o.items.map(function (i) {
          const p = Shop.get(i.slug);
          return Shop.miniHTML(p, i.color, { meta: Shop.colorName(i.color) + ' / ' + i.size + ' × ' + i.qty });
        }).join('') + '</div>' +
        '<div class="summary__rows">' +
          '<div class="summary__row"><span>Subtotal</span><span>' + Shop.money(o.subtotal) + '</span></div>' +
          '<div class="summary__row"><span>Shipping</span><span>' + (o.shipping ? Shop.money(o.shipping) : 'Free') + '</span></div>' +
          '<div class="summary__row summary__row--total"><span>Total</span><strong>' + Shop.money(o.total) + '</strong></div>' +
        '</div>' +
        '<div class="confirm__ctas">' +
          (u ? '<a class="btn btn--solid" href="account.html#orders">View your orders</a>' : '<button type="button" class="btn btn--solid" data-signup>Create an account</button>') +
          '<a class="btn btn--ghost" href="shop.html">Continue shopping</a>' +
        '</div>' +
      '</section>';
  }

  function render() {
    if (placed) { root.innerHTML = confirmHTML(placed); bindConfirm(); return; }
    const items = Shop.bagItems();
    const n = Shop.bagCount();
    if (!items.length) {
      root.innerHTML =
        '<nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="shop.html">Shop</a></li><li aria-current="page">Bag</li></ol></nav>' +
        '<div class="empty empty--page"><h1 class="empty__title display">Your bag is empty</h1><p>Drop 01 is live. Hoodies, joggers, tees, tanks and shorts in black, navy and gray.</p><a class="btn btn--solid" href="shop.html">Shop all products</a></div>';
      return;
    }
    root.innerHTML =
      '<nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="shop.html">Shop</a></li><li aria-current="page">Bag</li></ol></nav>' +
      '<h1 class="cartpage__title display">Your bag <span>(' + n + ')</span></h1>' +
      '<div class="cartpage__grid">' +
        '<section class="cartpage__lines" aria-label="Items in your bag">' + items.map(Chrome.lineHTML).join('') +
          '<a class="link-btn cartpage__continue" href="shop.html">Continue shopping</a>' +
        '</section>' +
        '<aside class="summary" aria-label="Order summary">' +
          (step === 'checkout' ? checkoutHTML() :
            '<h2 class="summary__title display">Summary</h2>' + summaryHTML() +
            '<button type="button" class="btn btn--solid summary__cta" data-go-checkout>Checkout</button>' +
            '<p class="checkout__note">Free shipping over ' + Shop.money(Shop.FREE_SHIPPING) + '. 30-day returns.</p>') +
        '</aside>' +
      '</div>';
    if (step === 'checkout') bindCheckout();
    const go = $('[data-go-checkout]');
    if (go) go.addEventListener('click', function () { step = 'checkout'; history.replaceState(null, '', 'cart.html?checkout=1'); render(); focusCheckout(); });
  }

  function focusCheckout() {
    const f = $('[data-checkout] input, [data-checkout] select');
    if (f) f.focus();
  }

  function bindCheckout() {
    const form = $('[data-checkout]');
    const saved = $('[data-saved]', form);
    if (saved) saved.addEventListener('change', function () { $('[data-addr-fields]', form).hidden = saved.value !== 'new'; });
    const login = $('[data-login]', form);
    if (login) login.addEventListener('click', function () {
      Chrome.openAuth({ view: 'login', title: 'Log in to check out', lede: 'Use your saved addresses and keep track of this order in your account.', then: loadAddresses });
    });
    $('[data-back-bag]', form).addEventListener('click', function () { step = 'bag'; history.replaceState(null, '', 'cart.html'); render(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      $$('.field__error', form).forEach(function (el) { el.textContent = ''; });
      $('[data-form-error]', form).textContent = '';
      let address;
      if (saved && saved.value !== 'new') address = addresses[+saved.value];
      else {
        address = {};
        ['name', 'line1', 'line2', 'city', 'postcode', 'country', 'phone'].forEach(function (k) { address[k] = $('[name="' + k + '"]', form).value; });
      }
      const email = $('[name="email"]', form);
      const btn = $('[type="submit"]', form);
      btn.disabled = true; btn.textContent = 'Placing order…';
      Account.placeOrder({
        email: email ? email.value : undefined,
        address: address,
        items: Shop.bagItems().map(function (i) { return { slug: i.slug, color: i.color, size: i.size, qty: i.qty }; })
      }).then(function (order) {
        placed = order;
        Shop.clearBag();
        history.replaceState(null, '', 'cart.html');
        render();
        window.scrollTo(0, 0);
      }, function (err) {
        btn.disabled = false; btn.textContent = 'Place order';
        const target = err.field && $('[data-error-for="' + err.field + '"]', form);
        if (target) { target.textContent = err.message; const i = target.previousElementSibling; if (i) i.focus(); }
        else $('[data-form-error]', form).textContent = err.message;
      });
    });
  }

  function bindConfirm() {
    const s = $('[data-signup]');
    if (s) s.addEventListener('click', function () {
      Chrome.openAuth({ view: 'register', title: 'Track your orders', lede: 'Create an account to save your details and track future orders.', then: render });
    });
  }

  function loadAddresses() {
    if (!Account.user()) { addresses = []; render(); return; }
    Account.addresses().then(function (a) { addresses = a; render(); }, function () { addresses = []; render(); });
  }

  window.addEventListener('vyro:bag', function () { if (!placed) render(); });
  window.addEventListener('vyro:auth', function () { if (!placed) loadAddresses(); });
  render();
  Account.ready.then(loadAddresses);
})();

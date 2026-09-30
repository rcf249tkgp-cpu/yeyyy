/*
  VYRO account client.
  Every page talks to accounts, wishlist, addresses and orders through
  window.VyroAccount. It uses the VYRO server's database (server/vyro-server.js, /api/*)
  when that is running. On a plain static host (or the design preview) it
  falls back to a browser-only store with the same interface, and
  VyroAccount.mode reports 'local' so the UI can say so.

  Events on window:
    vyro:auth      the signed-in user changed (detail: user or null)
    vyro:wishlist  the wishlist changed (detail: array of { slug, color })
*/
(function () {
  const Shop = window.VyroShop;
  const t = window.VyroI18n.t;

  function ApiError(message, field, status) {
    const e = new Error(message);
    e.field = field; e.status = status;
    return e;
  }
  function emit(name, detail) { window.dispatchEvent(new CustomEvent(name, { detail: detail })); }

  /* ------------------------------------------------------------------ *
   * Server adapter
   * ------------------------------------------------------------------ */
  function call(method, path, body) {
    return fetch('api/' + path, {
      method: method,
      credentials: 'same-origin',
      headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-Vyro': '1' },
      body: method === 'GET' ? undefined : JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) throw ApiError(data.error || t('errors.generic'), data.field, r.status);
        return data;
      });
    }, function () {
      throw ApiError(t('errors.network'));
    });
  }

  const server = {
    me: function () { return call('GET', 'auth/me').then(function (d) { return d.user; }); },
    register: function (b) { return call('POST', 'auth/register', b).then(function (d) { return d.user; }); },
    login: function (b) { return call('POST', 'auth/login', b).then(function (d) { return d.user; }); },
    logout: function () { return call('POST', 'auth/logout'); },
    forgot: function (email) { return call('POST', 'auth/forgot', { email: email }); },
    reset: function (token, password) { return call('POST', 'auth/reset', { token: token, password: password }).then(function (d) { return d.user; }); },
    updateProfile: function (b) { return call('PUT', 'account/profile', b).then(function (d) { return d.user; }); },
    updateSettings: function (b) { return call('PUT', 'account/settings', b).then(function (d) { return d.user; }); },
    changePassword: function (b) { return call('PUT', 'account/password', b); },
    deleteAccount: function (b) { return call('DELETE', 'account', b); },
    wishlist: function () { return call('GET', 'wishlist').then(function (d) { return d.items; }); },
    wishAdd: function (slug, color) { return call('POST', 'wishlist', { slug: slug, color: color }).then(function (d) { return d.items; }); },
    wishRemove: function (slug) { return call('DELETE', 'wishlist', { slug: slug }).then(function (d) { return d.items; }); },
    addresses: function () { return call('GET', 'addresses').then(function (d) { return d.items; }); },
    addAddress: function (a) { return call('POST', 'addresses', a).then(function (d) { return d.items; }); },
    updateAddress: function (a) { return call('PUT', 'addresses', a).then(function (d) { return d.items; }); },
    removeAddress: function (id) { return call('DELETE', 'addresses', { id: id }).then(function (d) { return d.items; }); },
    orders: function () { return call('GET', 'orders').then(function (d) { return d.items; }); },
    placeOrder: function (b) { return call('POST', 'orders', b).then(function (d) { return d.order; }); }
  };

  /* ------------------------------------------------------------------ *
   * Browser-only adapter (static hosting / preview)
   * ------------------------------------------------------------------ */
  const DB_KEY = 'vyro-local-db', SESSION_KEY = 'vyro-local-session';
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function load() {
    try { return JSON.parse(localStorage.getItem(DB_KEY)) || null; } catch (e) { return null; }
  }
  let mem = load() || { nextId: 1, users: [], wishlist: {}, addresses: {}, orders: {}, resets: {} };
  function save() { try { localStorage.setItem(DB_KEY, JSON.stringify(mem)); } catch (e) { /* storage off */ } }
  function sessionId() { try { return Number(localStorage.getItem(SESSION_KEY)) || null; } catch (e) { return null; } }
  function setSession(id) { try { id ? localStorage.setItem(SESSION_KEY, String(id)) : localStorage.removeItem(SESSION_KEY); } catch (e) { /* storage off */ } }
  function rand() {
    const a = new Uint8Array(24); (window.crypto || {}).getRandomValues ? window.crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; });
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function hash(pw, salt) {
    const subtle = window.crypto && window.crypto.subtle;
    if (!subtle) return Promise.resolve('plain$' + salt + '$' + pw);
    const enc = new TextEncoder();
    return subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']).then(function (key) {
      return subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 120000, hash: 'SHA-256' }, key, 256);
    }).then(function (bits) {
      return 'pbkdf2$' + salt + '$' + Array.prototype.map.call(new Uint8Array(bits), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    });
  }
  function pub(u) { return { id: u.id, email: u.email, name: u.name, marketing: !!u.marketing, units: u.units || 'metric', createdAt: u.createdAt }; }
  function me() { const id = sessionId(); return mem.users.filter(function (u) { return u.id === id; })[0] || null; }
  function need() { const u = me(); if (!u) throw ApiError(t('errors.loginRequired'), null, 401); return u; }
  function checkEmail(e) {
    e = String(e || '').trim().toLowerCase();
    if (!EMAIL_RE.test(e)) throw ApiError(t('errors.email'), 'email');
    return e;
  }
  function checkPw(pw, field) {
    if (typeof pw !== 'string' || pw.length < 8) throw ApiError(t('errors.passwordLength'), field || 'password');
    return pw;
  }
  // what: key under errors.enter (name, fullName, address, city, postcode, country)
  function required(v, what, field) {
    const s = String(v || '').trim();
    if (!s) throw ApiError(t('errors.enter.' + what), field);
    return s;
  }
  function addrFrom(b) {
    return {
      name: required(b.name, 'fullName', 'name'), line1: required(b.line1, 'address', 'line1'), line2: String(b.line2 || '').trim(),
      city: required(b.city, 'city', 'city'), postcode: required(b.postcode, 'postcode', 'postcode'),
      country: required(b.country, 'country', 'country'), phone: String(b.phone || '').trim()
    };
  }
  function passOk(u, pw) { return hash(String(pw || ''), u.passHash.split('$')[1]).then(function (h) { return h === u.passHash; }); }
  const tryP = function (fn) { return new Promise(function (res) { res(fn()); }); };

  const local = {
    me: function () { return tryP(function () { const u = me(); return u ? pub(u) : null; }); },
    register: function (b) {
      return tryP(function () {
        const name = required(b.name, 'name', 'name'), email = checkEmail(b.email), pw = checkPw(b.password);
        if (mem.users.some(function (u) { return u.email === email; })) throw ApiError(t('errors.emailExists'), 'email');
        const salt = rand();
        return hash(pw, salt).then(function (h) {
          const u = { id: mem.nextId++, email: email, name: name, passHash: h, marketing: !!b.marketing, units: 'metric', createdAt: new Date().toISOString() };
          mem.users.push(u); save(); setSession(u.id);
          return pub(u);
        });
      });
    },
    login: function (b) {
      return tryP(function () {
        const email = checkEmail(b.email);
        const u = mem.users.filter(function (x) { return x.email === email; })[0];
        const fail = ApiError(t('errors.badLogin'), null, 401);
        if (!u) throw fail;
        return passOk(u, b.password).then(function (ok) { if (!ok) throw fail; setSession(u.id); return pub(u); });
      });
    },
    logout: function () { setSession(null); return Promise.resolve({ ok: true }); },
    forgot: function (email) {
      return tryP(function () {
        email = checkEmail(email);
        const u = mem.users.filter(function (x) { return x.email === email; })[0];
        const out = { ok: true };
        if (u) {
          const t = rand();
          mem.resets[t] = { id: u.id, exp: Date.now() + 3600e3 }; save();
          out.devResetLink = new URL('account.html?reset=' + t, location.href).href;
        }
        return out;
      });
    },
    reset: function (token, pw) {
      return tryP(function () {
        checkPw(pw);
        const r = mem.resets[token];
        if (!r || r.exp < Date.now()) throw ApiError(t('errors.resetExpired'));
        const u = mem.users.filter(function (x) { return x.id === r.id; })[0];
        delete mem.resets[token];
        const salt = rand();
        return hash(pw, salt).then(function (h) { u.passHash = h; save(); setSession(u.id); return pub(u); });
      });
    },
    updateProfile: function (b) {
      return tryP(function () {
        const u = need(), name = required(b.name, 'name', 'name'), email = checkEmail(b.email);
        if (mem.users.some(function (x) { return x.email === email && x.id !== u.id; })) throw ApiError(t('errors.emailTaken'), 'email');
        u.name = name; u.email = email; save(); return pub(u);
      });
    },
    updateSettings: function (b) {
      return tryP(function () { const u = need(); u.marketing = !!b.marketing; u.units = b.units === 'imperial' ? 'imperial' : 'metric'; save(); return pub(u); });
    },
    changePassword: function (b) {
      return tryP(function () {
        const u = need(); checkPw(b.password);
        return passOk(u, b.current).then(function (ok) {
          if (!ok) throw ApiError(t('errors.currentPassword'), 'current');
          const salt = rand();
          return hash(b.password, salt).then(function (h) { u.passHash = h; save(); return { ok: true }; });
        });
      });
    },
    deleteAccount: function (b) {
      return tryP(function () {
        const u = need();
        return passOk(u, b.password).then(function (ok) {
          if (!ok) throw ApiError(t('errors.passwordWrong'), 'password');
          mem.users = mem.users.filter(function (x) { return x.id !== u.id; });
          delete mem.wishlist[u.id]; delete mem.addresses[u.id]; delete mem.orders[u.id];
          save(); setSession(null); return { ok: true };
        });
      });
    },
    wishlist: function () { return tryP(function () { return (mem.wishlist[need().id] || []).slice(); }); },
    wishAdd: function (slug, color) {
      return tryP(function () {
        const u = need();
        const list = (mem.wishlist[u.id] || []).filter(function (i) { return i.slug !== slug; });
        list.unshift({ slug: slug, color: color, createdAt: new Date().toISOString() });
        mem.wishlist[u.id] = list; save(); return list.slice();
      });
    },
    wishRemove: function (slug) {
      return tryP(function () {
        const u = need();
        mem.wishlist[u.id] = (mem.wishlist[u.id] || []).filter(function (i) { return i.slug !== slug; });
        save(); return mem.wishlist[u.id].slice();
      });
    },
    addresses: function () { return tryP(function () { return (mem.addresses[need().id] || []).slice(); }); },
    addAddress: function (b) {
      return tryP(function () {
        const u = need(), a = addrFrom(b), list = mem.addresses[u.id] || [];
        if (list.length >= 10) throw ApiError(t('errors.maxAddresses'));
        a.id = Date.now(); a.isDefault = !!b.isDefault || !list.length;
        if (a.isDefault) list.forEach(function (x) { x.isDefault = false; });
        list.push(a); mem.addresses[u.id] = list; save();
        return list.slice().sort(function (x, y) { return y.isDefault - x.isDefault; });
      });
    },
    updateAddress: function (b) {
      return tryP(function () {
        const u = need(), list = mem.addresses[u.id] || [];
        const cur = list.filter(function (x) { return x.id === Number(b.id); })[0];
        if (!cur) throw ApiError(t('errors.addressNotFound'), null, 404);
        const a = addrFrom(b);
        if (b.isDefault) list.forEach(function (x) { x.isDefault = false; });
        Object.assign(cur, a, { isDefault: b.isDefault ? true : cur.isDefault });
        save(); return list.slice().sort(function (x, y) { return y.isDefault - x.isDefault; });
      });
    },
    removeAddress: function (id) {
      return tryP(function () {
        const u = need();
        let list = (mem.addresses[u.id] || []);
        const gone = list.filter(function (x) { return x.id === Number(id); })[0];
        list = list.filter(function (x) { return x.id !== Number(id); });
        if (gone && gone.isDefault && list[0]) list[0].isDefault = true;
        mem.addresses[u.id] = list; save(); return list.slice();
      });
    },
    orders: function () { return tryP(function () { return (mem.orders[need().id] || []).slice(); }); },
    placeOrder: function (b) {
      return tryP(function () {
        const u = me();
        const email = u ? u.email : checkEmail(b.email);
        const address = addrFrom(b.address || {});
        if (!b.items || !b.items.length) throw ApiError(t('errors.bagEmpty'));
        const items = b.items.map(function (i) {
          const p = Shop.get(i.slug);
          return { slug: i.slug, name: p.name, color: i.color, size: i.size, qty: i.qty, unit: p.price, line: p.price * i.qty };
        });
        const subtotal = items.reduce(function (n, i) { return n + i.line; }, 0);
        const shipping = subtotal >= Shop.FREE_SHIPPING ? 0 : 5.95;
        const order = {
          number: 'VY-' + Date.now().toString(36).toUpperCase().slice(-5) + rand().slice(0, 4).toUpperCase(),
          status: 'Processing', createdAt: new Date().toISOString(), email: email,
          items: items, address: address, subtotal: subtotal, shipping: shipping, total: subtotal + shipping
        };
        if (u) { (mem.orders[u.id] = mem.orders[u.id] || []).unshift(order); save(); }
        return order;
      });
    }
  };

  /* ------------------------------------------------------------------ *
   * Public client: picks an adapter, caches the user and wishlist
   * ------------------------------------------------------------------ */
  let adapter = null;
  let user = null;
  let wish = [];

  function detect() {
    const ctrl = window.AbortController ? new AbortController() : null;
    const t = setTimeout(function () { if (ctrl) ctrl.abort(); }, 2500);
    return fetch('api/health', { signal: ctrl && ctrl.signal, credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return !!(d && d.ok); }, function () { return false; })
      .then(function (ok) { clearTimeout(t); return ok; });
  }

  const ready = detect().then(function (ok) {
    adapter = ok ? server : local;
    Account.mode = ok ? 'server' : 'local';
    return adapter.me();
  }).then(function (u) {
    user = u;
    return u ? adapter.wishlist() : [];
  }).then(function (w) {
    wish = w || [];
    emit('vyro:auth', user);
    emit('vyro:wishlist', wish);
    return Account;
  }, function () {
    adapter = adapter || local;
    emit('vyro:auth', null);
    return Account;
  });

  function run(name) {
    const args = Array.prototype.slice.call(arguments, 1);
    return ready.then(function () { return adapter[name].apply(null, args); });
  }
  function signedIn(u) {
    user = u;
    emit('vyro:auth', user);
    return adapter.wishlist().then(function (w) { wish = w; emit('vyro:wishlist', wish); return u; });
  }
  function setWish(w) { wish = w; emit('vyro:wishlist', wish); return w; }

  const Account = {
    mode: 'pending',
    ready: ready,
    user: function () { return user; },
    wishlist: function () { return wish.slice(); },
    isWished: function (slug) { return wish.some(function (i) { return i.slug === slug; }); },

    register: function (b) { return run('register', b).then(signedIn); },
    login: function (b) { return run('login', b).then(signedIn); },
    logout: function () { return run('logout').then(function () { user = null; wish = []; emit('vyro:auth', null); emit('vyro:wishlist', wish); }); },
    forgot: function (email) { return run('forgot', email); },
    reset: function (token, pw) { return run('reset', token, pw).then(signedIn); },
    updateProfile: function (b) { return run('updateProfile', b).then(function (u) { user = u; emit('vyro:auth', u); return u; }); },
    updateSettings: function (b) { return run('updateSettings', b).then(function (u) { user = u; emit('vyro:auth', u); return u; }); },
    changePassword: function (b) { return run('changePassword', b); },
    deleteAccount: function (b) { return run('deleteAccount', b).then(function () { user = null; wish = []; emit('vyro:auth', null); emit('vyro:wishlist', wish); }); },

    toggleWish: function (slug, color) {
      return Account.isWished(slug)
        ? run('wishRemove', slug).then(setWish).then(function () { return false; })
        : run('wishAdd', slug, color).then(setWish).then(function () { return true; });
    },
    removeWish: function (slug) { return run('wishRemove', slug).then(setWish); },

    addresses: function () { return run('addresses'); },
    addAddress: function (a) { return run('addAddress', a); },
    updateAddress: function (a) { return run('updateAddress', a); },
    removeAddress: function (id) { return run('removeAddress', id); },
    orders: function () { return run('orders'); },
    placeOrder: function (b) { return run('placeOrder', b); }
  };

  window.VyroAccount = Account;
})();

/*
  VYRO translations: one engine, one dictionary per language (js/i18n/*.js).

  Languages: fi (default), en, sv. The choice is remembered in localStorage
  and in a cookie (vyro_lang) so server code, such as the Vercel functions
  that will talk to Shopify, can read it too. ?lang=sv in any URL switches
  and remembers the language.

  In HTML:
    <span data-i18n="key">Fallback text</span>          text content
    <p data-i18n-html="key">…</p>                         trusted markup from the dictionary
    <img data-i18n-attr="alt:key; title:key2">           attributes
  In JS:
    VyroI18n.t('cart.items', { count: 3 })               {name} placeholders, plural objects
    VyroI18n.money(85)                                    "85 €" / "€85"

  For the Shopify Storefront API later: VyroI18n.storefront gives
  { language: 'FI', country: 'FI' } for @inContext(language:, country:).
*/
(function () {
  const LANGS = {
    fi: { locale: 'fi-FI', label: 'FI', name: 'Suomi', storefront: 'FI' },
    en: { locale: 'en-IE', label: 'EN', name: 'English', storefront: 'EN' },
    sv: { locale: 'sv-FI', label: 'SV', name: 'Svenska', storefront: 'SV' }
  };
  const DEFAULT = 'fi';
  const FALLBACK = 'en';
  const KEY = 'vyro-lang';
  const COOKIE = 'vyro_lang';
  const CURRENCY = 'EUR';
  const dicts = {};

  function valid(l) { return Object.prototype.hasOwnProperty.call(LANGS, l) ? l : null; }
  function readStored() {
    try { const v = valid(localStorage.getItem(KEY)); if (v) return v; } catch (e) { /* storage off */ }
    const m = document.cookie.match(/(?:^|;\s*)vyro_lang=([a-z]{2})/);
    return m ? valid(m[1]) : null;
  }
  function store(l) {
    try { localStorage.setItem(KEY, l); } catch (e) { /* storage off */ }
    document.cookie = COOKIE + '=' + l + '; path=/; max-age=31536000; samesite=lax';
  }

  // ?lang= wins (shareable links), then the saved choice, then Finnish
  let lang = DEFAULT;
  try {
    const q = valid(new URLSearchParams(location.search).get('lang'));
    lang = q || readStored() || DEFAULT;
    if (q) store(q);
  } catch (e) { lang = readStored() || DEFAULT; }
  document.documentElement.lang = lang;

  function lookup(l, key) {
    const d = dicts[l];
    if (!d) return undefined;
    return key.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, d);
  }

  const warned = {};
  function t(key, vars) {
    let v = lookup(lang, key);
    if (v === undefined) v = lookup(FALLBACK, key);
    if (v === undefined) {
      if (!warned[key] && window.console) { warned[key] = 1; console.warn('[i18n] missing key: ' + key); }
      return key;
    }
    vars = vars || {};
    if (v && typeof v === 'object') {
      const n = Number(vars.count);
      const form = n === 0 && v.zero !== undefined ? 'zero'
        : window.Intl && Intl.PluralRules ? new Intl.PluralRules(LANGS[lang].locale).select(n) : (n === 1 ? 'one' : 'other');
      v = v[form] !== undefined ? v[form] : v.other;
    }
    return String(v).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m; });
  }

  // Euro amounts in the language's own format, no trailing ",00"
  const fmt = {};
  function money(n) {
    n = Math.round(Number(n || 0) * 100) / 100;
    const whole = n % 1 === 0;
    const k = lang + (whole ? '0' : '2');
    if (!fmt[k]) {
      try {
        fmt[k] = new Intl.NumberFormat(LANGS[lang].locale, { style: 'currency', currency: CURRENCY, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
      } catch (e) { fmt[k] = { format: function (x) { return '€' + x.toFixed(whole ? 0 : 2); } }; }
    }
    return fmt[k].format(n);
  }

  function date(value, opts) {
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d)) return '';
    return d.toLocaleDateString(LANGS[lang].locale, opts || { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Apply translations to static markup
  function apply(root) {
    root = root || document;
    const q = function (s) { return Array.prototype.slice.call(root.querySelectorAll(s)); };
    q('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    q('[data-i18n-html]').forEach(function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    q('[data-money]').forEach(function (el) { el.textContent = money(el.getAttribute('data-money')); });
    q('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        const i = pair.indexOf(':');
        if (i < 0) return;
        const attr = pair.slice(0, i).trim(), key = pair.slice(i + 1).trim();
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });
    document.documentElement.classList.remove('i18n-pending');
  }

  // Switching reloads the page, so every script and animation runs again
  // in the new language exactly as it does on a normal page load
  function setLang(l) {
    l = valid(l);
    if (!l) return;
    store(l);
    if (l === lang) return;
    const u = new URL(location.href);
    if (u.searchParams.has('lang')) { u.searchParams.delete('lang'); location.replace(u.pathname + u.search + u.hash); return; }
    location.reload();
  }

  // Header / mobile menu language buttons (markup from switcherHTML)
  function switcherHTML(extraClass) {
    return '<div class="lang' + (extraClass ? ' ' + extraClass : '') + '" role="group" aria-label="' + t('lang.label') + '">' +
      Object.keys(LANGS).map(function (l) {
        return '<button type="button" class="lang__btn" data-lang="' + l + '" lang="' + l + '" aria-pressed="' + (l === lang) + '" aria-label="' + LANGS[l].name + '">' + LANGS[l].label + '</button>';
      }).join('') + '</div>';
  }
  document.addEventListener('click', function (e) {
    const b = e.target.closest && e.target.closest('[data-lang]');
    if (b) { e.preventDefault(); setLang(b.getAttribute('data-lang')); }
  });

  window.VyroI18n = {
    languages: Object.keys(LANGS),
    get lang() { return lang; },
    get locale() { return LANGS[lang].locale; },
    get storefront() { return { language: LANGS[lang].storefront, country: 'FI' }; },
    add: function (l, dict) { dicts[l] = dict; },
    has: function (key) { return lookup(lang, key) !== undefined || lookup(FALLBACK, key) !== undefined; },
    // Raw dictionary value (arrays, objects), current language then English
    raw: function (key) { const v = lookup(lang, key); return v !== undefined ? v : lookup(FALLBACK, key); },
    // Search words in the visitor's language map to the catalogue's words
    // ("huppari" -> "hoodie", "grå" -> "gray") before matching
    searchAlias: function (q) {
      const a = Object.assign({}, lookup(FALLBACK, 'search.aliases') || {}, lookup(lang, 'search.aliases') || {});
      return String(q || '').toLowerCase().split(/\s+/).map(function (w) { return a[w] || w; }).join(' ');
    },
    t: t,
    money: money,
    date: date,
    apply: apply,
    setLang: setLang,
    switcherHTML: switcherHTML
  };
})();

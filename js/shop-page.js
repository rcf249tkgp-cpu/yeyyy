/*
  VYRO shop listing: filters + sorting + search results.
  Filters combine with AND across groups and OR within a group.
  State lives in the URL (shareable, survives refresh), e.g.
  shop.html?type=Hoodies,Tees&color=navy&price=40-70&sort=price-asc&q=fleece
*/
(function () {
  const Shop = window.VyroShop;
  const Page = window.VyroPage;
  const gsap = window.gsap;
  const esc = Shop.esc;
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  const root = $('[data-shop]');

  /* ------------------------------------------------------------------ *
   * Filter definitions
   * ------------------------------------------------------------------ */
  const TYPES = Shop.PRODUCTS.map(function (p) { return p.category; }).filter(function (c, i, a) { return a.indexOf(c) === i; });
  const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const PRICES = [
    { id: 'u40', label: 'Under €40', test: function (n) { return n < 40; } },
    { id: '40-70', label: '€40 to €70', test: function (n) { return n >= 40 && n <= 70; } },
    { id: '70-100', label: '€70 to €100', test: function (n) { return n > 70 && n <= 100; } },
    { id: 'o100', label: 'Over €100', test: function (n) { return n > 100; } }
  ];
  const GROUPS = [
    { key: 'gender', label: 'Gender', options: [{ id: 'men', label: 'Men' }, { id: 'women', label: 'Women', note: 'Coming soon' }],
      test: function (p, v) { return v.indexOf(p.gender) > -1; } },
    { key: 'type', label: 'Product type', options: TYPES.map(function (t) { return { id: t, label: t }; }),
      test: function (p, v) { return v.indexOf(p.category) > -1; } },
    { key: 'price', label: 'Price', options: PRICES.map(function (x) { return { id: x.id, label: x.label }; }),
      test: function (p, v) { return PRICES.some(function (x) { return v.indexOf(x.id) > -1 && x.test(p.price); }); } },
    { key: 'size', label: 'Size', options: SIZES.map(function (s) { return { id: s, label: s }; }), style: 'sizes',
      test: function (p, v) { return v.some(function (s) { return p.sizes.indexOf(s) > -1; }); } },
    { key: 'color', label: 'Color', options: Shop.COLOR_ORDER.map(function (c) { return { id: c, label: Shop.colorName(c) }; }), style: 'colors',
      test: function (p, v) { return v.some(function (c) { return Shop.COLOR_ORDER.indexOf(c) > -1; }); } },
    { key: 'new', label: 'New arrivals', options: [{ id: '1', label: 'New arrivals only' }],
      test: function (p) { return !!p.isNew; } }
  ];
  const SORTS = [
    { id: 'featured', label: 'Featured' },
    { id: 'newest', label: 'Newest' },
    { id: 'price-asc', label: 'Price: low to high' },
    { id: 'price-desc', label: 'Price: high to low' }
  ];

  /* ------------------------------------------------------------------ *
   * State <-> URL
   * ------------------------------------------------------------------ */
  const state = { sort: 'featured', q: '' };
  GROUPS.forEach(function (g) { state[g.key] = []; });
  (function read() {
    const u = new URLSearchParams(location.search);
    GROUPS.forEach(function (g) {
      const valid = g.options.map(function (o) { return o.id; });
      state[g.key] = (u.get(g.key) || '').split(',').filter(function (v) { return valid.indexOf(v) > -1; });
    });
    if (SORTS.some(function (s) { return s.id === u.get('sort'); })) state.sort = u.get('sort');
    state.q = (u.get('q') || '').slice(0, 80);
  })();
  function write() {
    const u = new URLSearchParams();
    if (state.q) u.set('q', state.q);
    GROUPS.forEach(function (g) { if (state[g.key].length) u.set(g.key, state[g.key].join(',')); });
    if (state.sort !== 'featured') u.set('sort', state.sort);
    const qs = u.toString().replace(/%2C/g, ',');
    history.replaceState(null, '', 'shop.html' + (qs ? '?' + qs : ''));
  }

  /* ------------------------------------------------------------------ *
   * Filtering + sorting
   * ------------------------------------------------------------------ */
  function base() {
    if (!state.q) return Shop.PRODUCTS.map(function (p, i) { return { product: p, color: null, score: 0, i: i }; });
    return Shop.search(state.q).map(function (h, i) { return { product: h.product, color: h.color, score: h.score, i: i }; });
  }
  function apply(list, except) {
    return list.filter(function (h) {
      return GROUPS.every(function (g) {
        if (g.key === except || !state[g.key].length) return true;
        return g.test(h.product, state[g.key]);
      });
    });
  }
  function sort(list) {
    const by = {
      featured: function (a, b) { return state.q ? a.i - b.i : a.product.featured - b.product.featured; },
      newest: function (a, b) { return b.product.added.localeCompare(a.product.added) || a.product.featured - b.product.featured; },
      'price-asc': function (a, b) { return a.product.price - b.product.price; },
      'price-desc': function (a, b) { return b.product.price - a.product.price; }
    }[state.sort];
    return list.slice().sort(by);
  }
  // Card colour: the first selected colour filter, else the search colour, else the product default
  function cardColor(h) { return state.color[0] || h.color || h.product.defaultColor; }

  /* ------------------------------------------------------------------ *
   * Render
   * ------------------------------------------------------------------ */
  function optionHTML(g, o) {
    const id = 'f-' + g.key + '-' + o.id.replace(/[^a-z0-9]/gi, '');
    const checked = state[g.key].indexOf(o.id) > -1 ? ' checked' : '';
    if (g.style === 'sizes') return '<label class="fopt fopt--size" for="' + id + '"><input type="checkbox" id="' + id + '" data-f="' + g.key + '" value="' + o.id + '"' + checked + '><span>' + o.label + '</span></label>';
    if (g.style === 'colors') return '<label class="fopt fopt--color" for="' + id + '"><input type="checkbox" id="' + id + '" data-f="' + g.key + '" value="' + o.id + '"' + checked + '><span class="fopt__dot" data-color="' + o.id + '"></span><span>' + o.label + '</span><span class="fopt__count" data-count="' + g.key + ':' + o.id + '"></span></label>';
    return '<label class="fopt" for="' + id + '"><input type="checkbox" id="' + id + '" data-f="' + g.key + '" value="' + o.id + '"' + checked + '><span class="fopt__box" aria-hidden="true"></span><span>' + o.label + (o.note ? ' <small>' + o.note + '</small>' : '') + '</span><span class="fopt__count" data-count="' + g.key + ':' + o.id + '"></span></label>';
  }

  root.innerHTML =
    '<nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="index.html">Home</a></li><li aria-current="page">Shop</li></ol></nav>' +
    '<header class="shop__head">' +
      '<h1 class="shop__title display" data-title>Shop all</h1>' +
      '<p class="shop__count" data-count-total role="status" aria-live="polite"></p>' +
    '</header>' +
    '<div class="shop__bar">' +
      '<button type="button" class="btn btn--ghost shop__filter-btn" data-filters-open aria-controls="filters" aria-expanded="false">Filters <span data-active-count></span></button>' +
      '<div class="shop__chips" data-chips></div>' +
      '<label class="shop__sort"><span>Sort by</span><select data-sort>' + SORTS.map(function (s) { return '<option value="' + s.id + '"' + (s.id === state.sort ? ' selected' : '') + '>' + s.label + '</option>'; }).join('') + '</select></label>' +
    '</div>' +
    '<div class="shop__layout">' +
      '<div class="filters" id="filters" data-filters>' +
        '<div class="filters__scrim" data-filters-close></div>' +
        '<aside class="filters__panel" aria-label="Filters" data-lenis-prevent>' +
          '<div class="filters__head"><h2 class="display">Filters</h2><button type="button" class="link-btn" data-clear>Clear all</button></div>' +
          '<div class="filters__groups">' +
            GROUPS.map(function (g) {
              return '<fieldset class="fgroup"><legend>' + g.label + '</legend><div class="fgroup__opts' + (g.style ? ' fgroup__opts--' + g.style : '') + '">' +
                g.options.map(function (o) { return optionHTML(g, o); }).join('') + '</div></fieldset>';
            }).join('') +
          '</div>' +
          '<div class="filters__foot"><button type="button" class="btn btn--solid" data-filters-close data-show-count>Show products</button></div>' +
        '</aside>' +
      '</div>' +
      '<section class="shop__results" aria-label="Products"><div class="shop__grid" data-grid></div></section>' +
    '</div>';

  const grid = $('[data-grid]');

  function render(animate) {
    const all = base();
    const hits = sort(apply(all));
    const n = hits.length;

    // Title + counts
    $('[data-title]').textContent = state.q ? 'Results for "' + state.q + '"' : state.new.length ? 'New arrivals' : 'Shop all';
    $('[data-count-total]').textContent = n + (n === 1 ? ' product' : ' products');
    $('[data-show-count]').textContent = n ? 'Show ' + n + (n === 1 ? ' product' : ' products') : 'No products match';
    const active = GROUPS.reduce(function (k, g) { return k + state[g.key].length; }, 0);
    $('[data-active-count]').textContent = active ? '(' + active + ')' : '';

    // Facet counts: how many results each option would give, keeping the other filters
    GROUPS.forEach(function (g) {
      const pool = apply(all, g.key);
      g.options.forEach(function (o) {
        const el = $('[data-count="' + g.key + ':' + o.id + '"]');
        const c = pool.filter(function (h) { return g.test(h.product, [o.id]); }).length;
        if (el) el.textContent = '(' + c + ')';
        const input = $('[data-f="' + g.key + '"][value="' + o.id + '"]');
        if (input) input.closest('.fopt').classList.toggle('is-empty', c === 0 && !input.checked);
      });
    });

    // Active filter chips
    const chips = [];
    if (state.q) chips.push('<button type="button" class="chip chip--on" data-chip="q">Search: ' + esc(state.q) + ' <span aria-hidden="true">×</span><span class="sr-only">, remove</span></button>');
    GROUPS.forEach(function (g) {
      state[g.key].forEach(function (v) {
        const o = g.options.filter(function (x) { return x.id === v; })[0];
        chips.push('<button type="button" class="chip chip--on" data-chip="' + g.key + ':' + v + '">' + esc(g.key === 'new' ? 'New arrivals' : o.label) + ' <span aria-hidden="true">×</span><span class="sr-only">, remove filter</span></button>');
      });
    });
    $('[data-chips]').innerHTML = chips.join('');

    // Grid
    grid.innerHTML = '';
    if (!n) {
      const womenOnly = state.gender.length === 1 && state.gender[0] === 'women';
      grid.innerHTML = '<div class="empty empty--wide">' +
        '<p class="empty__title display">' + (womenOnly ? 'The women\'s line is coming' : 'Nothing matches that') + '</p>' +
        '<p>' + (womenOnly ? 'Sign up for drop alerts on the home page and we\'ll tell you first.' : 'Try removing a filter or searching for something else.') + '</p>' +
        '<button type="button" class="btn btn--solid" data-clear>Clear all filters</button></div>';
    } else {
      Shop.mountCards(grid, hits.map(function (h) { return h.product; }), {
        reduced: Page.reduced,
        color: function (p) { return cardColor(hits.filter(function (h) { return h.product === p; })[0]); }
      });
      $$('.pcard', grid).forEach(function (card) {
        const p = Shop.get(card.dataset.slug);
        if (p.isNew) card.insertAdjacentHTML('afterbegin', '<span class="tag pcard__tag">New</span>');
      });
      if (animate && gsap && !Page.reduced) gsap.from($$('.pcard', grid), { y: 24, opacity: 0, duration: 0.6, stagger: 0.05, ease: 'power3.out', clearProps: 'all' });
    }
    write();
  }

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */
  root.addEventListener('change', function (e) {
    const t = e.target;
    if (t.matches('[data-f]')) {
      const list = state[t.dataset.f];
      const i = list.indexOf(t.value);
      if (t.checked && i < 0) list.push(t.value);
      if (!t.checked && i > -1) list.splice(i, 1);
      render(true);
    }
    if (t.matches('[data-sort]')) { state.sort = t.value; render(true); }
  });
  root.addEventListener('click', function (e) {
    const chip = e.target.closest('[data-chip]');
    if (chip) {
      const k = chip.dataset.chip;
      if (k === 'q') state.q = '';
      else {
        const parts = k.split(':');
        state[parts[0]] = state[parts[0]].filter(function (v) { return v !== parts[1]; });
        const input = $('[data-f="' + parts[0] + '"][value="' + parts[1] + '"]');
        if (input) input.checked = false;
      }
      render(true);
      return;
    }
    if (e.target.closest('[data-clear]')) {
      GROUPS.forEach(function (g) { state[g.key] = []; });
      state.q = '';
      $$('[data-f]', root).forEach(function (i) { i.checked = false; });
      render(true);
    }
  });

  // Mobile filter sheet
  const sheet = $('[data-filters]');
  const openBtn = $('[data-filters-open]');
  let lockOn = false;
  function setSheet(open) {
    sheet.classList.toggle('is-open', open);
    openBtn.setAttribute('aria-expanded', String(open));
    if (open !== lockOn && Page.lenis) { open ? Page.lenis.stop() : Page.lenis.start(); }
    document.documentElement.classList.toggle('is-locked', open);
    lockOn = open;
    if (open) setTimeout(function () { const f = $('.fgroup input', sheet); if (f) f.focus(); }, 50);
    else openBtn.focus({ preventScroll: true });
  }
  openBtn.addEventListener('click', function () { setSheet(!sheet.classList.contains('is-open')); });
  $$('[data-filters-close]', sheet).forEach(function (b) { b.addEventListener('click', function () { setSheet(false); }); });
  sheet.addEventListener('keydown', function (e) { if (e.key === 'Escape') setSheet(false); });

  render(false);
})();

/*
  VYRO shop core, shared by the home page and the product page.

  - PRODUCTS: the single source of truth for every product (name, price,
    copy, sizes, colorways and the photos used for each colorway).
  - url(): the product page route, product.html?id=<slug>&color=<color>
  - cardHTML(): the product card component (home rail + related products)
  - switchCard(): colorway switching on a card
  - Bag: persisted in localStorage so the count follows you between pages
*/
(function () {
  const I18n = window.VyroI18n;
  const t = I18n.t;
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ------------------------------------------------------------------ *
   * Catalogue
   * ------------------------------------------------------------------ */
  const COLORS = {
    black: { name: 'Black' },
    navy: { name: 'Navy' },
    gray: { name: 'Gray' }
  };
  const COLOR_ORDER = ['black', 'navy', 'gray'];
  const TOPS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const BOTTOMS = ['S', 'M', 'L', 'XL', 'XXL'];

  const P = 'assets/products/';
  const PH = 'assets/photos/';

  function flat(src, alt) { return { src: P + src, fit: 'contain', alt: alt }; }
  function photo(src, alt) { return { src: src.indexOf('/') > -1 ? src : PH + src, fit: 'cover', alt: alt }; }
  function life(n, alt) { return photo('life-' + n + '.webp', alt || 'worn in the gym'); }

  const SHIPPING = 'Free standard shipping on orders over €80. Orders ship within 2 working days. Unworn items can be returned within 30 days for a full refund.';

  const PRODUCTS = [
    {
      slug: 'athletics-club-hoodie',
      gender: 'men', added: '2026-09-01', featured: 1, isNew: false,
      tags: ['hoodie', 'hoodies', 'fleece', 'pullover', 'athletics club', 'heavyweight', 'oversized', 'warm-up', 'tops'],
      look: ['club-jogger', 'oversized-tee', 'training-short'],
      name: 'Athletics Club Hoodie',
      category: 'Hoodies',
      price: 85,
      meta: 'Heavyweight fleece, boxy fit',
      defaultColor: 'black',
      sizes: TOPS,
      lede: 'The piece Drop 01 was built around. Heavyweight fleece, a boxy cut and the full club mark across the back.',
      description: 'Heavyweight brushed fleece with a dropped shoulder and a boxy cut that sits right over a lifter\'s frame. A small brush-stroke VYRO on the chest, the full Athletics Club mark across the back, and drawcords finished with engraved metal aglets.',
      features: ['Heavyweight brushed-back fleece', 'Dropped shoulder, boxy fit', 'Lined hood with flat drawcords', 'Engraved metal aglets', 'Kangaroo pocket', 'Ribbed cuffs and hem', 'Chest and back print'],
      fit: 'Oversized fit. Take your usual size for the intended look, or size down for a closer fit.',
      care: 'Machine wash cold, inside out. Do not tumble dry. Do not iron the print.',
      card: [{ src: P + 'hoodie-{c}-front.webp', w: 284, h: 334 }],
      gallery: function (c) {
        const L = { black: [1, 2], navy: [3, 4], gray: [5, 6] }[c];
        return [
          flat('hoodie-' + c + '.webp', 'front and back'),
          flat('hoodie-' + c + '-front.webp', 'front'),
          life(L[0]), life(L[1], 'back print, worn in the gym'),
          photo(P + 'detail-' + c + '-chest.webp', 'chest print close-up'),
          photo(P + 'detail-' + c + '-aglet.webp', 'engraved aglets close-up')
        ];
      }
    },
    {
      slug: 'oversized-tee',
      gender: 'men', added: '2026-09-22', featured: 3, isNew: true,
      tags: ['tee', 'tees', 't-shirt', 'tshirt', 'shirt', 'oversized', 'boxy', 'back print', 'cotton', 'tops'],
      look: ['training-short', 'athletics-club-hoodie', 'club-jogger'],
      name: 'Oversized Tee',
      category: 'Tees',
      price: 40,
      meta: 'Dropped shoulder, big back print',
      defaultColor: 'navy',
      sizes: TOPS,
      lede: 'Boxy, heavyweight and cut to hang right over broad shoulders. Small mark on the chest, the full brush-stroke VYRO across the back.',
      description: 'A heavyweight cotton tee with a dropped shoulder and a boxy, slightly cropped body, so it hangs clean over a trained frame instead of clinging to it. The distressed brush-stroke VYRO runs across the back; a smaller mark sits on the chest.',
      features: ['Heavyweight cotton jersey', 'Dropped shoulder', 'Boxy, slightly cropped body', 'Large distressed back print', 'Small chest print', 'Woven neck label'],
      fit: 'Oversized fit. Size down for a standard fit.',
      care: 'Machine wash cold, inside out. Hang to dry. Do not iron the print.',
      card: [{ src: P + 'tee-{c}-front.webp', w: 244, h: 285 }],
      gallery: function (c) {
        const g = [
          flat('tee-' + c + '-front.webp', 'front'),
          flat('tee-' + c + '.webp', 'front and back'),
          photo('tee-model-' + c + '-front.webp', 'worn, front'),
          photo('tee-model-' + c + '-back.webp', 'worn, back print')
        ];
        if (c === 'black') g.push(photo(P + 'detail-tee-back.webp', 'back print close-up'), photo(P + 'detail-tee-neck.webp', 'neck label close-up'), photo(P + 'detail-tee-sleeve.webp', 'sleeve close-up'));
        return g;
      }
    },
    {
      slug: 'premium-tank',
      gender: 'men', added: '2026-09-22', featured: 4, isNew: true,
      tags: ['tank', 'tanks', 'tank top', 'vest', 'sleeveless', 'singlet', 'arm day', 'cotton', 'tops'],
      look: ['training-short', 'athletics-club-hoodie', 'club-jogger'],
      name: 'Premium Tank',
      category: 'Tanks',
      price: 32,
      meta: 'Clean silhouette, premium cotton',
      defaultColor: 'gray',
      sizes: TOPS,
      lede: 'A clean, athletic tank for arm day and everything after. Regular side fit, no deep drop-offs.',
      description: 'Cut from premium cotton with a regular side fit and no deep side drop-offs, so it stays sharp in the gym and wearable outside it. Athletic through the chest and back, with a small brush-stroke mark on the chest.',
      features: ['Premium cotton', 'Regular side fit, no side drop-offs', 'Clean silhouette', 'Athletic fit', 'Small chest print', 'Woven neck label'],
      fit: 'Athletic fit. True to size.',
      care: 'Machine wash cold. Hang to dry.',
      card: [{ src: P + 'tank-{c}-front.webp', w: 160, h: 248 }],
      gallery: function (c) {
        const g = [
          flat('tank-' + c + '-front.webp', 'front'),
          flat('tank-' + c + '.webp', 'front and back'),
          photo('tank-model-' + c + '-front.webp', 'worn, front'),
          photo('tank-model-' + c + '-back.webp', 'worn, back'),
          photo('tank-model-' + c + '-side.webp', 'worn, side')
        ];
        if (c === 'black') g.push(photo(P + 'detail-tank-label.webp', 'neck label close-up'));
        return g;
      }
    },
    {
      slug: 'club-jogger',
      gender: 'men', added: '2026-09-01', featured: 2, isNew: false,
      tags: ['jogger', 'joggers', 'sweatpants', 'pants', 'trackpants', 'fleece', 'leg print', 'bottoms'],
      look: ['athletics-club-hoodie', 'oversized-tee', 'premium-tank'],
      name: 'Club Jogger',
      category: 'Joggers',
      price: 70,
      meta: 'Tapered, ribbed cuff, leg print',
      defaultColor: 'navy',
      sizes: BOTTOMS,
      lede: 'Tapered through the leg with ribbed cuffs that stay put, and the VYRO mark running down the side.',
      description: 'The matching bottom to the Athletics Club Hoodie. Heavyweight fleece, tapered through the leg and finished with ribbed cuffs that stay put. The brush-stroke mark runs down the side of the leg, with a small one on the front.',
      features: ['Heavyweight fleece', 'Tapered leg, ribbed cuffs', 'Elastic waist with flat drawcord', 'Engraved metal aglets', 'Side pockets', 'Full-length leg print'],
      fit: 'Regular fit through the seat and thigh, tapered to the ankle. True to size.',
      care: 'Machine wash cold, inside out. Do not tumble dry. Do not iron the print.',
      card: [{ src: P + 'jogger-{c}-front.webp', w: 172, h: 345 }],
      gallery: function (c) {
        const L = { black: 7, navy: 8, gray: 9 }[c];
        return [
          flat('jogger-' + c + '-front.webp', 'front'),
          flat('jogger-' + c + '.webp', 'front, back and side'),
          life(L),
          flat('jogger-' + c + '-side.webp', 'side print'),
          photo(P + 'detail-' + c + '-leg.webp', 'leg print close-up'),
          photo(P + 'detail-' + c + '-aglet.webp', 'engraved aglets close-up')
        ];
      }
    },
    {
      slug: 'training-short',
      gender: 'men', added: '2026-09-22', featured: 5, isNew: true,
      tags: ['short', 'shorts', 'gym shorts', 'training', 'leg day', 'squat', 'poly', 'bottoms'],
      look: ['premium-tank', 'oversized-tee', 'athletics-club-hoodie'],
      name: 'Training Short',
      category: 'Shorts',
      price: 45,
      meta: 'Side splits, leg print',
      defaultColor: 'black',
      sizes: BOTTOMS,
      lede: 'Built for squats and everything else on leg day. Side splits at the hem, the VYRO mark down the leg.',
      description: 'A premium poly-blend training short cut above the knee, with side splits at the hem so it moves with you at the bottom of a squat. Elastic waistband with drawcord, side pockets and the brush-stroke mark down the leg.',
      features: ['Premium poly blend', 'Elastic waistband with drawcord', 'Side pockets', 'Side-split hem', 'Leg print'],
      fit: 'Regular fit, above the knee. True to size.',
      care: 'Machine wash cold. Hang to dry.',
      card: [{ src: P + 'shorts-{c}-front.webp', w: 245, h: 245 }],
      gallery: function (c) {
        const g = [
          flat('shorts-' + c + '-front.webp', 'front'),
          flat('shorts-' + c + '.webp', 'front and back'),
          photo('shorts-model-' + c + '-front.webp', 'worn, front'),
          photo('shorts-model-' + c + '-side.webp', 'worn, side')
        ];
        if (c === 'black') g.push(photo(P + 'detail-shorts-split.webp', 'side split close-up'), photo(P + 'detail-shorts-logo.webp', 'leg print close-up'));
        return g;
      }
    },
    {
      slug: 'club-set',
      gender: 'men', added: '2026-09-01', featured: 6, isNew: false,
      tags: ['set', 'tracksuit', 'matching set', 'co-ord', 'hoodie', 'jogger', 'fleece', 'bundle'],
      look: ['oversized-tee', 'premium-tank', 'training-short'],
      name: 'Club Set',
      category: 'Sets',
      price: 145,
      meta: 'Hoodie and jogger, matched colorway',
      defaultColor: 'gray',
      sizes: BOTTOMS,
      lede: 'The Athletics Club Hoodie and Club Jogger in one matching colorway. Save €10 against buying them separately.',
      description: 'Both halves of the Drop 01 fleece set: the Athletics Club Hoodie and the Club Jogger, in the same colorway. Heavyweight fleece top to bottom, brush-stroke marks on the chest, back and leg.',
      features: ['Athletics Club Hoodie', 'Club Jogger', 'Matched colorway', 'Heavyweight fleece', 'Engraved metal aglets on both pieces'],
      fit: 'One size for both pieces. The hoodie is cut oversized; size down if you want a closer fit up top.',
      care: 'Machine wash cold, inside out. Do not tumble dry. Do not iron the prints.',
      card: [
        { src: P + 'hoodie-{c}-front.webp', w: 250, h: 334, cls: 'pimg--l' },
        { src: P + 'jogger-{c}-side.webp', w: 122, h: 345, cls: 'pimg--r' }
      ],
      gallery: function (c) {
        const L = { black: [7, 1], navy: [8, 3], gray: [5, 9] }[c];
        return [
          life(L[0], 'full set, worn in the gym'),
          flat('hoodie-' + c + '.webp', 'hoodie, front and back'),
          flat('jogger-' + c + '.webp', 'jogger, front, back and side'),
          life(L[1])
        ];
      }
    }
  ];

  const BY_SLUG = {};
  PRODUCTS.forEach(function (p) { BY_SLUG[p.slug] = p; });

  function get(slug) { return BY_SLUG[slug] || null; }
  function url(slug, color) {
    const p = get(slug);
    let u = 'product.html?id=' + encodeURIComponent(slug);
    if (color && p && color !== p.defaultColor) u += '&color=' + encodeURIComponent(color);
    return u;
  }
  // Colour and category labels in the visitor's language (product names and
  // copy stay as they are; they will come translated from Shopify later)
  function colorName(c) { return COLORS[c] ? t('colors.' + c) : t('colors.black'); }
  function categoryName(c) { return I18n.has('categories.' + c) ? t('categories.' + c) : c; }
  function price(n) { return I18n.money(n); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
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

  /* ------------------------------------------------------------------ *
   * Components
   * ------------------------------------------------------------------ */
  function swatchesHTML(label, checked, small) {
    return '<div class="swatches' + (small ? ' swatches--sm' : '') + '" role="radiogroup" aria-label="' + esc(t('card.colorway', { name: label })) + '">' +
      COLOR_ORDER.map(function (c) {
        return '<button type="button" role="radio" aria-checked="' + (c === checked) + '" class="swatch" data-color="' + c + '" aria-label="' + colorName(c) + '"></button>';
      }).join('') + '</div>';
  }

  // Wishlist heart. State and clicks are handled by js/chrome.js
  function wishHTML(slug, color, cls) {
    return '<button type="button" class="wish ' + (cls || '') + '" data-wish data-slug="' + slug + '" data-color="' + color + '" aria-pressed="false" aria-label="' + esc(t('wish.save', { name: get(slug).name })) + '">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9a4.6 4.6 0 0 1 6.5 6.5z"/></svg>' +
    '</button>';
  }

  function cardHTML(p, color) {
    color = color || p.defaultColor;
    const href = url(p.slug, color);
    const imgs = p.card.map(function (c) {
      return '<img class="pimg' + (c.cls ? ' ' + c.cls : '') + '" data-pimg="' + c.src + '" src="' + c.src.replace('{c}', color) +
        '" alt="' + esc(t('card.alt', { name: p.name, color: colorName(color).toLowerCase() })) + '" width="' + c.w + '" height="' + c.h + '" loading="lazy">';
    }).join('');
    return '' +
      '<article class="pcard" data-pcard data-slug="' + p.slug + '" data-color="' + color + '">' +
        wishHTML(p.slug, color, 'pcard__wish') +
        '<a class="pcard__link" href="' + href + '" data-card-link tabindex="-1" aria-hidden="true">' +
          '<div class="pcard__media' + (p.card.length > 1 ? ' pcard__media--set' : '') + '" data-hover-gl>' + imgs + '</div>' +
        '</a>' +
        '<div class="pcard__body">' +
          '<div class="pcard__row">' +
            '<h3 class="pcard__name"><a href="' + href + '" data-card-link>' + esc(p.name) + '</a></h3>' +
            '<span class="pcard__price">' + price(p.price) + '</span>' +
          '</div>' +
          '<p class="pcard__meta">' + esc(p.meta) + '</p>' +
          swatchesHTML(p.name, color, true) +
        '</div>' +
      '</article>';
  }

  // Arrow-key support for radiogroups (swatches, sizes)
  function radioKeys(group) {
    if (!group) return;
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

  // Colorway switch on a card: the new photo wipes up over the old one
  function switchCard(card, color, opts) {
    opts = opts || {};
    const prev = card.dataset.color;
    if (prev === color) return;
    const p = get(card.dataset.slug);
    card.dataset.color = color;
    $$('.swatch', card).forEach(function (s) { s.setAttribute('aria-checked', String(s.dataset.color === color)); });
    $$('[data-card-link]', card).forEach(function (a) { a.href = url(p.slug, color); });
    $$('[data-wish]', card).forEach(function (w) { w.dataset.color = color; });
    const media = card.querySelector('.pcard__media');
    const olds = $$('.pimg:not(.is-out)', media);
    const gsap = window.gsap;
    const animate = gsap && !opts.reduced;
    const incoming = olds.map(function (old) {
      old.classList.add('is-out');
      const n = old.cloneNode();
      n.classList.remove('is-out');
      n.removeAttribute('loading');
      n.alt = t('card.alt', { name: p.name, color: colorName(color).toLowerCase() });
      if (animate) n.style.clipPath = 'inset(100% 0% 0% 0%)';
      n.src = old.dataset.pimg.replace('{c}', color);
      old.after(n);
      fitPimg(n);
      n.addEventListener('load', function () { fitPimg(n); });
      return n;
    });
    Promise.all(incoming.map(whenLoaded)).then(function () {
      function done() {
        incoming.forEach(function (n) { n.style.clipPath = ''; });
        olds.forEach(function (o) { o.remove(); });
        if (opts.onDone) opts.onDone(card);
      }
      if (!animate) { done(); return; }
      gsap.to(incoming, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.75, ease: 'power3.inOut', onComplete: done });
      gsap.fromTo(incoming, { yPercent: 4 }, { yPercent: 0, duration: 0.9, ease: 'power3.out' });
    });
  }

  // Render cards into a container and wire up their swatches
  function mountCards(container, products, opts) {
    opts = opts || {};
    const html = products.map(function (p) { return cardHTML(p, opts.color && opts.color(p)); }).join('');
    if (opts.before) opts.before.insertAdjacentHTML('beforebegin', html);
    else container.insertAdjacentHTML('beforeend', html);
    const cards = $$('[data-pcard]', container);
    wrapPimgs(container);
    cards.forEach(function (card) {
      $$('.swatch', card).forEach(function (s) {
        s.addEventListener('click', function () { switchCard(card, s.dataset.color, opts); });
      });
      radioKeys(card.querySelector('.swatches'));
      $$('[data-card-link]', card).forEach(function (a) {
        a.addEventListener('click', function () {
          try { sessionStorage.setItem('vyro-return', JSON.stringify({ path: location.pathname, y: window.scrollY })); } catch (e) { /* storage off */ }
        });
      });
    });
    if (window.VyroChrome) window.VyroChrome.syncWish(container);
    return cards;
  }

  /* ------------------------------------------------------------------ *
   * Compact product row (search results, cart drawer, Complete the Look)
   * ------------------------------------------------------------------ */
  function thumb(p, color) {
    return p.card[0].src.replace('{c}', color);
  }
  function miniHTML(p, color, opts) {
    opts = opts || {};
    color = color || p.defaultColor;
    return '' +
      '<a class="mini" href="' + url(p.slug, color) + '">' +
        '<span class="mini__img"><img src="' + thumb(p, color) + '" alt="" loading="lazy"></span>' +
        '<span class="mini__text">' +
          '<span class="mini__name">' + esc(p.name) + '</span>' +
          '<span class="mini__meta">' + esc(opts.meta ? opts.meta : t('card.meta', { category: categoryName(p.category), color: colorName(color) })) + '</span>' +
        '</span>' +
        '<span class="mini__price">' + price(p.price) + '</span>' +
      '</a>';
  }

  /* ------------------------------------------------------------------ *
   * Search: name, category, tags and colour words
   * ------------------------------------------------------------------ */
  function norm(s) { return String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function search(q) {
    q = I18n.searchAlias(q); // "huppari" -> "hoodie", "grå" -> "gray"
    const terms = norm(q).split(' ').filter(Boolean);
    if (!terms.length) return [];
    const color = COLOR_ORDER.filter(function (c) { return terms.indexOf(c) > -1 || (c === 'gray' && terms.indexOf('grey') > -1); })[0] || null;
    const words = terms.filter(function (t) { return COLOR_ORDER.indexOf(t) < 0 && t !== 'grey'; });
    return PRODUCTS.map(function (p) {
      const name = norm(p.name), cat = norm(p.category), tags = p.tags.map(norm).join(' | ');
      let score = 0;
      for (let k = 0; k < words.length; k++) {
        const w = words[k];
        let hit = 0;
        if (name.split(' ').some(function (x) { return x.indexOf(w) === 0; })) hit = 3;
        else if (cat.indexOf(w) === 0 || cat.indexOf(' ' + w) > -1) hit = 2;
        else if (tags.indexOf(w) > -1) hit = 1;
        if (!hit) return null; // every word must match something
        score += hit;
      }
      if (!words.length) score = 1; // colour-only search matches everything
      return { product: p, color: color || p.defaultColor, score: score };
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score || a.product.featured - b.product.featured; });
  }

  /* ------------------------------------------------------------------ *
   * Bag (localStorage, so it persists across pages)
   * ------------------------------------------------------------------ */
  const BAG_KEY = 'vyro-bag';
  const FREE_SHIPPING = 80;
  const SHIPPING_FEE = 5.95;
  function readBag() {
    try {
      return (JSON.parse(localStorage.getItem(BAG_KEY) || '[]') || []).filter(function (i) { return get(i.slug); });
    } catch (e) { return []; }
  }
  function writeBag(items) {
    try { localStorage.setItem(BAG_KEY, JSON.stringify(items)); } catch (e) { /* storage off: bag lasts this page only */ }
  }
  let memoryBag = readBag();
  function changed(bump) {
    writeBag(memoryBag);
    renderBagCount(bump);
    window.dispatchEvent(new CustomEvent('vyro:bag'));
  }
  function bagItems() {
    return memoryBag.map(function (i, index) {
      const p = get(i.slug);
      return { index: index, slug: i.slug, color: i.color, size: i.size, qty: i.qty, product: p, unit: p.price, line: p.price * i.qty };
    });
  }
  function bagCount() { return memoryBag.reduce(function (n, i) { return n + i.qty; }, 0); }
  function totals() {
    const subtotal = bagItems().reduce(function (n, i) { return n + i.line; }, 0);
    const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING ? 0 : SHIPPING_FEE;
    return { subtotal: subtotal, shipping: shipping, total: subtotal + shipping, toFree: Math.max(0, FREE_SHIPPING - subtotal) };
  }
  function money(n) { return I18n.money(n); }
  function renderBagCount(bump) {
    $$('[data-bag-count]').forEach(function (el) { el.textContent = String(bagCount()); });
    if (bump) $$('[data-bag]').forEach(function (b) {
      b.classList.add('bump');
      setTimeout(function () { b.classList.remove('bump'); }, 600);
    });
  }
  function addToBag(item) {
    const same = memoryBag.filter(function (i) { return i.slug === item.slug && i.color === item.color && i.size === item.size; })[0];
    if (same) same.qty = Math.min(same.qty + item.qty, 10);
    else memoryBag.push({ slug: item.slug, color: item.color, size: item.size, qty: Math.min(item.qty, 10) });
    changed(true);
    window.dispatchEvent(new CustomEvent('vyro:added', { detail: item }));
  }
  function setQty(index, qty) {
    if (!memoryBag[index]) return;
    memoryBag[index].qty = Math.max(1, Math.min(10, qty));
    changed(false);
  }
  function removeItem(index) {
    memoryBag.splice(index, 1);
    changed(false);
  }
  function clearBag() { memoryBag = []; changed(false); }
  window.addEventListener('storage', function (e) {
    if (e.key === BAG_KEY) { memoryBag = readBag(); renderBagCount(false); window.dispatchEvent(new CustomEvent('vyro:bag')); }
  });

  let toastT = null;
  function toast(msg) {
    const el = document.querySelector('[data-toast]');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { el.classList.remove('is-on'); }, 2800);
  }

  document.addEventListener('DOMContentLoaded', function () { renderBagCount(false); });

  window.VyroShop = {
    COLORS: COLORS, COLOR_ORDER: COLOR_ORDER, PRODUCTS: PRODUCTS,
    get: get, url: url, colorName: colorName, categoryName: categoryName, price: price, esc: esc,
    fitPimg: fitPimg, wrapPimgs: wrapPimgs, whenLoaded: whenLoaded,
    cardHTML: cardHTML, wishHTML: wishHTML, swatchesHTML: swatchesHTML, mountCards: mountCards, switchCard: switchCard, radioKeys: radioKeys,
    miniHTML: miniHTML, thumb: thumb, search: search,
    addToBag: addToBag, bagItems: bagItems, bagCount: bagCount, setQty: setQty, removeItem: removeItem, clearBag: clearBag,
    totals: totals, money: money, FREE_SHIPPING: FREE_SHIPPING, renderBagCount: renderBagCount, toast: toast
  };
})();

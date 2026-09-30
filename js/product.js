/*
  VYRO product detail page.
  One template for every product: reads ?id=<slug>&color=<color> from the URL,
  looks the product up in the shared catalogue (js/shop.js) and renders it.
*/
(function () {
  const Shop = window.VyroShop;
  const gsap = window.gsap;
  const reduced = window.VyroPage.reduced;
  const lenis = window.VyroPage.lenis;
  const esc = Shop.esc;
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  const root = $('[data-pdp]');
  const params = new URLSearchParams(location.search);
  const product = Shop.get(params.get('id'));

  /* ------------------------------------------------------------------ *
   * Not found
   * ------------------------------------------------------------------ */
  if (!product) {
    document.title = 'Product not found | VYRO Athletics';
    root.innerHTML =
      '<section class="pdp-missing">' +
        '<h1 class="display">Product not found</h1>' +
        '<p>This product doesn\'t exist or is no longer available. The rest of Drop 01 is still in the shop.</p>' +
        '<a class="btn btn--solid" href="shop.html">Back to shop</a>' +
      '</section>';
    return;
  }

  let color = Shop.COLOR_ORDER.indexOf(params.get('color')) > -1 ? params.get('color') : product.defaultColor;
  let size = null;
  let qty = 1;

  document.title = product.name + ' | VYRO Athletics';
  const meta = $('meta[name="description"]');
  if (meta) meta.setAttribute('content', product.lede);

  /* ------------------------------------------------------------------ *
   * Render
   * ------------------------------------------------------------------ */
  function galleryHTML(c) {
    return product.gallery(c).map(function (g, i) {
      const alt = esc(product.name + ' in ' + Shop.colorName(c).toLowerCase() + ', ' + g.alt);
      const load = i < 2 ? '' : ' loading="lazy"';
      return g.fit === 'contain'
        ? '<figure class="pdp__shot pdp__shot--flat"><img class="pimg" src="' + g.src + '" alt="' + alt + '"' + load + '></figure>'
        : '<figure class="pdp__shot pdp__shot--photo"><img src="' + g.src + '" alt="' + alt + '"' + load + '></figure>';
    }).join('');
  }

  function accordion(title, body, open) {
    return '<details class="pdp__acc"' + (open ? ' open' : '') + '><summary>' + title + '</summary><div class="pdp__acc-body">' + body + '</div></details>';
  }

  const related = Shop.PRODUCTS.filter(function (p) { return p.slug !== product.slug; });

  root.innerHTML =
    '<nav class="crumbs" aria-label="Breadcrumb">' +
      '<ol>' +
        '<li><a href="shop.html" data-back>Shop</a></li>' +
        '<li><a href="shop.html?type=' + encodeURIComponent(product.category) + '">' + esc(product.category) + '</a></li>' +
        '<li aria-current="page">' + esc(product.name) + '</li>' +
      '</ol>' +
    '</nav>' +

    '<div class="pdp__grid">' +
      '<section class="pdp__gallery" aria-label="Product images">' +
        '<div class="pdp__track" data-gallery tabindex="0">' + galleryHTML(color) + '</div>' +
        '<p class="pdp__counter" aria-hidden="true"><span data-counter>1</span> / <span data-total></span></p>' +
      '</section>' +

      '<div class="pdp__info">' +
        '<div class="pdp__sticky">' +
          '<a class="pdp__back" href="shop.html" data-back>Back to shop</a>' +
          '<p class="pdp__cat">' + esc(product.category) + '</p>' +
          '<div class="pdp__title-row">' +
            '<h1 class="pdp__name display">' + esc(product.name) + '</h1>' +
            Shop.wishHTML(product.slug, color, 'pdp__wish') +
          '</div>' +
          '<p class="pdp__price">' + Shop.price(product.price) + (product.isNew ? '<span class="tag">New</span>' : '') + '</p>' +
          '<p class="pdp__lede">' + esc(product.lede) + '</p>' +

          '<div class="pdp__field">' +
            '<p class="pdp__label" id="color-label">Color: <strong data-color-name>' + Shop.colorName(color) + '</strong></p>' +
            Shop.swatchesHTML(product.name, color, false).replace('role="radiogroup"', 'role="radiogroup" data-colors aria-labelledby="color-label"') +
          '</div>' +

          '<div class="pdp__field">' +
            '<div class="pdp__label-row"><p class="pdp__label" id="size-label">Size: <strong data-size-name>Select a size</strong></p>' +
            '<a class="pdp__guide" href="#fit" data-guide>Size and fit</a></div>' +
            '<div class="sizes" role="radiogroup" aria-labelledby="size-label" aria-describedby="size-error" data-sizes>' +
              product.sizes.map(function (s) {
                return '<button type="button" role="radio" aria-checked="false" class="size" data-size="' + s + '">' + s + '</button>';
              }).join('') +
            '</div>' +
            '<p class="pdp__error" id="size-error" data-size-error></p>' +
          '</div>' +

          '<div class="pdp__buy">' +
            '<div class="qty" role="group" aria-label="Quantity">' +
              '<button type="button" class="qty__btn" data-qty="-1" aria-label="Decrease quantity">−</button>' +
              '<input class="qty__input" type="number" inputmode="numeric" min="1" max="10" value="1" aria-label="Quantity" data-qty-input>' +
              '<button type="button" class="qty__btn" data-qty="1" aria-label="Increase quantity">+</button>' +
            '</div>' +
            '<button type="button" class="btn btn--solid pdp__add" data-add>Add to bag</button>' +
          '</div>' +
          '<ul class="pdp__perks"><li>Free shipping over €80</li><li>30-day returns</li></ul>' +

          '<div class="pdp__accs">' +
            accordion('Description', '<p>' + esc(product.description) + '</p>', true) +
            accordion('Features', '<ul>' + product.features.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>') +
            '<div id="fit">' + accordion('Size and fit', '<p>' + esc(product.fit) + '</p><p>Available in ' + product.sizes.join(', ') + '.</p>') + '</div>' +
            accordion('Care', '<p>' + esc(product.care) + '</p>') +
            accordion('Shipping and returns', '<p>Free standard shipping on orders over €80. Orders ship within 2 working days. Unworn items can be returned within 30 days for a full refund.</p>') +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<section class="lookset" aria-labelledby="look-title" data-look></section>' +

    '<section class="pdp__related" aria-labelledby="related-title">' +
      '<div class="pdp__related-head">' +
        '<h2 class="display" id="related-title">You might also like</h2>' +
        '<a class="btn btn--ghost" href="shop.html">Shop all</a>' +
      '</div>' +
      '<div class="rail"><div class="rail__track" data-related></div></div>' +
    '</section>';

  /* ------------------------------------------------------------------ *
   * Gallery
   * ------------------------------------------------------------------ */
  const track = $('[data-gallery]');
  const counter = $('[data-counter]');
  const total = $('[data-total]');

  function setupGallery() {
    Shop.wrapPimgs(track);
    const shots = $$('.pdp__shot', track);
    total.textContent = String(shots.length);
    counter.textContent = '1';
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && e.intersectionRatio > 0.6) counter.textContent = String(shots.indexOf(e.target) + 1);
        });
      }, { root: track, threshold: [0.6] });
      shots.forEach(function (s) { io.observe(s); });
    }
  }
  setupGallery();

  /* ------------------------------------------------------------------ *
   * Color
   * ------------------------------------------------------------------ */
  const colorGroup = $('[data-colors]');
  Shop.radioKeys(colorGroup);
  $$('.swatch', colorGroup).forEach(function (sw) {
    sw.addEventListener('click', function () {
      const c = sw.dataset.color;
      if (c === color) return;
      color = c;
      $$('.swatch', colorGroup).forEach(function (o) { o.setAttribute('aria-checked', String(o === sw)); });
      $('[data-color-name]').textContent = Shop.colorName(c);
      history.replaceState(null, '', Shop.url(product.slug, c));
      $$('.pdp__wish').forEach(function (w) { w.dataset.color = c; });
      renderLook();
      if (gsap && !reduced) {
        gsap.to(track, {
          opacity: 0, duration: 0.25, onComplete: function () {
            track.innerHTML = galleryHTML(c);
            track.scrollLeft = 0;
            setupGallery();
            gsap.to(track, { opacity: 1, duration: 0.45 });
          }
        });
      } else {
        track.innerHTML = galleryHTML(c);
        setupGallery();
      }
    });
  });

  /* ------------------------------------------------------------------ *
   * Size
   * ------------------------------------------------------------------ */
  const sizeGroup = $('[data-sizes]');
  const sizeError = $('[data-size-error]');
  Shop.radioKeys(sizeGroup);
  $$('.size', sizeGroup).forEach(function (b) {
    b.addEventListener('click', function () {
      size = b.dataset.size;
      $$('.size', sizeGroup).forEach(function (o) { o.setAttribute('aria-checked', String(o === b)); });
      $('[data-size-name]').textContent = size;
      sizeError.textContent = '';
      sizeGroup.classList.remove('is-invalid');
    });
  });

  $('[data-guide]').addEventListener('click', function (e) {
    e.preventDefault();
    const d = $('#fit details');
    d.open = true;
    const y = d.getBoundingClientRect().top + window.scrollY - 120;
    if (lenis) lenis.scrollTo(y); else window.scrollTo({ top: y, behavior: 'smooth' });
  });

  /* ------------------------------------------------------------------ *
   * Quantity
   * ------------------------------------------------------------------ */
  const qtyInput = $('[data-qty-input]');
  function setQty(n) {
    qty = Math.max(1, Math.min(10, Math.round(+n) || 1));
    qtyInput.value = String(qty);
  }
  $$('[data-qty]').forEach(function (b) {
    b.addEventListener('click', function () { setQty(qty + (+b.dataset.qty)); });
  });
  qtyInput.addEventListener('change', function () { setQty(qtyInput.value); });

  /* ------------------------------------------------------------------ *
   * Add to bag
   * ------------------------------------------------------------------ */
  const addBtn = $('[data-add]');
  addBtn.addEventListener('click', function () {
    if (!size) {
      sizeError.textContent = 'Select a size to add this to your bag.';
      sizeGroup.classList.add('is-invalid');
      const first = $('.size', sizeGroup);
      if (first) first.focus();
      return;
    }
    Shop.addToBag({ slug: product.slug, color: color, size: size, qty: qty });
    addBtn.textContent = 'Added';
    addBtn.classList.add('is-done');
    setTimeout(function () { addBtn.textContent = 'Add to bag'; addBtn.classList.remove('is-done'); }, 1800);
  });

  /* ------------------------------------------------------------------ *
   * Complete the look: matching pieces in the colorway being viewed
   * ------------------------------------------------------------------ */
  function renderLook() {
    const pieces = (product.look || []).map(Shop.get).filter(Boolean);
    const el = $('[data-look]');
    if (!pieces.length) { el.hidden = true; return; }
    const photo = product.gallery(color).filter(function (g) { return g.fit === 'cover'; })[0] || product.gallery(color)[0];
    const total = product.price + pieces.reduce(function (n, p) { return n + p.price; }, 0);
    el.innerHTML =
      '<figure class="lookset__media"><img src="' + photo.src + '" alt="' + esc(product.name + ' in ' + Shop.colorName(color).toLowerCase() + ', ' + photo.alt) + '" loading="lazy"></figure>' +
      '<div class="lookset__body">' +
        '<h2 class="lookset__title display" id="look-title">Complete the look</h2>' +
        '<p class="lookset__lede">Pieces cut to go with the ' + esc(product.name) + ' in ' + Shop.colorName(color).toLowerCase() + '.</p>' +
        '<div class="lookset__items">' +
          pieces.map(function (p) {
            return '<div class="lookset__item">' + Shop.miniHTML(p, color, { meta: p.category + ', ' + Shop.colorName(color) }) + Shop.wishHTML(p.slug, color, 'lookset__wish') + '</div>';
          }).join('') +
        '</div>' +
        '<p class="lookset__total">Full look, ' + (pieces.length + 1) + ' pieces: <strong>' + Shop.price(total) + '</strong></p>' +
      '</div>';
    if (window.VyroChrome) window.VyroChrome.syncWish(el);
  }
  renderLook();

  /* ------------------------------------------------------------------ *
   * Related products (same card component as the home page)
   * ------------------------------------------------------------------ */
  Shop.mountCards($('[data-related]'), related, { reduced: reduced });

  /* ------------------------------------------------------------------ *
   * Back to shop: return to where you were if you came from the shop
   * ------------------------------------------------------------------ */
  $$('[data-back]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      let ret = null;
      try { ret = JSON.parse(sessionStorage.getItem('vyro-return') || 'null'); } catch (err) { /* ignore */ }
      // Came straight here from the shop: step back so the shop restores its scroll position
      const fromShop = ret && document.referrer && new URL(document.referrer).pathname === ret.path && ret.path !== location.pathname;
      if (fromShop && history.length > 1) {
        e.preventDefault();
        history.back();
      }
    });
  });

  /* ------------------------------------------------------------------ *
   * Entrance
   * ------------------------------------------------------------------ */
  if (gsap && !reduced) {
    gsap.from('.pdp__shot', { clipPath: 'inset(100% 0% 0% 0%)', duration: 1.1, stagger: 0.08, ease: 'power4.inOut' });
    gsap.from('.pdp__sticky > *', { y: 18, opacity: 0, duration: 0.8, stagger: 0.04, ease: 'power3.out', delay: 0.15 });
  }
})();

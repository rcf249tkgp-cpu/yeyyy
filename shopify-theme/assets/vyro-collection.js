/*
  VYRO shop listing (collection + search): Shopify storefront filters and
  sorting without page reloads. Changing a filter re-renders the section
  through the Section Rendering API and keeps the URL shareable.
*/
(function () {
  'use strict';

  const V = window.Vyro;
  const $ = V.$, $$ = V.$$;
  const gsap = window.gsap;
  let busy = null;
  let sheetOpen = false;

  function root() { return $('[data-shop][data-section]'); }

  function setSheet(open) {
    const sheet = $('[data-filters]');
    const btn = $('[data-filters-open]');
    if (!sheet) return;
    const desktop = window.matchMedia('(min-width: 900px)').matches;
    open = open && !desktop;
    sheet.classList.toggle('is-open', open);
    if (btn) btn.setAttribute('aria-expanded', String(open));
    if (open !== sheetOpen) V.lock(open);
    sheetOpen = open;
  }

  function queryFrom(form) {
    const params = new URLSearchParams();
    new FormData(form).forEach(function (val, key) {
      if (String(val).trim() !== '') params.append(key, val);
    });
    const sort = $('[data-sort]');
    if (sort && !params.has('sort_by')) params.set('sort_by', sort.value);
    return params.toString();
  }

  function render(url, opts) {
    opts = opts || {};
    const el = root();
    if (!el) { location.href = url; return; }
    const u = new URL(url, location.origin);
    u.searchParams.set('section_id', el.dataset.section);
    if (busy) busy.abort();
    busy = window.AbortController ? new AbortController() : null;
    el.classList.add('is-busy');
    fetch(u.pathname + u.search, busy ? { signal: busy.signal } : {}).then(function (r) { return r.text(); }).then(function (html) {
      const fresh = $('[data-shop]', new DOMParser().parseFromString(html, 'text/html'));
      if (!fresh) { location.href = url; return; }
      const keepOpen = sheetOpen;
      const scrollY = $('.filters__groups') ? $('.filters__groups').scrollTop : 0;
      el.innerHTML = fresh.innerHTML;
      el.classList.remove('is-busy');
      if (opts.push !== false) history.pushState({ vyroFacets: true }, '', url);
      if (keepOpen) {
        const sheet = $('[data-filters]');
        if (sheet) sheet.classList.add('is-open');
        const b = $('[data-filters-open]');
        if (b) b.setAttribute('aria-expanded', 'true');
      }
      const groups = $('.filters__groups');
      if (groups) groups.scrollTop = scrollY;
      bind();
      V.initCards(el);
      if (gsap && !V.reduced) gsap.from($$('.pcard', el), { y: 24, opacity: 0, duration: 0.6, stagger: 0.05, ease: 'power3.out', clearProps: 'all' });
      if (opts.scrollTop) {
        const grid = $('[data-grid]', el);
        if (grid) V.scrollTo(Math.max(0, grid.getBoundingClientRect().top + window.scrollY - 140), 0.8);
      }
    }).catch(function (err) {
      if (err && err.name === 'AbortError') return;
      location.href = url;
    });
  }

  function bind() {
    const el = root();
    if (!el) return;
    const form = $('[data-facets-form]', el);
    const sort = $('[data-sort]', el);
    let t = null;

    if (form) {
      form.addEventListener('change', function (e) {
        const delay = e.target.type === 'number' ? 500 : 0;
        clearTimeout(t);
        t = setTimeout(function () { render(form.getAttribute('action') + '?' + queryFrom(form)); }, delay);
      });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        render(form.getAttribute('action') + '?' + queryFrom(form));
      });
    }
    if (sort) {
      sort.addEventListener('change', function () {
        if (form) { render(form.getAttribute('action') + '?' + queryFrom(form)); return; }
        const u = new URL(location.href);
        u.searchParams.set('sort_by', sort.value);
        u.searchParams.delete('page');
        render(u.pathname + u.search);
      });
    }

    const openBtn = $('[data-filters-open]', el);
    if (openBtn) openBtn.addEventListener('click', function () { setSheet(!sheetOpen); });
    $$('[data-filters-close]', el).forEach(function (b) { b.addEventListener('click', function () { setSheet(false); }); });
  }

  // Chips, clear all and pagination links re-render in place
  document.addEventListener('click', function (e) {
    const a = e.target.closest('[data-shop] [data-chip], [data-shop] [data-clear], [data-shop] .pager a');
    if (!a || !a.getAttribute('href')) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    render(a.getAttribute('href'), { scrollTop: !!a.closest('.pager') });
  });

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheetOpen) setSheet(false); });
  window.matchMedia('(min-width: 900px)').addEventListener('change', function () { setSheet(false); });

  window.addEventListener('popstate', function (e) {
    if (e.state && e.state.vyroFacets) render(location.href, { push: false });
    else if (root()) render(location.href, { push: false });
  });

  bind();
  const el = root();
  if (el && gsap && !V.reduced) gsap.from($$('.pcard', el), { y: 24, opacity: 0, duration: 0.6, stagger: 0.05, ease: 'power3.out', clearProps: 'all' });

  document.addEventListener('shopify:section:load', function () { sheetOpen = false; bind(); });
})();

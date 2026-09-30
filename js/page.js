/*
  Shared setup for inner pages (product, shop, cart, account):
  momentum scrolling, header behaviour on scroll, scroll lock for dialogs.
*/
(function () {
  document.documentElement.classList.remove('no-js');
  document.body.classList.remove('is-loading');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gsap = window.gsap;

  let lenis = null;
  if (!reduced && window.Lenis && gsap) {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }
  if (window.VyroChrome) window.VyroChrome.onLock(function (on) { if (lenis) { on ? lenis.stop() : lenis.start(); } });

  const nav = document.querySelector('[data-nav]');
  const menu = document.querySelector('[data-menu]');
  let lastY = 0;
  nav.classList.add('is-scrolled');
  window.addEventListener('scroll', function () {
    const y = window.scrollY;
    nav.classList.toggle('is-hidden', menu.hidden && y > lastY && y > 300);
    lastY = y;
  }, { passive: true });

  function scrollTo(y) {
    if (lenis) lenis.scrollTo(y, { duration: 1 }); else window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
  }

  window.VyroPage = { lenis: lenis, reduced: reduced, scrollTo: scrollTo };
})();

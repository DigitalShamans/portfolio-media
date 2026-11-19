'use strict';

(() => {
  const about = document.querySelector('.portfolio-home #about-us');
  const header = document.querySelector('.portfolio-home .site-header');
  const links = [...document.querySelectorAll('[data-home-link]')];
  if (!about || !header || links.length !== 2) return;

  let headerHeight = 0, scheduled = false;
  function updateNavigation() {
    scheduled = false;
    const bounds = about.getBoundingClientRect();
    const readingLine = headerHeight + Math.max(0, (window.innerHeight - headerHeight) / 2);
    const active = bounds.top <= readingLine ? 'about' : 'portfolio';
    for (const link of links) {
      if (link.dataset.homeLink === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }
  function scheduleNavigation() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(updateNavigation);
  }
  function measureHeader() {
    headerHeight = header.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--home-header-height', headerHeight + 'px');
    scheduleNavigation();
  }

  window.addEventListener('scroll', scheduleNavigation, { passive: true });
  window.addEventListener('resize', measureHeader);
  window.addEventListener('pageshow', measureHeader);
  window.addEventListener('hashchange', scheduleNavigation);
  if ('ResizeObserver' in window) new ResizeObserver(measureHeader).observe(header);
  measureHeader();

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!reducedMotion.matches && 'IntersectionObserver' in window && about.getBoundingClientRect().top > window.innerHeight) {
    about.classList.add('is-reveal-pending');
    const reveal = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        about.classList.remove('is-reveal-pending');
        reveal.disconnect();
      }
    }, { rootMargin: '0px 0px 80px 0px' });
    reveal.observe(about);
    reducedMotion.addEventListener('change', event => {
      if (event.matches) {
        about.classList.remove('is-reveal-pending');
        reveal.disconnect();
      }
    });
  }
})();

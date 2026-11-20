'use strict';

(() => {
  const about = document.querySelector('.portfolio-home #about-us');
  const header = document.querySelector('.portfolio-home .site-header');
  const nav = header?.querySelector('.site-nav');
  const portfolioLink = nav?.querySelector('[data-home-link="portfolio"]');
  const aboutLink = nav?.querySelector('[data-home-link="about"]');
  if (!about || !portfolioLink || !aboutLink) return;

  let headerHeight = 0, scheduled = false;
  let activeLink, needsMeasurement = true;
  function updateNavigation() {
    scheduled = false;
    const bounds = about.getBoundingClientRect();
    const readingLine = headerHeight + Math.max(0, (window.innerHeight - headerHeight) / 2);
    const target = bounds.top <= readingLine ? aboutLink : portfolioLink;
    if (target === activeLink && !needsMeasurement) return;

    const navRect = nav.getBoundingClientRect();
    const { left, bottom, width } = target.getBoundingClientRect();
    nav.style.setProperty('--home-indicator-x', (left - navRect.left) + 'px');
    nav.style.setProperty('--home-indicator-y', (bottom - navRect.top) + 'px');
    nav.style.setProperty('--home-indicator-width', String(width));
    if (!activeLink) nav.setAttribute('data-home-indicator', '');

    if (target !== activeLink) {
      (target === portfolioLink ? aboutLink : portfolioLink).removeAttribute('aria-current');
      target.setAttribute('aria-current', 'location');
      activeLink = target;
    }
    needsMeasurement = false;
  }
  function scheduleNavigation() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(updateNavigation);
  }
  function measureHeader() {
    headerHeight = header.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--home-header-height', headerHeight + 'px');
    needsMeasurement = true;
    scheduleNavigation();
  }

  window.addEventListener('scroll', scheduleNavigation, { passive: true });
  window.addEventListener('resize', measureHeader);
  window.addEventListener('pageshow', measureHeader);
  window.addEventListener('hashchange', scheduleNavigation);
  if ('ResizeObserver' in window) {
    const resize = new ResizeObserver(measureHeader);
    resize.observe(header);
    resize.observe(nav);
  }
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

'use strict';

(() => {
  const currentPath = window.location.pathname;
  const galleryPath = /^(\/(?:artur\/)?)galleries\/hb-[a-z0-9-]+\/$/;
  const bannerList = '#recent-work .recent-galleries';
  const transitionType = 'portfolio-gallery';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function localURL(href) {
    if (!href) return null;
    const url = new URL(href, window.location.href);
    return url.origin === window.location.origin ? url : null;
  }

  function recentGalleryHome(url) {
    if (!url || url.search || url.hash) return null;
    return galleryPath.exec(url.pathname)?.[1] ?? null;
  }

  if (currentPath === '/' || currentPath === '/artur/') {
    window.addEventListener('pageswap', ({ activation, viewTransition }) => {
      if (!viewTransition) return;
      if (activation?.navigationType === 'push' &&
          recentGalleryHome(localURL(activation.entry?.url)) === currentPath && !reducedMotion.matches) {
        viewTransition.types?.add(transitionType);
      } else {
        viewTransition.skipTransition();
      }
    });
    window.addEventListener('pagereveal', ({ viewTransition }) => viewTransition?.skipTransition());

    // Let the link navigate on its own. Only remember the nested scroller.
    document.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey ||
          event.shiftKey || event.altKey) return;
      const link = event.target.closest?.(bannerList + ' a.recent-gallery');
      if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download') ||
          recentGalleryHome(localURL(link.href)) !== currentPath) return;
      const scrollTop = link.closest(bannerList).scrollTop;
      try {
        window.history.replaceState({
          ...window.history.state, portfolioRecentWorkScrollTop: scrollTop
        }, '');
      } catch { /* The link remains usable if history state is restricted. */ }
    });

    window.addEventListener('pageshow', event => {
      const historyVisit = window.performance.getEntriesByType('navigation')[0]?.type === 'back_forward';
      if (!event.persisted && !historyVisit) return;
      const scrollTop = window.history.state?.portfolioRecentWorkScrollTop;
      const region = document.querySelector(bannerList);
      if (region && Number.isFinite(scrollTop) && scrollTop >= 0) {
        window.requestAnimationFrame(() => { region.scrollTop = scrollTop; });
      }
    });
    return;
  }

  const homePath = recentGalleryHome(localURL(window.location.href));
  if (!homePath) return;

  function fromPortfolio() {
    const activation = window.navigation?.activation;
    const from = localURL(activation?.from?.url ?? document.referrer);
    const newVisit = activation
      ? activation.navigationType === 'push'
      : window.performance.getEntriesByType('navigation')[0]?.type === 'navigate';
    return newVisit && from?.pathname === homePath;
  }

  // Keep the first screenshot prioritised and disarm any stationary edge pointer.
  if (fromPortfolio()) window.__galleryDesktopEdgeArrived = true;

  window.addEventListener('pagereveal', ({ viewTransition }) => {
    if (!viewTransition || !fromPortfolio()) return;
    if (reducedMotion.matches) viewTransition.skipTransition();
    else viewTransition.types?.add(transitionType);
  });
})();

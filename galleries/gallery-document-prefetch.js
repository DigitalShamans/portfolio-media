(function () {
  'use strict';

  // Only warm adjacent gallery documents. The original GSAP edge animation,
  // page navigation, image viewer, and mobile swipes remain unchanged.
  const navigation = document.querySelector('.gallery-navigation');
  if (!navigation || !window.matchMedia('(hover: hover) and (pointer: fine)').matches ||
      !window.HTMLScriptElement?.supports?.('speculationrules') ||
      window.navigator?.connection?.saveData ||
      ['slow-2g', '2g'].includes(window.navigator?.connection?.effectiveType)) return;

  const prefix = window.location.pathname.split('/galleries/')[0];
  function destination(direction) {
    const link = navigation.querySelector('.gallery-navigation__link--' + direction);
    if (!link) return null;
    const url = new URL(link.href, window.location.href);
    if (url.search || url.hash || url.origin !== window.location.origin ||
        url.pathname.split('/galleries/')[0] !== prefix ||
        !/^\/galleries\/hb-[a-z0-9-]+\/$/.test(url.pathname.slice(prefix.length))) return null;
    return url.href;
  }

  const previous = destination('previous');
  const next = destination('next');
  if (!previous && !next) return;

  const prefetched = new Set();
  function prefetch(url) {
    if (!url || prefetched.has(url) || document.hidden) return;
    prefetched.add(url);
    // Chrome keeps prefetched navigation documents ready for a later navigation.
    // This does NOT execute destination JavaScript or fetch gallery images.
    const rule = document.createElement('script');
    rule.type = 'speculationrules';
    rule.textContent = JSON.stringify({
      prefetch: [{ source: 'list', urls: [url], eagerness: 'immediate' }]
    });
    document.head.append(rule);
  }

  // Begin warming the destination when the pointer approaches an edge,
  // BEFORE the existing 6% hover activation zone and 180ms hold delay.
  window.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || document.hidden) return;
    const width = window.innerWidth;
    if (event.clientX >= 0 && event.clientX <= width * .12) prefetch(previous);
    else if (event.clientX <= width && event.clientX >= width * .88) prefetch(next);
  }, { passive: true });

  // A page that has been viewed for a moment can warm both adjacent documents.
  // Idle scheduling and browser-managed priority avoid competing with the current
  // gallery's foreground images. Only two same-origin HTML documents are eligible.
  const warmOnIdle = () => {
    prefetch(previous);
    prefetch(next);
  };
  const scheduleIdle = () => {
    if (window.requestIdleCallback) window.requestIdleCallback(warmOnIdle, { timeout: 1500 });
    else window.setTimeout(warmOnIdle, 650);
  };
  if (document.readyState === 'complete') scheduleIdle();
  else window.addEventListener('load', scheduleIdle, { once: true });
}());

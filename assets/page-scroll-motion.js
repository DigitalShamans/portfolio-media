'use strict';

(() => {
  const scroller = document.scrollingElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hasGallerySmoother = Boolean(document.querySelector('#gallery-scroll-wrapper'));
  const about = document.querySelector('.portfolio-home #about-us');
  const aboutLink = document.querySelector('.portfolio-home [data-home-link="about"]');
  const elasticPeriod = .38;
  const elasticDuration = .98;
  let spring, aboutScroll;
  let previousTop, atBottom;

  function scrollLimit() {
    return Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  }

  function scrollPosition() {
    const smoother = hasGallerySmoother ? window.ScrollSmoother?.get?.() : undefined;
    return smoother?.scrollTop() ?? scroller.scrollTop;
  }

  function isAtBottom(top) {
    const limit = scrollLimit();
    return limit > 1 && top >= limit - 1;
  }

  function syncBoundary() {
    previousTop = scrollPosition();
    atBottom = isAtBottom(previousTop);
  }

  function stopSpring() {
    spring?.cancel();
    spring = undefined;
  }

  function playSpring() {
    const content = document.querySelector('[data-page-scroll-motion]');
    if (!content?.animate) return;
    stopSpring();

    // Sample the elastic.out rebound for the bottom of the page.
    const pushTime = 140;
    const settleTime = elasticDuration * 1000;
    const duration = pushTime + settleTime;
    const frames = [{ offset: 0, translate: '0 0px', easing: 'ease-out' }];
    const samples = 80;
    for (let sample = 0; sample <= samples; sample++) {
      const progress = sample / samples;
      const remaining = progress === 1 ? 0 : 2 ** (-10 * progress) * Math.cos(progress * 2 * Math.PI / elasticPeriod);
      frames.push({ offset: (pushTime + settleTime * progress) / duration, translate: '0 ' + (-30 * remaining) + 'px' });
    }
    const animation = content.animate(frames, { duration });
    spring = animation;
    animation.onfinish = () => { if (spring === animation) spring = undefined; };
  }

  function observeBottom() {
    const top = scrollPosition();
    const reached = isAtBottom(top);
    const arrived = reached && !atBottom && top > previousTop;
    previousTop = top;
    atBottom = reached;

    if (!reached) stopSpring();
    if (arrived && !aboutScroll && !reducedMotion.matches && !document.fullscreenElement &&
        !document.querySelector('dialog[open]')) playSpring();
  }

  function stopAboutScroll() {
    if (!aboutScroll) return;
    aboutScroll.kill();
    aboutScroll = undefined;
    syncBoundary();
  }

  function resetMotion() {
    stopSpring();
    stopAboutScroll();
    syncBoundary();
  }

  syncBoundary();
  window.addEventListener('scroll', observeBottom, { passive: true });
  if (hasGallerySmoother) document.addEventListener('gallery-scrollupdate', observeBottom);
  for (const event of ['pagehide', 'resize', 'popstate']) window.addEventListener(event, resetMotion);
  window.addEventListener('pageshow', event => {
    // Initial loading can finish during a scroll that the visitor already requested.
    if (!event.persisted && aboutScroll) return;
    resetMotion();
  });
  reducedMotion.addEventListener('change', resetMotion);
  window.addEventListener('wheel', event => {
    stopAboutScroll();
    if (event.deltaY < 0) stopSpring();
  }, { capture: true, passive: true });
  for (const event of ['pointerdown', 'keydown']) {
    window.addEventListener(event, () => {
      stopAboutScroll();
      stopSpring();
    }, { capture: true, passive: true });
  }

  if (!about || !aboutLink) return;

  function travelProgress(time) {
    const ramp = .14;
    if (time < ramp) return time ** 2 / (2 * ramp * (1 - ramp));
    if (time > 1 - ramp) return 1 - (1 - time) ** 2 / (2 * ramp * (1 - ramp));
    return (time - ramp / 2) / (1 - ramp);
  }

  about.tabIndex = -1;
  aboutLink.addEventListener('click', event => {
    const gsap = window.gsap;
    if (!gsap || reducedMotion.matches || event.defaultPrevented || event.button ||
        event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    resetMotion();
    const framing = window.portfolioScrollFraming;
    framing?.stop();
    if (window.location.hash !== aboutLink.hash) {
      window.history.pushState(window.history.state, '', aboutLink.hash);
    }

    const start = scroller.scrollTop;
    const margin = Number.parseFloat(window.getComputedStyle(about).scrollMarginTop) || 0;
    const destination = Math.max(0, Math.min(scrollLimit(), start + about.getBoundingClientRect().top - margin));
    if (Math.abs(destination - start) < 1) {
      about.focus({ preventScroll: true });
      return;
    }

    const frame = framing?.measure(start);
    const from = frame?.wheelPosition(start) ?? start;
    const to = frame?.wheelPosition(destination) ?? destination;
    const low = Math.min(start, destination);
    const high = Math.max(start, destination);
    const distance = Math.abs(to - from);
    const position = { top: start };
    aboutScroll = gsap.to(position, {
      top: destination,
      duration: Math.max(.35, Math.min(3.6, distance / 1000)),
      ease(time) {
        const progress = travelProgress(time);
        if (!frame || time === 0 || time === 1) return progress;
        const top = frame.positionAt(from + (to - from) * progress, low, high);
        return (top - start) / (destination - start);
      },
      onUpdate() { window.scrollTo({ top: position.top, behavior: 'instant' }); },
      onComplete() {
        aboutScroll = undefined;
        syncBoundary();
        about.focus({ preventScroll: true });
      }
    });
  });
})();

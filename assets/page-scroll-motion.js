'use strict';

(() => {
  const scroller = document.scrollingElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hasGallerySmoother = Boolean(document.querySelector('#gallery-scroll-wrapper'));
  const about = document.querySelector('.portfolio-home #about-us');
  const aboutLink = document.querySelector('.portfolio-home [data-home-link="about"]');
  const topDuration = 2500;
  // Cubic segments from the Ease Visualizer, grouped as two control points and an end point.
  const topEaseSegments = [
    [0, 0, .169, .079, .269, .218],
    [.357, .341, .414, .464, .447, .553],
    [.485, .66, .539, .794, .626, .849],
    [.732, .916, .765, .864, .884, .901],
    [.939, .918, 1, 1, 1, 1]
  ];
  const elasticPeriod = .38;
  const elasticDuration = .98;
  let boundaryMotion, aboutScroll, cancelTopScroll;
  let previousTop, atBottom;

  function scrollLimit() {
    return Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  }

  function gallerySmoother() {
    return hasGallerySmoother ? window.ScrollSmoother?.get?.() : undefined;
  }

  function scrollPosition() {
    return gallerySmoother()?.scrollTop() ?? scroller.scrollTop;
  }

  function isAtBottom(top) {
    const limit = scrollLimit();
    return limit > 1 && top >= limit - 1;
  }

  function syncBoundary() {
    previousTop = scrollPosition();
    atBottom = isAtBottom(previousTop);
  }

  function canAnimate() {
    return !reducedMotion.matches && !document.fullscreenElement && !document.querySelector('dialog[open]');
  }

  function stopBoundaryMotion() {
    boundaryMotion?.cancel();
    boundaryMotion = undefined;
  }

  function animateBoundary(content, frames, duration) {
    if (!content?.animate) return;
    stopBoundaryMotion();
    const animation = content.animate(frames, { duration });
    boundaryMotion = animation;
    animation.onfinish = () => { if (boundaryMotion === animation) boundaryMotion = undefined; };
  }

  function playSpring() {
    const content = document.querySelector('[data-page-scroll-motion]');
    if (!content) return;
    // Sample elastic.out for pages that scroll without GSAP.
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
    animateBoundary(content, frames, duration);
  }

  function playTopArrival(distance) {
    const section = document.querySelector('[data-page-scroll-motion]');
    const content = section?.closest('.gallery-map-page') ?? section;
    if (!content) return;

    // Match the last visible position while native scrolling is already at zero.
    const travel = Math.min(40, distance);
    let x = 0, y = 0;
    const frames = topEaseSegments.map(([x1, y1, x2, y2, endX, endY]) => {
      const width = endX - x;
      const height = endY - y;
      const controls = [(x1 - x) / width, (y1 - y) / height, (x2 - x) / width, (y2 - y) / height];
      const frame = { offset: x, translate: '0 ' + (-travel * (1 - y)) + 'px',
        easing: 'cubic-bezier(' + controls.join(',') + ')' };
      x = endX;
      y = endY;
      return frame;
    });
    frames.push({ offset: 1, translate: '0 0px' });
    animateBoundary(content, frames, topDuration);
  }

  function observeBoundaries() {
    const top = scrollPosition();
    const reachedTop = top <= .5;
    const reachedBottom = isAtBottom(top);
    const arrivedAtBottom = reachedBottom && !atBottom && top > previousTop;
    const topTravel = reachedTop && previousTop > .5 ? previousTop - top : 0;
    previousTop = top;
    atBottom = reachedBottom;

    if (!reachedTop && !reachedBottom) stopBoundaryMotion();
    if ((!arrivedAtBottom && !topTravel) || aboutScroll || cancelTopScroll || !canAnimate()) return;
    if (arrivedAtBottom) playSpring();
    else if (topTravel) playTopArrival(topTravel);
  }

  function stopAboutScroll() {
    if (!aboutScroll) return;
    aboutScroll.kill();
    aboutScroll = undefined;
    syncBoundary();
  }

  function resetMotion() {
    stopBoundaryMotion();
    stopAboutScroll();
    cancelTopScroll?.();
    syncBoundary();
  }

  function cubic(start, first, second, end, time) {
    const rest = 1 - time;
    return start * rest ** 3 + 3 * first * rest ** 2 * time + 3 * second * rest * time ** 2 + end * time ** 3;
  }

  function topEase(progress) {
    if (progress <= 0 || progress >= 1) return progress;
    let x = 0, y = 0;
    for (const [x1, y1, x2, y2, endX, endY] of topEaseSegments) {
      if (progress <= endX) {
        let low = 0, high = 1;
        for (let iteration = 0; iteration < 16; iteration++) {
          const time = (low + high) / 2;
          if (cubic(x, x1, x2, endX, time) < progress) low = time;
          else high = time;
        }
        return cubic(y, y1, y2, endY, (low + high) / 2);
      }
      x = endX;
      y = endY;
    }
    return 1;
  }

  function scrollToTop(event) {
    const smoother = gallerySmoother();
    const start = scrollPosition();
    if (start <= .5 || !canAnimate() || smoother?.paused()) return;
    event.preventDefault();
    resetMotion();

    function move(top) {
      if (smoother) smoother.scrollTo(top, false);
      else window.scrollTo({ top, behavior: 'instant' });
    }

    // Stop native momentum before writing the custom curve.
    move(start);
    const started = performance.now();
    let frame;
    cancelTopScroll = () => {
      window.cancelAnimationFrame(frame);
      cancelTopScroll = undefined;
      if (smoother && smoother === gallerySmoother() && !smoother.paused()) {
        // Reconcile direct writes with the smoother's internal scrub.
        smoother.paused(true);
        smoother.paused(false);
      }
      syncBoundary();
    };

    function advance(time) {
      if (!canAnimate() || smoother !== gallerySmoother() || smoother?.paused()) {
        cancelTopScroll();
        return;
      }
      const progress = Math.max(0, Math.min(1, (time - started) / topDuration));
      move(start * (1 - topEase(progress)));
      if (progress === 1) cancelTopScroll();
      else frame = window.requestAnimationFrame(advance);
    }
    frame = window.requestAnimationFrame(advance);
  }

  syncBoundary();
  window.addEventListener('scroll', observeBoundaries, { passive: true });
  document.addEventListener('page-scroll-to-top', scrollToTop);
  if (hasGallerySmoother) {
    document.addEventListener('gallery-scrollupdate', observeBoundaries);
    document.addEventListener('gallery-scrollcontrollerchange', resetMotion);
  }
  for (const event of ['pageshow', 'pagehide', 'resize', 'popstate']) window.addEventListener(event, resetMotion);
  reducedMotion.addEventListener('change', resetMotion);
  window.addEventListener('wheel', event => {
    stopAboutScroll();
    cancelTopScroll?.();
    if ((event.deltaY < 0 && atBottom) || (event.deltaY > 0 && previousTop <= .5)) stopBoundaryMotion();
  }, { capture: true, passive: true });
  for (const event of ['pointerdown', 'keydown']) {
    window.addEventListener(event, resetMotion, { capture: true, passive: true });
  }

  if (!about || !aboutLink) return;
  about.tabIndex = -1;
  aboutLink.addEventListener('click', event => {
    const gsap = window.gsap;
    if (!gsap || reducedMotion.matches || event.defaultPrevented || event.button ||
        event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    resetMotion();
    if (window.location.hash !== aboutLink.hash) {
      window.history.pushState(window.history.state, '', aboutLink.hash);
    }

    const start = scroller.scrollTop;
    const margin = Number.parseFloat(window.getComputedStyle(about).scrollMarginTop) || 0;
    const destination = Math.max(0, Math.min(scrollLimit(), start + about.getBoundingClientRect().top - margin));
    const distance = Math.abs(destination - start);
    if (distance < 1) {
      about.focus({ preventScroll: true });
      return;
    }

    const position = { top: start };
    aboutScroll = gsap.to(position, {
      top: destination,
      duration: Math.max(.65, Math.min(1.2, Math.sqrt(distance) * .019)),
      ease: 'power4.out',
      onUpdate() { window.scrollTo({ top: position.top, behavior: 'instant' }); },
      onComplete() {
        aboutScroll = undefined;
        syncBoundary();
        about.focus({ preventScroll: true });
      }
    });
  });
})();

'use strict';

(() => {
  const scroller = document.scrollingElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hasGallerySmoother = Boolean(document.querySelector('#gallery-scroll-wrapper'));
  const about = document.querySelector('.portfolio-home #about-us');
  const aboutLink = document.querySelector('.portfolio-home [data-home-link="about"]');
  const aboutContent = about?.closest('[data-page-scroll-motion]');
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

    // GSAP's default elastic.out curve, sampled for pages that scroll without GSAP.
    const frames = [{ offset: 0, translate: '0 0px', easing: 'ease-out' }];
    for (let sample = 0; sample <= 48; sample++) {
      const progress = sample / 48;
      const remaining = progress === 1 ? 0 : 2 ** (-10 * progress) * Math.cos(progress * 2 * Math.PI / .3);
      frames.push({ offset: .14 + .86 * progress, translate: '0 ' + (-18 * remaining) + 'px' });
    }
    const animation = content.animate(frames, { duration: 650 });
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
    aboutContent.style.removeProperty('translate');
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
  for (const event of ['pageshow', 'pagehide', 'resize', 'popstate']) window.addEventListener(event, resetMotion);
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

  if (!about || !aboutLink || !aboutContent) return;
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
    const distance = destination - start;
    if (Math.abs(distance) < 1) {
      about.focus({ preventScroll: true });
      return;
    }

    // Keep the elastic part local to the anchor, even on a long page.
    const lastStretch = Math.sign(distance) * Math.min(24, Math.abs(distance) * .14);
    const travelTime = Math.max(.65, Math.min(1.2, Math.sqrt(Math.abs(distance)) * .019));
    const position = { top: start };
    aboutScroll = gsap.timeline({
      paused: true,
      onUpdate() {
        const top = Math.max(0, Math.min(scrollLimit(), position.top));
        window.scrollTo({ top, behavior: 'instant' });
        // Render any overshoot past the scroll limit on the content itself.
        if (top !== position.top) aboutContent.style.translate = '0 ' + (top - position.top) + 'px';
        else aboutContent.style.removeProperty('translate');
      },
      onComplete() {
        aboutContent.style.removeProperty('translate');
        aboutScroll = undefined;
        syncBoundary();
        about.focus({ preventScroll: true });
      }
    });
    aboutScroll.to(position, { top: destination - lastStretch, duration: travelTime, ease: 'power4.out' })
      .to(position, { top: destination, duration: .62, ease: 'elastic.out' }).play();
  });
})();

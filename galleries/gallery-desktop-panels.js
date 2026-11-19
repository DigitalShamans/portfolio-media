(function () {
  'use strict';

  // Desktop project switching. Mobile touch swipes live in gallery-navigation.js.
  const navigation = document.querySelector('.gallery-navigation');
  const desktop = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (!navigation || !desktop.matches) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const source = document.currentScript?.src || window.location.href;
  const ignoredTargets = 'iframe, video, audio, input, textarea, select, button, label, '
    + '[contenteditable]:not([contenteditable="false"]), [role="slider"], dialog, a';
  const editableTargets = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
  const travelDistance = 200;
  const prefix = window.location.pathname.split('/galleries/')[0];
  let scrollingStage;
  let scrollingIntent = false;
  let slideDirection;
  let progress = 0;
  let navigating = false;
  let resetTimer;
  let stageTween;

  function resolve(direction) {
    const link = navigation.querySelector('.gallery-navigation__link--' + direction);
    if (!link) return null;
    const url = new URL(link.href, window.location.href);
    // The current studio/personal portfolio and Hard Bullet navigation order are authoritative.
    if (url.origin !== window.location.origin ||
        url.pathname.split('/galleries/')[0] !== prefix ||
        !/^\/galleries\/hb-[a-z0-9-]+\/$/.test(url.pathname.slice(prefix.length))) return null;
    return { href: url.href, title: link.dataset.galleryName || link.getAttribute('aria-label') || 'Gallery' };
  }

  const destinations = { next: resolve('next'), previous: resolve('previous') };
  if (!destinations.next || !destinations.previous) return;

  const slide = document.createElement('div');
  slide.className = 'gallery-desktop-slide';
  slide.hidden = true;
  slide.setAttribute('aria-hidden', 'true');
  const contents = document.createElement('div');
  contents.className = 'gallery-desktop-slide__content';
  const eyebrow = document.createElement('p');
  eyebrow.textContent = 'Hard Bullet';
  const title = document.createElement('h2');
  contents.append(eyebrow, title);
  slide.append(contents);
  document.body.append(slide);

  function blocked() {
    return !desktop.matches || document.hidden || document.fullscreenElement ||
      document.querySelector('dialog[open]') ||
      Math.abs((window.visualViewport?.scale ?? 1) - 1) > .01 ||
      document.activeElement?.closest?.(editableTargets) ||
      window.getSelection?.()?.isCollapsed === false;
  }

  function setPosition(direction, value) {
    const signed = direction === 'next' ? 1 : -1;
    const offset = signed * (1 - value) * 100;
    if (window.gsap && !reducedMotion.matches) {
      window.gsap.killTweensOf(slide);
      window.gsap.set(slide, { xPercent: offset, autoAlpha: 1 });
    } else {
      slide.style.opacity = '1';
      slide.style.visibility = 'visible';
      slide.style.transform = 'translate3d(' + offset + '%, 0, 0)';
    }
  }

  function resetSlide(animate) {
    clearTimeout(resetTimer);
    resetTimer = undefined;
    if (navigating) return;
    const direction = slideDirection;
    slideDirection = undefined;
    progress = 0;
    if (!direction) { slide.hidden = true; return; }
    if (animate && window.gsap && !reducedMotion.matches) {
      window.gsap.to(slide, {
        xPercent: direction === 'next' ? 100 : -100,
        duration: .2, ease: 'power1.out', overwrite: true,
        onComplete: () => { if (!slideDirection && !navigating) slide.hidden = true; }
      });
    } else {
      window.gsap?.killTweensOf(slide);
      slide.hidden = true;
    }
  }

  function navigate(direction) {
    if (navigating || blocked()) return;
    const destination = destinations[direction];
    if (!destination) return;
    navigating = true;
    clearTimeout(resetTimer);
    try {
      window.sessionStorage?.setItem('gallery-desktop-slide-arrival', JSON.stringify({
        direction, pathname: new URL(destination.href).pathname, created: Date.now()
      }));
    } catch { /* Private browsing may disallow session storage. */ }
    window.location.assign(destination.href);
  }

  function advance(direction, distance) {
    if (blocked() || !destinations[direction] || navigating) return;
    if (slideDirection && slideDirection !== direction) resetSlide(false);
    if (slideDirection !== direction) {
      slideDirection = direction;
      progress = 0;
      title.textContent = destinations[direction].title;
      slide.dataset.direction = direction;
      slide.hidden = false;
    }

    progress = Math.min(1, progress + distance / travelDistance);
    setPosition(direction, progress);
    clearTimeout(resetTimer);
    if (progress < 1) {
      resetTimer = setTimeout(() => resetSlide(true), 420);
    } else {
      // The complete next panel paints before the browser navigates.
      resetTimer = setTimeout(() => navigate(direction), reducedMotion.matches ? 0 : 160);
    }
  }

  function wheel(event) {
    if (blocked() || event.ctrlKey || event.metaKey || event.altKey ||
        event.target?.closest?.(ignoredTargets)) return;

    const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    const dx = event.deltaX * factor;
    const dy = event.deltaY * factor;
    if (scrollingStage && dy > 0 && scrollingStage.getBoundingClientRect().top < window.innerHeight + 20) {
      scrollingIntent = true;
    }

    let direction;
    let distance = 0;
    if (Math.abs(dx) > 4 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      direction = dx > 0 ? 'next' : 'previous';
      distance = Math.abs(dx);
    } else if (event.shiftKey && Math.abs(dy) > 4) {
      direction = dy > 0 ? 'next' : 'previous';
      distance = Math.abs(dy);
    } else if (dy < -5 && window.scrollY <= 2) {
      direction = 'previous';
      distance = Math.abs(dy);
    } else if (dy > 5 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 3) {
      // Fallback for layouts without the ScrollTrigger panel.
      direction = 'next';
      distance = dy;
    }
    if (!direction) return;
    if (event.cancelable) event.preventDefault();
    advance(direction, distance);
  }

  function keydown(event) {
    if (blocked() || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
        event.target?.closest?.(ignoredTargets)) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      advance(event.key === 'ArrowRight' ? 'next' : 'previous', travelDistance);
    } else if (['ArrowDown', 'PageDown', 'End', ' '].includes(event.key)) {
      scrollingIntent = true;
    }
  }

  function addScript(filename) {
    return new Promise((resolve, reject) => {
      const element = document.createElement('script');
      element.src = new URL('../assets/vendor/gsap/3.15.1/' + filename, source).href;
      element.onload = resolve;
      element.onerror = reject;
      document.head.append(element);
    });
  }

  async function loadGsap() {
    if (!window.gsap) await addScript('gsap.min.js');
    if (!window.ScrollTrigger) await addScript('ScrollTrigger.min.js');
    if (!window.gsap?.registerPlugin || !window.ScrollTrigger?.create) throw new Error('GSAP unavailable');
    window.gsap.registerPlugin(window.ScrollTrigger);
  }

  function addScrollStage(main) {
    if (scrollingStage || reducedMotion.matches || !desktop.matches || !main ||
        main.classList.contains('gallery-access')) return;
    scrollingStage = document.createElement('section');
    scrollingStage.className = 'gallery-desktop-scroll-stage';
    scrollingStage.setAttribute('aria-label', 'Scroll down to enter ' + destinations.next.title);
    const panel = document.createElement('div');
    panel.className = 'gallery-desktop-scroll-panel';
    const copy = document.createElement('div');
    copy.className = 'gallery-desktop-scroll-copy';
    const eyebrow = document.createElement('p');
    eyebrow.textContent = 'Next Hard Bullet gallery';
    const heading = document.createElement('h2');
    heading.textContent = destinations.next.title;
    const hint = document.createElement('p');
    hint.textContent = 'Continue scrolling to enter';
    copy.append(eyebrow, heading, hint);
    panel.append(copy);
    scrollingStage.append(panel);

    const exit = document.createElement('div');
    exit.className = 'gallery-desktop-scroll-exit';
    exit.setAttribute('aria-hidden', 'true');
    main.after(scrollingStage, exit);

    window.gsap.set(panel, { xPercent: 100 });
    stageTween = window.gsap.to(panel, {
      xPercent: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: scrollingStage,
        start: 'top bottom',
        end: 'top top',
        scrub: true,
        invalidateOnRefresh: true,
        onLeave: () => {
          if (scrollingIntent && !blocked()) navigate('next');
          scrollingIntent = false;
        },
        onLeaveBack: () => { scrollingIntent = false; }
      }
    });

    if ('ResizeObserver' in window) {
      let pending = false;
      const observer = new ResizeObserver(() => {
        if (pending) return;
        pending = true;
        window.requestAnimationFrame(() => {
          pending = false;
          stageTween?.scrollTrigger?.refresh();
        });
      });
      observer.observe(main);
      window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
    }
  }

  function animateArrival() {
    let arrival;
    try {
      arrival = JSON.parse(window.sessionStorage?.getItem('gallery-desktop-slide-arrival') || 'null');
      window.sessionStorage?.removeItem('gallery-desktop-slide-arrival');
    } catch { return; }
    if (!arrival || arrival.pathname !== window.location.pathname ||
        Date.now() - arrival.created > 10000 || reducedMotion.matches) return;
    const main = document.querySelector('body > main.shell:not(.gallery-access)');
    if (main) window.gsap.fromTo(main,
      { x: arrival.direction === 'next' ? 70 : -70, opacity: .65 },
      { x: 0, opacity: 1, duration: .4, ease: 'power2.out', clearProps: 'transform,opacity' });
  }

  window.addEventListener('wheel', wheel, { passive: false });
  window.addEventListener('keydown', keydown);
  window.addEventListener('pagehide', () => { clearTimeout(resetTimer); navigating = false; });
  window.addEventListener('pageshow', () => {
    navigating = false;
    scrollingIntent = false;
    resetSlide(false);
    stageTween?.scrollTrigger?.refresh();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearTimeout(resetTimer); navigating = false; resetSlide(false); }
  });
  desktop.addEventListener?.('change', () => { resetSlide(false); stageTween?.scrollTrigger?.refresh(); });

  loadGsap().then(() => {
    animateArrival();
    if (!reducedMotion.matches) {
      const main = document.querySelector('body > main.shell');
      if (main?.classList.contains('gallery-access')) {
        const observer = new MutationObserver(() => {
          const unlocked = document.querySelector('body > main.shell:not(.gallery-access)');
          if (unlocked) { observer.disconnect(); addScrollStage(unlocked); }
        });
        observer.observe(document.body, { childList: true });
      } else {
        addScrollStage(main);
      }
    }
  }).catch(() => {
    // Wheel/keyboard navigation remains available with a CSS slide if GSAP is blocked.
  });
}());

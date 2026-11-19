(function () {
  'use strict';

  // Desktop mouse-edge navigation; mobile touch swipes remain separate.
  const navigation = document.querySelector('.gallery-navigation');
  const desktop = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (!navigation || !desktop.matches) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scriptURL = document.currentScript?.src || window.location.href;
  const prefix = window.location.pathname.split('/galleries/')[0];
  const interactive = 'a, button, input, textarea, select, label, iframe, video, audio, summary, '
    + '[contenteditable]:not([contenteditable="false"]), [role="button"], [role="link"], [role="slider"]';
  const holdDelay = 180;
  const slideDuration = 120;
  const editable = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
  let direction = null;
  let hovering = false;
  let navigating = false;
  let pressed = false;
  let armed = true;
  let startTimer, finishTimer, hideTimer;
  let animationId = 0;

  function destination(which) {
    const link = navigation.querySelector('.gallery-navigation__link--' + which);
    if (!link) return null;
    const url = new URL(link.href, window.location.href);
    // Preserve the source portfolio and only navigate through declared Hard Bullet pages.
    if (url.origin !== window.location.origin ||
        url.pathname.split('/galleries/')[0] !== prefix ||
        !/^\/galleries\/hb-[a-z0-9-]+\/$/.test(url.pathname.slice(prefix.length))) return null;
    return {
      href: url.href, pathname: url.pathname,
      title: link.dataset.galleryName || link.getAttribute('aria-label') || 'Gallery'
    };
  }

  const destinations = { next: destination('next'), previous: destination('previous') };
  if (!destinations.next || !destinations.previous) return;

  const panel = document.createElement('div');
  panel.className = 'gallery-desktop-edge-panel';
  panel.hidden = true;
  panel.setAttribute('aria-hidden', 'true');
  const content = document.createElement('div');
  content.className = 'gallery-desktop-edge-panel__content';
  const eyebrow = document.createElement('p');
  eyebrow.textContent = 'Hard Bullet';
  const heading = document.createElement('h2');
  content.append(eyebrow, heading);
  panel.append(content);
  document.body.append(panel);

  // Keep the shared logo, navigation and accent stripe visually stationary
  // while the content underneath slides. Clone only for the short transition,
  // leaving the source header and document layout untouched.
  const siteHeader = document.querySelector('body > .site-header');
  const transitionHeader = siteHeader?.cloneNode(true);
  if (transitionHeader) {
    transitionHeader.className += ' gallery-desktop-edge-header';
    transitionHeader.setAttribute('aria-hidden', 'true');
    transitionHeader.inert = true;
    transitionHeader.hidden = true;
    document.body.append(transitionHeader);
  }

  function showHeader() {
    if (!transitionHeader) return;
    transitionHeader.hidden = false;
    panel.style.top = Math.ceil(transitionHeader.getBoundingClientRect().height) + 'px';
  }

  function hideHeader() {
    if (transitionHeader) transitionHeader.hidden = true;
    panel.style.top = '';
  }

  // Avoid chaining through multiple galleries while the pointer remains on the edge.
  try {
    const arrival = JSON.parse(window.sessionStorage.getItem('gallery-desktop-edge-arrival') || 'null');
    window.sessionStorage.removeItem('gallery-desktop-edge-arrival');
    if (arrival && arrival.pathname === window.location.pathname && Date.now() - arrival.at < 10000) {
      armed = false;
    }
  } catch { /* Session storage can be disabled. */ }

  function blocked(checkFocused = false) {
    return !desktop.matches || document.hidden || document.fullscreenElement ||
      document.querySelector('dialog[open]') || pressed ||
      Math.abs((window.visualViewport?.scale ?? 1) - 1) > .01 ||
      (checkFocused && document.activeElement?.closest?.(editable)) ||
      window.getSelection?.()?.isCollapsed === false;
  }

  function edgeAt(x) {
    const width = window.innerWidth;
    const edge = Math.max(52, Math.min(96, width * .06));
    if (x < 0 || x > width) return null;
    return x <= edge ? 'previous' : x >= width - edge ? 'next' : null;
  }

  function clearTimers() {
    clearTimeout(startTimer);
    clearTimeout(finishTimer);
    clearTimeout(hideTimer);
    startTimer = finishTimer = hideTimer = undefined;
  }

  function clear(animate = false) {
    animationId++;
    clearTimers();
    const old = direction;
    direction = null;
    hovering = false;
    if (navigating) return;
    const id = animationId;
    window.gsap?.killTweensOf?.(panel);
    if (animate && old && !panel.hidden && !reducedMotion.matches) {
      if (window.gsap?.to) {
        window.gsap.to(panel, {
          xPercent: old === 'next' ? 100 : -100,
          duration: .18, ease: 'power1.out', overwrite: true,
          onComplete: () => {
            if (id === animationId) {
              panel.hidden = true;
              hideHeader();
            }
          }
        });
      } else {
        panel.style.transition = 'transform 180ms ease-out';
        panel.style.transform = 'translate3d(' + (old === 'next' ? '100%' : '-100%') + ',0,0)';
        hideTimer = setTimeout(() => {
          if (id === animationId) {
            panel.hidden = true;
            hideHeader();
          }
        }, 185);
      }
    } else {
      panel.hidden = true;
      hideHeader();
    }
  }

  function navigate(which, id) {
    if (id !== animationId || direction !== which || !hovering || blocked() || navigating) {
      clear();
      return;
    }
    const target = destinations[which];
    if (!target) return clear();
    navigating = true;
    try {
      window.sessionStorage.setItem('gallery-desktop-edge-arrival', JSON.stringify({
        direction: which, pathname: target.pathname, at: Date.now()
      }));
    } catch { /* Page switching must still work without storage. */ }
    window.location.assign(target.href);
  }

  function animate(which) {
    if (which !== direction || !hovering || blocked()) return clear();
    const id = ++animationId;
    const offset = which === 'next' ? 100 : -100;
    heading.textContent = destinations[which].title;
    panel.dataset.direction = which;
    panel.hidden = false;
    if (reducedMotion.matches) {
      panel.hidden = true;
      finishTimer = setTimeout(() => navigate(which, id), slideDuration);
    } else {
      showHeader();
      if (window.gsap?.fromTo) {
      window.gsap.killTweensOf(panel);
      window.gsap.fromTo(panel,
        { xPercent: offset, autoAlpha: 1 },
        { xPercent: 0, autoAlpha: 1, duration: slideDuration / 1000,
          ease: 'power2.inOut', overwrite: true,
          onComplete: () => navigate(which, id) });
    } else {
      // If GSAP fails to load, CSS still performs a timed slide and navigation.
      panel.style.transition = 'none';
      panel.style.transform = 'translate3d(' + offset + '%,0,0)';
      panel.style.opacity = '1';
      window.requestAnimationFrame(() => {
        if (id !== animationId || panel.hidden) return;
        window.requestAnimationFrame(() => {
          if (id !== animationId || panel.hidden) return;
          panel.style.transition = 'transform ' + slideDuration + 'ms cubic-bezier(.45,0,.55,1)';
          panel.style.transform = 'translate3d(0,0,0)';
        });
      });
      finishTimer = setTimeout(() => navigate(which, id), slideDuration + 40);
      }
    }
  }

  function hover(which) {
    if (navigating || direction === which) return;
    clear();
    direction = which;
    hovering = true;
    startTimer = setTimeout(() => animate(which), holdDelay);
  }

  function pointerMove(event) {
    if (event.pointerType !== 'mouse') return;
    if (navigating || blocked() || event.target?.closest?.(interactive)) {
      if (!navigating) clear(true);
      return;
    }
    const which = edgeAt(event.clientX);
    if (!which) {
      armed = true;
      if (direction) clear(true);
      return;
    }
    if (armed && which !== direction) hover(which);
  }

  function keyboard(event) {
    // Chromium can skip history entries created by hover-only navigation in its
    // Back/Forward browser buttons. Programmatic history traversal is not subject
    // to that intervention; preserve the standard shortcuts where the page sees them.
    if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey &&
        (event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
        desktop.matches && !document.hidden && !document.fullscreenElement &&
        !document.querySelector('dialog[open]')) {
      event.preventDefault();
      if (!navigating) clear();
      if (event.key === 'ArrowLeft') window.history.back();
      else window.history.forward();
      return;
    }
    if (blocked(true) || navigating || event.ctrlKey || event.metaKey || event.altKey ||
        event.shiftKey || event.target?.closest?.(interactive)) return;
    const which = event.key === 'ArrowLeft' ? 'previous' : event.key === 'ArrowRight' ? 'next' : null;
    if (!which) return;
    event.preventDefault();
    clear();
    direction = which;
    hovering = true;
    animate(which);
  }

  function interrupt() { if (!navigating) clear(); }

  window.addEventListener('pointermove', pointerMove, { passive: true });
  window.addEventListener('pointerdown', () => { pressed = true; interrupt(); }, { passive: true });
  window.addEventListener('pointerup', () => { pressed = false; }, { passive: true });
  window.addEventListener('pointercancel', () => { pressed = false; interrupt(); });
  window.addEventListener('keydown', keyboard);
  window.addEventListener('blur', interrupt);
  window.addEventListener('resize', interrupt);
  window.addEventListener('pagehide', () => { navigating = false; clear(); });
  window.addEventListener('pageshow', event => {
    navigating = false;
    clear();
    // History restorations may not rerun the script (BFCache). Keep the
    // stationary pointer from immediately forwarding the user again.
    const historyVisit = window.performance?.getEntriesByType?.('navigation')?.[0]?.type === 'back_forward';
    if (event.persisted || historyVisit) armed = false;
  });
  window.addEventListener('popstate', () => {
    navigating = false;
    clear();
    armed = false;
  });
  document.addEventListener('visibilitychange', interrupt);
  document.addEventListener('pointerleave', interrupt);
  desktop.addEventListener?.('change', interrupt);

  // GSAP is used only for the edge panel; no ScrollTrigger/scroll-locking is installed.
  if (!window.gsap) {
    const script = document.createElement('script');
    script.src = new URL('../assets/vendor/gsap/3.15.1/gsap.min.js', scriptURL).href;
    script.async = true;
    document.head.append(script);
  }
}());

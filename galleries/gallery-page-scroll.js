(() => {
  'use strict';

  const scriptURL = document.currentScript.src;
  const wrapper = document.querySelector('#gallery-scroll-wrapper');
  const content = document.querySelector('#gallery-scroll-content');
  const gallery = document.querySelector('[data-gsap-gallery-scroll]');
  const viewer = document.querySelector('#viewer');
  if (!wrapper || !content || !gallery || !viewer) return;

  const diagnostics = window.PortfolioDiagnostics;
  const desktop = window.matchMedia('(pointer: fine) and (hover: hover)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController();
  let smoother;
  let dependencies;
  let failed = false;
  let disposed = false;
  let opening = false;
  let closing = false;
  let suppressFocus = false;
  let keyboardFocus = false;
  let restoreScrollStyles;

  function report(mode, reason) {
    diagnostics?.state('gallery-smoother', mode, reason);
    diagnostics?.state('gallery-wheel', mode, reason);
  }

  function listen(target, type, callback, options = {}) {
    target.addEventListener(type, callback, { ...options, signal: events.signal });
  }

  function loadScript(filename, globalName) {
    if (window[globalName]) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const url = new URL('../assets/vendor/gsap/3.15.1/' + filename, scriptURL).href;
      const existing = [...document.scripts].find(script => script.src === url);
      const script = existing || document.createElement('script');
      const timer = setTimeout(() => finish(false), 8000);
      function finish(loaded) {
        clearTimeout(timer);
        script.removeEventListener('load', loadedScript);
        script.removeEventListener('error', failedScript);
        if (loaded && window[globalName]) resolve();
        else reject(new Error('Gallery scroll dependency unavailable: ' + filename));
      }
      function loadedScript() { finish(true); }
      function failedScript() { finish(false); }
      script.addEventListener('load', loadedScript, { once: true });
      script.addEventListener('error', failedScript, { once: true });
      if (!existing) {
        script.src = url;
        document.head.append(script);
      }
    });
  }

  function loadDependencies() {
    dependencies ||= (async () => {
      await loadScript('gsap.min.js', 'gsap');
      await loadScript('ScrollTrigger.min.js', 'ScrollTrigger');
      await loadScript('ScrollSmoother.min.js', 'ScrollSmoother');
      window.gsap.registerPlugin(window.ScrollTrigger, window.ScrollSmoother);
    })();
    return dependencies;
  }

  function saveScrollStyles() {
    const saved = [document.documentElement, document.body].map(element => ({
      element, value: element.style.getPropertyValue('scroll-behavior'),
      priority: element.style.getPropertyPriority('scroll-behavior')
    }));
    return () => saved.forEach(({ element, value, priority }) => {
      if (value) element.style.setProperty('scroll-behavior', value, priority);
      else element.style.removeProperty('scroll-behavior');
    });
  }

  function stop() {
    if (!smoother) return;
    const position = smoother.scrollTop();
    smoother.kill();
    smoother = undefined;
    restoreScrollStyles?.();
    restoreScrollStyles = undefined;
    window.scrollTo({ top: position, behavior: 'instant' });
  }

  function updatePaused() {
    if (!smoother) return;
    const paused = Boolean(opening || closing || viewer.open || document.fullscreenElement);
    if (smoother.paused() !== paused) smoother.paused(paused);
    report(paused ? 'Paused for fullscreen viewer' : 'GSAP ScrollSmoother', paused
      ? 'Page scrolling is held at the visible position while the image viewer is open.'
      : 'GSAP smooths mouse-wheel and trackpad scrolling across the overview and screenshots.');
  }

  async function update() {
    if (disposed) return;
    if (!desktop.matches || reducedMotion.matches || failed) {
      stop();
      report('Native scrolling', reducedMotion.matches ? 'Reduced motion is enabled.'
        : failed ? 'GSAP scrolling could not initialize; native scrolling remains available.'
          : 'Touch scrolling is managed by the gallery touch controller.');
      return;
    }
    if (smoother) {
      updatePaused();
      return;
    }
    report('Loading GSAP ScrollSmoother', 'Loading the local gallery scrolling libraries.');
    try {
      await loadDependencies();
      if (disposed || !desktop.matches || reducedMotion.matches || smoother) return;
      if (window.ScrollSmoother.get()) throw new Error('Another component owns page smoothing.');
      restoreScrollStyles = saveScrollStyles();
      smoother = window.ScrollSmoother.create({
        wrapper, content,
        smooth: 0.65,
        smoothTouch: false,
        effects: false,
        normalizeScroll: false,
        onFocusIn(self, event) {
          // Pointer clicks and returning from the viewer must not move the page.
          // Keyboard navigation can still bring an offscreen focus target into view.
          if (!keyboardFocus || opening || closing || viewer.open || self.paused()
              || document.fullscreenElement || suppressFocus || !content.contains(event.target)) return false;
        },
        onUpdate(self) {
          diagnostics?.sample('gallery-smoother', self.scrollTop(), window.scrollY);
          diagnostics?.sample('gallery-wheel', self.scrollTop());
          // Hover anchors move during GSAP's settling frames as well as native scroll events.
          document.dispatchEvent(new Event('gallery-scrollupdate'));
        }
      });
      updatePaused();
    } catch (_) {
      failed = true;
      stop();
      restoreScrollStyles?.();
      restoreScrollStyles = undefined;
      report('Native scrolling', 'GSAP scrolling could not initialize; native scrolling remains available.');
    }
  }

  // Pause before showModal focuses a control, with an attribute observer as a
  // fallback for browsers without dialog beforetoggle support.
  listen(viewer, 'beforetoggle', event => {
    opening = event.newState === 'open';
    closing = !opening;
    updatePaused();
  });
  const viewerObserver = new MutationObserver(() => {
    opening = false;
    if (viewer.open) closing = false;
    else if (smoother?.paused()) closing = true;
    updatePaused();
  });
  viewerObserver.observe(viewer, { attributes: true, attributeFilter: ['open'] });
  listen(viewer, 'close', () => {
    opening = false;
    closing = true;
    suppressFocus = true;
    updatePaused();
    queueMicrotask(() => {
      closing = false;
      suppressFocus = false;
      updatePaused();
    });
  });
  listen(document, 'fullscreenchange', updatePaused);
  listen(document, 'pointerdown', () => { keyboardFocus = false; }, { capture: true, passive: true });
  listen(document, 'keydown', () => { keyboardFocus = true; }, { capture: true });
  listen(desktop, 'change', update);
  listen(reducedMotion, 'change', update);
  listen(window, 'pageshow', () => { update(); smoother?.refresh(); });
  listen(window, 'pagehide', event => {
    if (event.persisted) return;
    disposed = true;
    viewerObserver.disconnect();
    events.abort();
    stop();
  });
  update();
})();

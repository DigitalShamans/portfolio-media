(function () {
  'use strict';

  const scriptURL = document.currentScript.src;
  const controllers = new WeakMap();
  const idleDelay = 200;
  const editables = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
  const controls = editables + ', button, label';
  let dependencies;

  function loadScript(filename) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('../assets/vendor/gsap/3.15.1/' + filename, scriptURL).href;
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
  }

  function loadDependencies() {
    dependencies ||= (async () => {
      if (!window.gsap) await loadScript('gsap.min.js');
      if (!window.ScrollTrigger) await loadScript('ScrollTrigger.min.js');
      if (!window.gsap?.registerPlugin || !window.ScrollTrigger?.normalizeScroll) throw new Error();
      window.gsap.registerPlugin(window.ScrollTrigger);
    })();
    return dependencies;
  }

  function start({ gallery, viewer, gestureRoot = gallery, swipeControls = '' }) {
    const diagnostics = window.PortfolioDiagnostics;
    if (controllers.has(gallery)) return controllers.get(gallery);
    const viewport = window.visualViewport;
    const coarse = window.matchMedia('(pointer: coarse)');
    const portrait = window.matchMedia('(orientation: portrait)');
    let destroyed = false;
    let suspended = false;
    let failed = false;
    let armed = false;
    let ready = false;
    let loading = false;
    let touches = 0;
    let gesture;
    let normalizer;
    let timer;
    let layout;
    let observer;
    let restoreStyles;
    const cleanups = [];
    const probes = [];
    const controller = {
      suspend() { suspended = true; refresh(); },
      resume() { suspended = false; refresh(); },
      destroy() {
        destroyed = true;
        clearTimeout(timer);
        stop();
        observer?.disconnect();
        cleanups.forEach(remove => remove());
        probes.forEach(probe => probe.remove());
        controllers.delete(gallery);
      }
    };
    if (!gallery || !viewport || !coarse.matches || !navigator.maxTouchPoints
        || !window.CSS?.supports('height', '100lvh') || !window.CSS.supports('height', '100svh')) {
      diagnostics?.state('gallery-touch', 'Native touch scrolling', 'The mobile viewport or input requirements were not met.');
      return { suspend() {}, resume() {}, destroy() {} };
    }
    controllers.set(gallery, controller);

    for (const unit of ['lvh', 'svh']) {
      const probe = document.createElement('div');
      probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = 'position:fixed;top:0;left:0;width:0;visibility:hidden;pointer-events:none;overflow:hidden;';
      probe.style.height = '100' + unit;
      document.body.append(probe);
      probes.push(probe);
    }

    function listen(target, type, callback, options) {
      target.addEventListener(type, callback, options);
      cleanups.push(() => target.removeEventListener(type, callback, options));
    }

    function release(owned) {
      // normalizeScroll.kill() does not stop its closure-owned momentum tween.
      try { window.gsap.killTweensOf(owned); } catch (_) {}
      try {
        if (window.ScrollTrigger.normalizeScroll() === owned) window.ScrollTrigger.normalizeScroll(false);
        else owned.kill();
      } catch (_) {}
    }

    function stop() {
      if (normalizer) {
        release(normalizer);
        diagnostics?.event('gallery-touch', 'normalizer released');
        diagnostics?.state('gallery-touch', 'Native touch scrolling', 'The normalizer paused after a viewport or interaction change.');
      }
      normalizer = undefined;
      restoreStyles?.();
      restoreStyles = undefined;
    }

    function saveStyles() {
      const saved = [document.documentElement, document.body].flatMap(element =>
        ['touch-action', 'scroll-behavior'].map(property => ({
          element, property, value: element.style.getPropertyValue(property),
          priority: element.style.getPropertyPriority(property)
        })));
      return () => saved.forEach(({ element, property, value, priority }) => {
        if (value) element.style.setProperty(property, value, priority);
        else element.style.removeProperty(property);
      });
    }

    function blocked() {
      return destroyed || suspended || failed || !coarse.matches || document.hidden
        || viewer?.open || document.fullscreenElement || touches > 1
        || Math.abs(viewport.scale - 1) > 0.01 || document.activeElement?.closest(editables);
    }

    function toolbarHidden() {
      const large = probes[0].getBoundingClientRect().height;
      const small = probes[1].getBoundingClientRect().height;
      // No measurable toolbar range means there is nothing safe to intercept.
      return large - small >= 24 && Math.abs(viewport.height - large) <= 3;
    }

    function reset() {
      armed = false;
      gesture = undefined;
      stop();
    }

    function refresh() {
      clearTimeout(timer);
      const nextLayout = portrait.matches + ':' + document.documentElement.clientWidth;
      if (nextLayout !== layout) {
        layout = nextLayout;
        reset();
      }
      if (blocked()) {
        reset();
        return;
      }
      if (normalizer) {
        if (!toolbarHidden()) {
          // Some browsers insist on showing their toolbar. Stay native thereafter.
          failed = true;
          reset();
          diagnostics?.state('gallery-touch', 'Native touch scrolling', 'Browser controls reappeared during normalization.');
        }
        return;
      }
      if (!armed || touches || !toolbarHidden()) {
        if (!failed) diagnostics?.state('gallery-touch', 'Native touch scrolling', armed
          ? 'Waiting for browser controls to collapse and the gesture to finish.' : 'Waiting for an initial vertical swipe.');
        return;
      }
      timer = setTimeout(activate, idleDelay);
    }

    function activate() {
      if (blocked() || touches || !armed || !toolbarHidden()) return;
      if (!ready) {
        if (loading) return;
        loading = true;
        loadDependencies().then(() => {
          ready = true;
          refresh();
        }).catch(() => {
          failed = true;
          reset();
          diagnostics?.state('gallery-touch', 'Native touch scrolling', 'GSAP touch dependencies could not load.');
        });
        return;
      }
      const Observer = window.gsap.core?.globals().Observer;
      let existingObservers;
      try {
        // Do not take ownership from another component using ScrollTrigger.
        if (window.ScrollTrigger.normalizeScroll()) {
          failed = true;
          diagnostics?.state('gallery-touch', 'Native touch scrolling', 'Another controller already owns touch normalization.');
          return;
        }
        existingObservers = new Set(Observer?.getAll() || []);
        restoreStyles = saveStyles();
        normalizer = window.ScrollTrigger.normalizeScroll({
          type: 'touch',
          normalizeScrollX: false,
          lockAxis: true,
          dragMinimum: 12,
          momentum: 0.8,
          // Buttons and links must still scroll: root touch-action disables native
          // vertical panning, while GSAP's allowClicks preserves ordinary taps.
          ignore: editables,
          // GSAP's nested-scroll observer stops horizontal events in capture.
          // Keep those events available to the existing comparison handlers.
          allowNestedScroll: false
        });
        if (normalizer) diagnostics?.state('gallery-touch', 'GSAP touch normalizer', 'ScrollTrigger enabled touch normalization.');
      } catch (_) {
        failed = true;
        // Initialization can register observers and change root touch-action
        // before returning its normalizer. Clean up only this failed attempt.
        for (const partial of Observer?.getAll() || []) {
          if (existingObservers && !existingObservers.has(partial)) release(partial);
        }
        stop();
        diagnostics?.state('gallery-touch', 'Native touch scrolling', 'ScrollTrigger could not start touch normalization.');
      }
    }

    function touchStart(event) {
      touches = event.touches.length;
      refresh();
      if (touches !== 1 || blocked()) return;
      const touch = event.touches[0];
      gesture = {
        x: touch.clientX, y: touch.clientY, scroll: window.scrollY,
        // The map's image buttons are also valid swipe surfaces. Arming still
        // requires a completed vertical gesture AND real native page movement.
        native: !normalizer && gestureRoot.contains(event.target)
          && !event.target.closest(editables)
          && (!event.target.closest(controls) || Boolean(swipeControls && event.target.closest(swipeControls)))
      };
    }

    function touchEnd(event) {
      touches = event.touches.length;
      if (!touches && gesture && event.type !== 'touchcancel' && !blocked()) {
        const touch = event.changedTouches[0];
        const dx = Math.abs(touch.clientX - gesture.x);
        const dy = Math.abs(touch.clientY - gesture.y);
        if (gesture.native && dy >= 12 && dy > dx && Math.abs(window.scrollY - gesture.scroll) >= 12) {
          armed = true;
        }
      }
      if (!touches) gesture = undefined;
      refresh();
    }

    // Capture observes safety changes before GSAP's root listeners; it never
    // cancels or stops propagation of the gallery's own touch/pointer events.
    listen(window, 'touchstart', touchStart, { capture: true, passive: true });
    listen(window, 'touchend', touchEnd, { capture: true, passive: true });
    listen(window, 'touchcancel', touchEnd, { capture: true, passive: true });
    listen(window, 'scroll', () => {
      if (normalizer) diagnostics?.sample('gallery-touch', window.scrollY);
      refresh();
    }, { passive: true });
    listen(window, 'resize', refresh, { passive: true });
    listen(viewport, 'resize', refresh, { passive: true });
    listen(coarse, 'change', refresh);
    listen(portrait, 'change', () => { reset(); refresh(); });
    listen(window, 'orientationchange', () => { reset(); refresh(); });
    listen(document, 'fullscreenchange', refresh);
    listen(document, 'visibilitychange', () => { touches = 0; reset(); refresh(); });
    listen(document, 'focusin', refresh);
    listen(document, 'focusout', () => { queueMicrotask(refresh); });
    if (viewer) {
      observer = new MutationObserver(refresh);
      observer.observe(viewer, { attributes: true, attributeFilter: ['open'] });
      listen(viewer, 'close', refresh);
    }
    refresh();
    return controller;
  }

  window.GalleryMobileScroll = { start };
}());

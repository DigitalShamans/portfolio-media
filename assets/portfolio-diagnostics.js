(() => {
  'use strict';

  const diagnostics = window.PortfolioDiagnostics;
  if (!diagnostics?.pending) return;
  const { pending, observer, enabledKey, reportKey, section, style } = diagnostics;
  const signal = observer.signal;
  const labels = {
    'resume-timeline': 'Résumé timeline',
    'resume-smoother': 'Résumé scroll smoothing',
    'resume-reveals': 'Résumé card reveals',
    'gallery-edge': 'Gallery edge transition',
    'gallery-wheel': 'Gallery wheel scrolling',
    'gallery-smoother': 'Gallery scroll smoothing',
    'gallery-map-preview': 'Map thumbnail animation',
    'gallery-touch': 'Gallery touch scrolling',
    'gallery-swipe': 'Gallery touch navigation',
    'portfolio-reveals': 'Portfolio card reveals',
    'portfolio-preview': 'Portfolio tile previews',
    'about-entry': 'About Us page reveal'
  };
  const expected = {
    resume: ['resume-timeline', 'resume-smoother', 'resume-reveals'],
    gallery: ['gallery-edge', 'gallery-wheel', 'gallery-touch', 'gallery-swipe'],
    portfolio: ['portfolio-reveals'],
    about: ['about-entry']
  };
  const features = {};
  const tallies = {};
  const motion = {};
  const events = [];
  const input = { wheel: 0, smallPixelWheel: 0, touchStarts: 0, mousePresses: 0, penPresses: 0, scrollEvents: 0 };
  const pageId = performance.timeOrigin;
  let panel, results, summary, status, actions, manualCopy, stylesheet;
  let renderTimer, frameRequest;
  let activeTest, lastTest;
  let movement = 0;
  let priorPages = readPriorPages();

  function readPriorPages() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(reportKey) || '[]');
      if (Array.isArray(saved)) return saved.slice(-6).filter(page => page?.id !== pageId);
    } catch {}
    return [];
  }

  const rounded = value => Math.round(value * 1000) / 1000;
  const matches = query => window.matchMedia(query).matches;

  function environment() {
    return {
      browser: navigator.userAgent.match(/\b(?:Edg|Chrome|Firefox|Version)\/[\d.]+/)?.[0] || 'Other',
      viewport: { width: window.innerWidth, height: window.innerHeight, pixelRatio: window.devicePixelRatio },
      primaryPointer: matches('(pointer: fine)') ? 'fine' : matches('(pointer: coarse)') ? 'coarse' : 'none',
      primaryHover: matches('(hover: hover)'),
      finePointerAvailable: matches('(any-pointer: fine)'),
      coarsePointerAvailable: matches('(any-pointer: coarse)'),
      hoverAvailable: matches('(any-hover: hover)'),
      touchPoints: navigator.maxTouchPoints || 0,
      reducedMotion: matches('(prefers-reduced-motion: reduce)')
    };
  }

  function libraries() {
    return Object.fromEntries(['gsap', 'Flip', 'ScrollTrigger', 'ScrollSmoother', 'DrawSVGPlugin', 'MotionPathPlugin']
      .map(name => [name, window[name]?.version || Boolean(window[name])]));
  }

  function resumeCards() {
    const track = document.querySelector('[data-career-timeline]');
    if (!track) return undefined;
    const images = [...track.querySelectorAll('.career-preview img')];
    return {
      layout: track.classList.contains('career-track--narrow') ? 'narrow' : 'wide',
      scroller: document.documentElement.classList.contains('career-local-scroll') ? 'local' : 'window',
      timelineState: track.dataset.timelineState || 'uninitialized',
      milestones: track.querySelectorAll('.career-milestone').length,
      waiting: track.querySelectorAll('.career-milestone--awaiting-reveal').length,
      images: images.length,
      imagesLoaded: images.filter(image => image.complete && image.naturalWidth > 0).length,
      scrollDistance: track.dataset.scrollDistance ? Number(track.dataset.scrollDistance) : undefined
    };
  }

  function page() {
    const loading = diagnostics.loadingLibraries();
    return {
      id: pageId, path: location.pathname, section, environment: environment(), libraries: libraries(),
      loadingLibraries: loading.length ? loading : undefined,
      features, tallies, motion, input, resume: section === 'resume' ? resumeCards() : undefined, test: lastTest, events
    };
  }

  function report() {
    return { version: 1, pages: [...priorPages, page()] };
  }

  function refreshSoon() {
    if (!panel?.open || renderTimer || activeTest) return;
    renderTimer = window.setTimeout(() => {
      renderTimer = undefined;
      render();
    }, 350);
  }

  function state(feature, mode, reason, details) {
    const before = features[feature];
    if (before?.mode === mode && before.reason === reason && !details) return;
    features[feature] = { mode, reason, details };
    refreshSoon();
  }

  function count(feature, activity, amount = 1) {
    const totals = tallies[feature] ||= {};
    totals[activity] = (totals[activity] || 0) + amount;
    refreshSoon();
  }

  function event(feature, activity, details) {
    count(feature, activity);
    if (events.length === 64) events.shift();
    events.push({ atMs: Math.round(performance.now()), feature, activity, details });
  }

  function sample(feature, position, nativePosition) {
    if (!Number.isFinite(position)) return;
    const sample = motion[feature] ||= { first: position, last: position, advances: 0, callbacks: 0 };
    sample.callbacks++;
    if (sample.last !== position) {
      sample.advances++;
      sample.last = position;
      sample.min = Math.min(sample.min ?? sample.first, position);
      sample.max = Math.max(sample.max ?? sample.first, position);
      movement++;
    }
    if (Number.isFinite(nativePosition)) {
      sample.maxNativeDifferencePx = Math.max(sample.maxNativeDifferencePx || 0, rounded(Math.abs(nativePosition - position)));
    }
    refreshSoon();
  }

  function outsidePanel(event) {
    return !panel || !(event.target instanceof Node) || !panel.contains(event.target);
  }

  function counters() {
    return {
      input: { ...input },
      advances: Object.fromEntries(Object.entries(motion).map(([key, value]) => [key, value.advances])),
      activities: Object.fromEntries(Object.entries(tallies).map(([key, value]) => [key, { ...value }]))
    };
  }

  function finishTest(reason) {
    if (!activeTest) return;
    const { started, intervals, movingIntervals, longMovingIntervals, worstMovingInterval, before, cardsAtStart } = activeTest;
    cancelAnimationFrame(frameRequest);
    activeTest = undefined;
    lastTest = {
      reason, durationMs: Math.round(performance.now() - started), intervals, movingIntervals,
      movingIntervalsOver34Ms: longMovingIntervals, worstMovingIntervalMs: rounded(worstMovingInterval),
      before, after: counters(), cardsAtStart, cardsAtEnd: section === 'resume' ? resumeCards() : undefined
    };
    if (actions) {
      actions.querySelector('[data-record]').textContent = 'Record 10 seconds';
      status.textContent = movingIntervals
        ? movingIntervals + ' frame intervals during motion. Longest: ' + lastTest.worstMovingIntervalMs + ' ms. Over 34 ms: ' + longMovingIntervals + '.'
        : 'The sample ended without observing motion.';
    }
    render();
  }

  function recordTest() {
    if (activeTest) { finishTest('Stopped by tester'); return; }
    activeTest = {
      started: performance.now(), before: counters(), cardsAtStart: section === 'resume' ? resumeCards() : undefined,
      intervals: 0, movingIntervals: 0,
      longMovingIntervals: 0, worstMovingInterval: 0, lastMovement: movement
    };
    summary.textContent = 'Diagnostics · recording';
    status.textContent = 'Scroll or animate the feature you want to test.';
    actions.querySelector('[data-record]').textContent = 'Stop recording';
    function frame(now) {
      const test = activeTest;
      if (!test) return;
      if (test.lastFrame !== undefined) {
        const elapsed = now - test.lastFrame;
        test.intervals++;
        if (test.lastMovement !== movement) {
          test.movingIntervals++;
          if (elapsed > 34) test.longMovingIntervals++;
          test.worstMovingInterval = Math.max(test.worstMovingInterval, elapsed);
        }
      }
      test.lastFrame = now;
      test.lastMovement = movement;
      if (now - test.started >= 10000) finishTest('Completed');
      else frameRequest = requestAnimationFrame(frame);
    }
    frameRequest = requestAnimationFrame(frame);
  }

  function savePage() {
    if (activeTest) finishTest('Page changed');
    try { sessionStorage.setItem(reportKey, JSON.stringify(report().pages.slice(-6))); } catch {}
  }

  async function copyReport() {
    if (activeTest) finishTest('Report copied');
    const text = JSON.stringify(report(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      manualCopy.hidden = true;
      status.textContent = 'Diagnostic report copied.';
    } catch {
      manualCopy.hidden = false;
      manualCopy.value = text;
      manualCopy.focus();
      manualCopy.select();
      status.textContent = 'Copy the selected report.';
    }
  }

  function exit() {
    if (activeTest) finishTest('Diagnostics closed');
    clearTimeout(renderTimer);
    observer.abort();
    try {
      sessionStorage.removeItem(enabledKey);
      sessionStorage.removeItem(reportKey);
    } catch {}
    const url = new URL(location.href);
    url.searchParams.delete('diagnostics');
    history.replaceState(history.state, '', url);
    panel.remove();
    stylesheet.remove();
    // Feature scripts may have obtained this handle during page initialization.
    for (const method of ['state', 'event', 'count', 'sample']) diagnostics[method] = () => {};
    delete window.PortfolioDiagnostics;
  }

  function render() {
    if (!panel) return;
    summary.textContent = activeTest ? 'Diagnostics · recording' : 'Diagnostics';
    if (!panel.open) return;
    const current = page();
    const env = current.environment;
    const loading = current.loadingLibraries || [];
    const allLibraries = Object.entries(current.libraries).filter(([, version]) => version)
      .map(([name, version]) => name + (typeof version === 'string' ? ' ' + version : ''));
    panel.querySelector('[data-environment]').textContent =
      env.viewport.width + ' × ' + env.viewport.height + ' CSS px · ' + env.primaryPointer + ' pointer' +
      (env.primaryHover ? ' with hover' : ' without hover') + ' · ' + env.touchPoints + ' touch points' +
      ' · Reduced motion ' + (env.reducedMotion ? 'on' : 'off');
    const libraryStatus = [];
    if (allLibraries.length || !loading.length) {
      libraryStatus.push('Loaded libraries — ' + (allLibraries.join(', ') || 'none'));
    }
    if (loading.length) libraryStatus.push('Loading libraries — ' + loading.join(', '));
    panel.querySelector('[data-libraries]').textContent = libraryStatus.join(' · ');
    results.replaceChildren();
    function row(label, text) {
      const title = document.createElement('dt');
      const details = document.createElement('dd');
      title.textContent = label;
      details.textContent = text;
      results.append(title, details);
    }
    const visibleFeatures = [...(expected[section] || [])];
    if (section === 'portfolio' && document.querySelector('.portfolio-card[data-gallery-preview]')) {
      visibleFeatures.push('portfolio-preview');
    }
    if (section === 'gallery' && document.querySelector('[data-about-entry-link]')) {
      visibleFeatures.push('about-entry');
    }
    if (section === 'gallery' && document.querySelector('#public-map')) {
      visibleFeatures.unshift('gallery-map-preview');
    }
    if (section === 'gallery' && document.querySelector('[data-gsap-gallery-scroll]')) {
      visibleFeatures.splice(visibleFeatures.indexOf('gallery-wheel') + 1, 0, 'gallery-smoother');
    }
    for (const feature of visibleFeatures) {
      const mode = features[feature];
      const activity = Object.entries(tallies[feature] || {}).map(([name, total]) => name + ' ' + total);
      if (motion[feature]?.advances) activity.unshift(motion[feature].advances + ' motion updates');
      if (feature.endsWith('-smoother') && motion[feature]?.maxNativeDifferencePx) {
        activity.push('max smoothing offset ' + motion[feature].maxNativeDifferencePx + ' px');
      }
      row(labels[feature], [
        mode?.mode || 'No initialization reported', mode?.reason, activity.join(' · ')
      ].filter(Boolean).join(' — '));
    }
    if (current.resume) row('Résumé image loading', current.resume.imagesLoaded + ' of ' + current.resume.images +
      ' thumbnails loaded · ' + current.resume.waiting + ' of ' + current.resume.milestones + ' cards awaiting reveal');
    const previousTransition = priorPages.flatMap(page => page?.events || []).reverse()
      .find(entry => entry.feature === 'gallery-edge' && entry.activity === 'navigation started');
    if (previousTransition) row('Last gallery transition', previousTransition.details?.engine || 'Mode unavailable');
    const errors = events.filter(entry => entry.feature === 'scripts');
    if (errors.length) row('Script errors', errors.slice(-5).map(entry => entry.details.file + ' ' + entry.activity).join(' · '));
  }

  function mount() {
    if (section === 'gallery') {
      if (!document.querySelector('.gallery-navigation')) {
        state('gallery-edge', 'Unavailable', 'This gallery has no adjacent gallery navigation.');
        state('gallery-swipe', 'Unavailable', 'This gallery has no adjacent gallery navigation.');
      }
      if (document.querySelector('#gallery-access')) {
        state('gallery-wheel', 'Waiting for gallery unlock');
        state('gallery-touch', 'Waiting for gallery unlock');
      }
    }
    stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = style;
    document.head.append(stylesheet);
    panel = document.createElement('details');
    panel.className = 'portfolio-diagnostics';
    panel.innerHTML = '<summary>Diagnostics</summary>' +
      '<div class="portfolio-diagnostics__body"><p data-environment></p><p data-libraries></p><dl></dl>' +
      '<div class="portfolio-diagnostics__actions"><button type="button" data-record>Record 10 seconds</button>' +
      '<button type="button" data-copy>Copy report</button><button type="button" data-exit>Exit diagnostics</button></div>' +
      '<div class="portfolio-diagnostics__status" role="status"></div>' +
      '<textarea aria-label="Diagnostic report" rows="7" readonly hidden></textarea></div>';
    summary = panel.querySelector('summary');
    results = panel.querySelector('dl');
    status = panel.querySelector('[role="status"]');
    actions = panel.querySelector('.portfolio-diagnostics__actions');
    manualCopy = panel.querySelector('textarea');
    panel.addEventListener('toggle', render);
    panel.addEventListener('wheel', event => event.stopPropagation(), { passive: true });
    actions.querySelector('[data-record]').addEventListener('click', recordTest);
    actions.querySelector('[data-copy]').addEventListener('click', copyReport);
    actions.querySelector('[data-exit]').addEventListener('click', exit);
    document.body.append(panel);
  }

  Object.assign(diagnostics, { state, count, event, sample, report });
  delete diagnostics.pending;
  for (const [method, args] of pending) diagnostics[method](...args);
  window.addEventListener('wheel', event => {
    if (!outsidePanel(event)) return;
    input.wheel++;
    if (event.deltaMode === 0 && Math.abs(event.deltaY) < 32) input.smallPixelWheel++;
  }, { passive: true, capture: true, signal });
  window.addEventListener('pointerdown', event => {
    if (!outsidePanel(event)) return;
    if (event.pointerType === 'mouse') input.mousePresses++;
    if (event.pointerType === 'pen') input.penPresses++;
  }, { passive: true, capture: true, signal });
  window.addEventListener('touchstart', event => {
    if (outsidePanel(event)) input.touchStarts++;
  }, { passive: true, capture: true, signal });
  window.addEventListener('scroll', event => {
    if (!outsidePanel(event)) return;
    input.scrollEvents++;
    movement++;
    refreshSoon();
  }, { passive: true, capture: true, signal });
  window.addEventListener('resize', refreshSoon, { passive: true, signal });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) finishTest('Tab hidden');
  }, { signal });
  window.addEventListener('pagehide', savePage, { signal });
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      priorPages = readPriorPages();
      refreshSoon();
    }
  }, { signal });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true, signal });
  else mount();
})();

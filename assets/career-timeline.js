(() => {
  'use strict';

  const track = document.querySelector('[data-career-timeline]');
  if (!track) return;

  // ScrollTrigger + DrawSVG + MotionPath, following the supplied snorklTV
  // tutorial. This second layout follows the user's broad S-curve sketch.
  const svg = track.querySelector('svg');
  const rail = track.querySelector('.career-rail');
  const stage = track.querySelector('.career-stage');
  const canvas = track.querySelector('.career-canvas');
  const path = track.querySelector('[data-career-path]');
  const background = track.querySelector('[data-career-background]');
  const pointer = track.querySelector('[data-career-pointer]');
  const stops = track.querySelector('[data-career-stops]');
  const entries = [...track.querySelectorAll('.career-milestone')];
  const texts = entries.flatMap(entry => [...entry.querySelectorAll('.career-year, .career-copy')]);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const viewportMeasure = document.querySelector('.career-viewport');
  const dialog = document.querySelector('#career-details');
  const dialogBody = dialog.querySelector('[data-career-details-body]');
  const imageDialog = document.querySelector('#career-image');
  const fullImage = imageDialog.querySelector('[data-career-image-full]');
  const ns = 'http://www.w3.org/2000/svg';
  const desktopCurveAspect = 1.25;
  const curveExtent = 1.22;
  let canAnimate = false;
  let animation;
  let scrollTween;
  let mobileReveals = [];
  let scrollCamera;
  let smoother;
  let signature = '';
  let resizeTimer;

  function enableAnimation() {
    if (!window.gsap || !window.ScrollTrigger || !window.DrawSVGPlugin || !window.MotionPathPlugin) return;
    gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, MotionPathPlugin);
    if (window.ScrollSmoother) gsap.registerPlugin(ScrollSmoother);
    // Collapsing mobile browser controls must not refresh the scroll journey.
    ScrollTrigger.config({ ignoreMobileResize: true });
    canAnimate = true;
    rebuild();
  }

  function element(name, attributes) {
    const node = document.createElementNS(ns, name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    return node;
  }

  function showDetails(entry) {
    const copy = entry.querySelector('.career-copy').cloneNode(true);
    const heading = copy.querySelector('h2');
    const year = entry.querySelector('.career-year').cloneNode(true);
    copy.removeAttribute('style');
    year.removeAttribute('style');
    heading.textContent = heading.textContent;
    heading.id = 'career-details-title';
    dialogBody.replaceChildren(year, copy);
    dialog.showModal();
    syncDialogScrolling();
  }

  function syncDialogScrolling() {
    if (smoother) smoother.paused(dialog.open || imageDialog.open);
  }

  function showImage(link) {
    if (imageDialog.open) return;
    const thumbnail = link.querySelector('img');
    fullImage.src = link.href;
    fullImage.alt = thumbnail.alt;
    imageDialog.setAttribute('aria-label', thumbnail.alt);
    imageDialog.showModal();
    syncDialogScrolling();
  }

  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[data-career-image]');
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    showImage(link);
  });

  entries.forEach(entry => entry.querySelector('button.career-checkpoint')?.addEventListener('click', () => showDetails(entry)));
  entries.forEach(entry => {
    entry.addEventListener('focusin', updateMobileReveals);
    entry.addEventListener('focusout', () => window.requestAnimationFrame(updateMobileReveals));
  });
  [dialog, imageDialog].forEach(modal => {
    modal.addEventListener('click', event => {
      if (event.target !== modal) return;
      const box = modal.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) modal.close();
    });
    modal.addEventListener('close', syncDialogScrolling);
  });

  function updateDesktopSmoothing(narrow) {
    const enabled = canAnimate && window.ScrollSmoother && !narrow && !reducedMotion.matches;
    if (enabled && !smoother) {
      smoother = ScrollSmoother.create({
        wrapper: '#career-scroll-wrapper',
        content: '#career-scroll-content',
        smooth: .8,
        smoothTouch: 0,
        effects: false,
        normalizeScroll: false,
        onUpdate: updateScrollCamera,
        onFocusIn: () => dialog.open || imageDialog.open ? false : undefined
      });
    } else if (!enabled && smoother) {
      smoother.kill();
      smoother = null;
    }
    track.dataset.desktopSmoothing = smoother ? '.8' : '0';
  }

  function reset() {
    scrollCamera = null;
    if (scrollTween) {
      scrollTween.scrollTrigger.kill();
      scrollTween.kill();
      scrollTween = null;
    }
    if (animation) {
      animation.kill();
      animation = null;
    }
    mobileReveals.forEach(reveal => reveal.animation.kill());
    mobileReveals = [];
    stage.style.removeProperty('transform');
    canvas.style.removeProperty('transform');
    entries.forEach(entry => entry.style.removeProperty('transform'));
    track.classList.remove('career-track--slow');
    if (canAnimate) gsap.set([...texts, pointer, path, ...stops.children], { clearProps: 'all' });
    track.dataset.timelineState = 'static';
  }

  // Integrate a 1x -> 2x scroll-distance weight, blending around the midpoint.
  // Its total is 1.5: the latter half takes twice as much scrolling as before.
  function journeyDistance(progress) {
    if (progress <= .45) return progress;
    if (progress >= .55) return 2 * progress - .5;
    const t = (progress - .45) / .1;
    return progress + .1 * (t * t * t - .5 * t * t * t * t);
  }

  function journeyProgress(distance) {
    if (distance <= 0) return 0;
    if (distance >= 1) return 1;
    const target = distance * 1.5;
    let low = 0, high = 1;
    for (let i = 0; i < 24; i++) {
      const middle = (low + high) / 2;
      if (journeyDistance(middle) < target) low = middle;
      else high = middle;
    }
    return (low + high) / 2;
  }

  function updateScrollCamera() {
    if (!scrollCamera || !animation) return;
    const c = scrollCamera;
    const scroll = smoother ? smoother.scrollTop() : window.scrollY;
    const progress = animation.progress();
    const virtualScroll = scroll < c.start ? scroll : c.start + progress * c.normalDistance + Math.max(0, scroll - c.end);
    const pinnedOffset = Math.max(0, Math.min(c.outerHeight - c.viewport, scroll - c.documentTop));
    const stageTop = c.documentTop - scroll + pinnedOffset;
    // Explicit positioning also works inside ScrollSmoother's transformed content.
    stage.style.transform = 'translate3d(0,' + pinnedOffset.toFixed(3) + 'px,0)';
    const y = c.documentTop - virtualScroll - stageTop;
    if (!c.anchor) {
      canvas.style.transform = 'translate3d(0,' + y.toFixed(3) + 'px,0)';
      return;
    }
    const point = path.getPointAtLength(progress * c.length);
    const x = c.anchor - c.left - point.x;
    canvas.style.transform = 'translate3d(' + x.toFixed(3) + 'px,' + y.toFixed(3) + 'px,0)';
    c.labels.forEach((box, i) => {
      // Keep cards readable while the wider curve pans behind them.
      const labelWidth = box.right - box.left;
      const left = Math.max(-x, Math.min(c.width - labelWidth - x, box.left));
      const shift = left - box.left;
      entries[i].style.transform = 'translateX(' + shift.toFixed(3) + 'px)';
    });
  }

  function updateMobileReveals() {
    if (!animation) return;
    const progress = animation.progress();
    mobileReveals.forEach(reveal => {
      const reached = progress + .0001 >= reveal.at || reveal.entry.contains(document.activeElement);
      if (reached === reveal.reached) return;
      reveal.reached = reached;
      if (reached) reveal.animation.play();
      else reveal.animation.reverse();
    });
  }

  function drawCurve(width, height, narrow, scale, desktopAspect) {
    const desktopSpan = (height - 80 * scale) / (desktopAspect * curveExtent);
    const span = narrow ? Math.min(300, width * .7) : Math.min(width, desktopSpan);
    const offset = narrow ? 8 : (width - span) / 2;
    const x = value => offset + value * span;
    const y = value => 56 * scale + value * (height - 80 * scale) / curveExtent;
    // Leave room to the left of the first date for its thumbnail.
    const startX = narrow ? x(.10) : Math.max(x(.10), 180 * scale);
    const d = 'M ' + startX + ' ' + y(0) +
      ' C ' + x(.51) + ' ' + y(.015) + ', ' + x(.40) + ' ' + y(.12) + ', ' + x(.29) + ' ' + y(.23) +
      ' C ' + x(.12) + ' ' + y(.40) + ', ' + x(.12) + ' ' + y(.47) + ', ' + x(.26) + ' ' + y(.58) +
      ' C ' + x(.40) + ' ' + y(.69) + ', ' + x(.65) + ' ' + y(.81) + ', ' + x(.74) + ' ' + y(.91) +
      ' C ' + x(.83) + ' ' + y(1.01) + ', ' + x(.70) + ' ' + y(1.16) + ', ' + x(.50) + ' ' + y(curveExtent);
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    path.setAttribute('d', d);
    background.setAttribute('d', d);
    track.style.setProperty('--career-curve-height', height + 'px');

    const length = path.getTotalLength();
    const samples = Array.from({ length: 257 }, (_, i) => {
      const point = path.getPointAtLength(length * i / 256);
      return { x: point.x, y: point.y, progress: i / 256 };
    });
    function atY(target) {
      if (target <= samples[0].y) return samples[0];
      if (target >= samples[256].y) return samples[256];
      let low = 0, high = 256;
      while (high - low > 1) {
        const middle = (low + high) >> 1;
        if (samples[middle].y < target) low = middle;
        else high = middle;
      }
      const a = samples[low], b = samples[high];
      const mix = (target - a.y) / (b.y - a.y);
      return {
        x: a.x + (b.x - a.x) * mix,
        y: target,
        progress: a.progress + (b.progress - a.progress) * mix
      };
    }
    return { length, atY, endX: samples[256].x, y: value => y(value * curveExtent) };
  }

  function minimumVisibleFraction(metrics, height, available) {
    let minimum = 1;
    const lastStart = Math.max(0, height - available);
    for (let i = 0; i <= 40; i++) {
      const top = lastStart * i / 40;
      minimum = Math.min(minimum, metrics.atY(top + available).progress - metrics.atY(top).progress);
    }
    return minimum;
  }

  function placeLabels(points, metrics, width, narrow, scale, cameraAnchor, trackLeft) {
    const placed = [];
    entries.forEach((entry, i) => {
      const point = points[i];
      const above = entry.dataset.curveSide === 'above';
      const side = above ? 'above' : narrow ? 'right' : entry.dataset.curveSide;
      const yearGutter = !narrow && entry.dataset.yearLayout === 'inline' ? 56 * scale : 0;
      const preferredWidth = narrow ? Math.min(above ? 260 : 300, width - 24) : Math.min(420 * scale, width * .36) + 40 * scale + yearGutter;
      entry.style.width = preferredWidth + 'px';
      let top = above ? Math.max(0, point.y - entry.offsetHeight - 12 * scale) : point.y - 16 * scale;
      let left = 0, labelWidth = preferredWidth, labelHeight = entry.offsetHeight;

      // Keep whole text blocks clear of the curve, not only their first line.
      // Nearby labels may shift slightly; their checkpoints stay on the sketch.
      for (let pass = 0; pass < 5; pass++) {
        labelHeight = entry.offsetHeight;
        let minX = point.x, maxX = point.x;
        for (let j = 0; j <= 8; j++) {
          const sample = metrics.atY(top + labelHeight * j / 8);
          minX = Math.min(minX, sample.x);
          maxX = Math.max(maxX, sample.x);
        }
        if (side === 'above') {
          const headingOffset = narrow ? 32 : 164;
          left = Math.max(0, Math.min(width - preferredWidth, point.x - headingOffset * scale));
        } else if (side === 'right') {
          left = maxX + 18 * scale;
          // The final card must clear its node while the camera follows the leftward tail.
          const tailClearance = cameraAnchor && i === entries.length - 1 ? Math.max(0, point.x - metrics.endX) : 0;
          const availableWidth = cameraAnchor ? width + trackLeft - cameraAnchor - 18 * scale - tailClearance : width - left;
          labelWidth = Math.max(60, Math.min(preferredWidth, availableWidth));
        } else {
          labelWidth = Math.max(60, Math.min(preferredWidth, minX - 18 * scale));
          left = Math.max(0, minX - 18 * scale - labelWidth);
        }
        entry.style.width = labelWidth + 'px';
        labelHeight = entry.offsetHeight;
        let nextTop = top;
        for (const other of placed) {
          const horizontalOverlap = narrow || (left < other.right + 8 * scale && left + labelWidth > other.left - 8 * scale);
          if (horizontalOverlap && nextTop < other.bottom + 12 * scale && nextTop + labelHeight > other.top - 12 * scale) {
            nextTop = other.bottom + 12 * scale;
          }
        }
        if (Math.abs(nextTop - top) < .5 && pass > 0) break;
        top = nextTop;
      }
      entry.style.left = left + 'px';
      entry.style.top = top + 'px';
      placed.push({ left, right: left + labelWidth, top, bottom: top + entry.offsetHeight, side });
    });
    return placed;
  }

  function rebuild() {
    const width = track.clientWidth;
    const narrow = width < 720;
    // The small viewport stays constant when a phone's address bar folds away.
    // Actual viewport/orientation changes still recalculate the geometry.
    const viewport = narrow && viewportMeasure ? Math.round(viewportMeasure.getBoundingClientRect().height) : window.innerHeight;
    if (!width || !viewport) return;
    const scale = parseFloat(getComputedStyle(track).getPropertyValue('--career-layout-scale')) || 1;
    const nextSignature = [width, viewport, scale, reducedMotion.matches, canAnimate].join(':');
    if (nextSignature === signature) return;
    signature = nextSignature;
    reset();
    updateDesktopSmoothing(narrow);
    track.classList.add('career-track--positioned');
    track.classList.toggle('career-track--narrow', narrow);
    track.classList.toggle('career-track--tight', narrow && width < 300);

    // Calibrate using actual SVG arc length, rather than only its height.
    // Even the first viewport (with the header and title present) fits >=40%.
    const documentTop = track.getBoundingClientRect().top + (smoother ? smoother.scrollTop() : window.scrollY);
    const available = Math.max(120, viewport - documentTop - 16);
    // On wide screens the reference gives the curve more room horizontally.
    const desktopAspect = desktopCurveAspect / (1 + (scale - 1) * 2 / 3);
    let height = Math.round(available * 2 * curveExtent);
    if (!narrow) height = Math.min(height, Math.round(width * desktopAspect * curveExtent + 80 * scale));
    let metrics, visibleFraction;
    for (let i = 0; i < 9; i++) {
      metrics = drawCurve(width, height, narrow, scale, desktopAspect);
      visibleFraction = minimumVisibleFraction(metrics, height, available);
      if (visibleFraction >= .42) break;
      height = Math.round(height * .9);
    }
    const compact = narrow || height < 1100 * scale;
    track.classList.toggle('career-track--compact', compact);
    track.dataset.visibleCurveFraction = visibleFraction.toFixed(3);
    track.dataset.curveHeight = String(height);

    const points = entries.map(entry => {
      const targetY = metrics.y(Number(entry.dataset.curveAt));
      const at = metrics.atY(targetY).progress;
      const exact = path.getPointAtLength(at * metrics.length);
      return { x: exact.x, y: exact.y, progress: at };
    });
    const slowMobile = narrow && canAnimate && !reducedMotion.matches;
    const trackLeft = track.getBoundingClientRect().left;
    const cameraAnchor = slowMobile ? Math.max(96, Math.min(180, window.innerWidth * .38)) : 0;
    const labels = placeLabels(points, metrics, width, narrow, scale, cameraAnchor, trackLeft);
    stops.replaceChildren(...points.map((point, i) => {
      const circle = element('circle', { cx: point.x, cy: point.y, r: narrow ? 6 : 8 * scale, class: 'career-stop' });
      circle.addEventListener('click', () => entries[i].querySelector('.career-checkpoint').click());
      return circle;
    }));
    pointer.setAttribute('r', String(narrow ? 7 : 7 * scale));
    const contentHeight = Math.ceil(Math.max(height, ...labels.map(box => box.bottom)) + 24);
    canvas.style.height = contentHeight + 'px';
    track.style.height = contentHeight + 'px';
    track.dataset.scrollMultiplier = slowMobile ? '3' : '1';
    track.dataset.lateScrollMultiplier = slowMobile ? '6' : '2';
    delete track.dataset.cameraAnchor;

    if (!canAnimate || reducedMotion.matches) return;
    const revealLine = Math.round(viewport * (narrow ? .65 : .5));
    const normalStart = Math.max(0, documentTop - revealLine);
    const tailHeight = (document.querySelector('.career-outro')?.offsetHeight || 0) +
      (document.querySelector('.portfolio-footer')?.offsetHeight || 0);
    const maximumEnd = documentTop + contentHeight + tailHeight - viewport - 1;
    if (maximumEnd <= normalStart) {
      gsap.set(path, { drawSVG: '100%' });
      gsap.set(texts, { autoAlpha: 1 });
      return;
    }
    const normalEnd = Math.min(maximumEnd, Math.max(documentTop + height - revealLine, documentTop + contentHeight - viewport));
    const normalDistance = Math.max(1, normalEnd - normalStart);
    const scrollDistance = normalDistance * (slowMobile ? 3 : 1) * 1.5;
    const end = normalStart + scrollDistance;
    // Reserve only the extra animation distance; do not leave an empty tail.
    const outerHeight = contentHeight + scrollDistance - normalDistance;
    track.dataset.normalScrollDistance = normalDistance.toFixed(3);
    track.dataset.scrollDistance = scrollDistance.toFixed(3);
    track.dataset.scrollStart = normalStart.toFixed(3);
    track.dataset.scrollEnd = end.toFixed(3);
    track.classList.add('career-track--slow');
    track.style.setProperty('--career-stage-height', viewport + 'px');
    track.style.height = outerHeight + 'px';
    if (slowMobile) track.dataset.cameraAnchor = cameraAnchor.toFixed(3);
    scrollCamera = { documentTop, viewport, start: normalStart, end, outerHeight, normalDistance, left: trackLeft, anchor: cameraAnchor, length: metrics.length, width, labels };
    animation = gsap.timeline({
      paused: true,
      defaults: { ease: 'none' },
      onUpdate: () => { updateScrollCamera(); updateMobileReveals(); }
    });
    animation.fromTo(path, { drawSVG: 0 }, { drawSVG: '100%', duration: 1 }, 0);
    animation.fromTo(pointer, { autoAlpha: 0 }, { autoAlpha: 1, duration: .004 }, 0);
    animation.to(pointer, {
      duration: 1,
      motionPath: { path, align: path, alignOrigin: [.5, .5] }
    }, 0);
    points.forEach((point, i) => {
      const at = point.progress;
      if (narrow) {
        // Give each entrance a real duration even during a quick touch swipe.
        // The scrubbed travelling dot decides when to play or reverse it.
        const reveal = gsap.timeline({ paused: true });
        reveal.fromTo(entries[i].querySelector('.career-year'), {
          opacity: .35, x: -8
        }, { opacity: 1, x: 0, duration: .4, ease: 'power2.out' }, 0);
        reveal.fromTo(entries[i].querySelector('.career-copy'), {
          opacity: 0, x: -24, y: 8
        }, { opacity: 1, x: 0, y: 0, duration: .6, ease: 'power3.out' }, .06);
        reveal.fromTo(stops.children[i], {
          attr: { r: 2.5 }, autoAlpha: .3
        }, { attr: { r: 6.5 }, autoAlpha: 1, duration: .5, ease: 'back.out(2)' }, 0);
        mobileReveals.push({ entry: entries[i], at, animation: reveal, reached: false });
        return;
      }
      const duration = Math.min(.025, (1 - at) * .8);
      animation.fromTo(stops.children[i], { attr: { r: 3 * scale }, autoAlpha: .4 }, {
        attr: { r: narrow ? 6 : 8 * scale }, autoAlpha: 1, duration,
        ease: 'back.out(2.5)'
      }, at);
      animation.fromTo(entries[i].querySelectorAll('.career-year, .career-copy'), {
        opacity: .8
      }, { opacity: 1, duration, ease: 'power2.out' }, at);
    });
    const playhead = { progress: 0 };
    scrollTween = gsap.to(playhead, {
      progress: 1,
      duration: 1,
      ease: journeyProgress,
      onUpdate: () => animation.progress(playhead.progress),
      scrollTrigger: {
        id: 'artur-career-timeline',
        trigger: track,
        start: normalStart,
        end,
        scrub: narrow ? .35 : smoother ? true : .8,
        onUpdate: updateScrollCamera
      }
    });
    track.dataset.timelineState = 'animated';
    if (smoother) ScrollTrigger.refresh();
    else scrollTween.scrollTrigger.refresh();
    scrollTween.progress(scrollTween.scrollTrigger.progress);
    updateScrollCamera();
    updateMobileReveals();
  }

  function scheduleRebuild() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => window.requestAnimationFrame(rebuild), 120);
  }
  // This script runs first. Draw the curve before the deferred GSAP files
  // finish, then add the motion once those files have executed.
  document.addEventListener('DOMContentLoaded', enableAnimation, { once: true });
  rebuild();
  window.addEventListener('resize', scheduleRebuild, { passive: true });
  window.addEventListener('scroll', updateScrollCamera, { passive: true });
  reducedMotion.addEventListener('change', scheduleRebuild);
  if (window.ResizeObserver) new ResizeObserver(scheduleRebuild).observe(track);
  document.fonts?.addEventListener('loadingdone', () => {
    signature = '';
    scheduleRebuild();
  });
})();

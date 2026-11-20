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
  const mobileScroller = document.querySelector('.career-native-scroll');
  const path = track.querySelector('[data-career-path]');
  const background = track.querySelector('[data-career-background]');
  const pointer = track.querySelector('[data-career-pointer]');
  const stops = track.querySelector('[data-career-stops]');
  const entries = [...track.querySelectorAll('.career-milestone')];
  const texts = entries.flatMap(entry => [...entry.querySelectorAll('.career-year, .career-copy')]);
  const previews = entries.map(entry => [...entry.querySelectorAll('.career-preview img')]);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const touchDevice = window.matchMedia('(any-pointer: coarse)');
  const viewportMeasure = document.querySelector('.career-viewport');
  const contact = document.querySelector('.career-contact');
  const outro = document.querySelector('.career-outro');
  const footer = document.querySelector('.portfolio-footer');
  const backdrops = document.querySelector('.career-backdrops');
  const network = backdrops?.querySelector('.career-network');
  const ending = document.createElement('div');
  ending.className = 'career-ending';
  const endingHomes = [contact, outro, footer].filter(Boolean).map(node => {
    const marker = document.createComment('career-ending-home');
    node.before(marker);
    return { node, marker, role: node.getAttribute('role') };
  });
  const dialog = document.querySelector('#career-details');
  const dialogBody = dialog.querySelector('[data-career-details-body]');
  const imageDialog = document.querySelector('#career-image');
  const fullImage = imageDialog.querySelector('[data-career-image-full]');
  const ns = 'http://www.w3.org/2000/svg';
  const desktopCurveAspect = 1.25;
  const curveExtent = 1.22;
  const mobileCardInset = 16;
  let canAnimate = false;
  let animation;
  let scrollTween;
  let milestoneReveals = [];
  let scrollCamera;
  let smoother;
  let scroller = window;
  let signature = '';
  let resizeTimer;
  let initialized = false;
  let prioritizedMilestone = -1;

  function setMobileEnding(enabled) {
    if (enabled) {
      canvas.append(ending);
      endingHomes.forEach(({ node }) => ending.append(node));
      footer?.setAttribute('role', 'contentinfo');
    } else {
      endingHomes.forEach(({ node, marker, role }) => {
        marker.after(node);
        if (role === null) node.removeAttribute('role');
        else node.setAttribute('role', role);
      });
      ending.remove();
      ending.removeAttribute('style');
    }
  }

  function scrollTop() {
    if (smoother) return smoother.scrollTop();
    return scroller === window ? window.scrollY : scroller.scrollTop;
  }

  function scrollLimit() {
    const height = scroller === window ? document.documentElement.scrollHeight : scroller.scrollHeight;
    const visibleHeight = scroller === window ? window.innerHeight : scroller.clientHeight;
    return Math.max(0, height - visibleHeight);
  }

  function prioritizePreviews(index) {
    if (index === prioritizedMilestone) return;
    prioritizedMilestone = index;
    previews.forEach((images, i) => images.forEach(image => {
      image.loading = 'eager';
      image.fetchPriority = i >= index - 1 && i <= index + 2 ? 'high' : 'low';
    }));
  }

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
    entry.addEventListener('focusin', updateMilestoneReveals);
    entry.addEventListener('focusout', () => window.requestAnimationFrame(updateMilestoneReveals));
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
    backdrops?.style.removeProperty('--career-backdrop-footer-space');
    network?.style.removeProperty('transform');
    if (scrollTween) {
      scrollTween.scrollTrigger.kill();
      scrollTween.kill();
      scrollTween = null;
    }
    if (animation) {
      animation.kill();
      animation = null;
    }
    milestoneReveals.forEach(reveal => reveal.animation.kill());
    milestoneReveals = [];
    stage.style.removeProperty('transform');
    canvas.style.removeProperty('transform');
    entries.forEach(entry => entry.classList.remove('career-milestone--awaiting-reveal'));
    track.classList.remove('career-track--slow', 'career-track--complete');
    if (canAnimate) {
      gsap.set(entries, { clearProps: 'opacity,visibility,transform' });
      gsap.set([...texts, pointer, path, ...stops.children], { clearProps: 'all' });
    }
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
    const scroll = scrollTop();
    const progress = animation.progress();
    // Cache the reading position in either layout before resize/refresh can
    // clamp the old scroll offset or change the animation's geometry.
    const measuredViewport = c.narrow && viewportMeasure ? Math.round(viewportMeasure.getBoundingClientRect().height) : window.innerHeight;
    if (track.clientWidth === c.width && measuredViewport === c.viewport) {
      c.readingPosition = captureReadingPosition(false);
    }
    if (network) {
      // Counter 70% of the page movement and keep the same placement at the footer.
      const remaining = Math.max(0, scrollLimit() - scroll);
      network.style.transform = 'translateY(' + (-.7 * remaining).toFixed(3) + 'px)';
    }
    // Mobile finishes at the final milestone, including its ending controls.
    const point = c.anchor ? path.getPointAtLength(Math.min(progress, c.lastStopAt) * c.length) : null;
    const virtualScroll = scroll < c.start ? scroll : c.start + progress * c.normalDistance + Math.max(0, scroll - c.end);
    const pinnedOffset = Math.max(0, Math.min(c.outerHeight - c.viewport, scroll - c.documentTop));
    const stageTop = c.documentTop - scroll + pinnedOffset;
    // Desktop needs this transform inside ScrollSmoother. Mobile is pinned by
    // CSS sticky, so native touch scrolling cannot run ahead of a JS pin.
    if (!c.anchor) stage.style.transform = 'translate3d(0,' + pinnedOffset.toFixed(3) + 'px,0)';
    const y = c.documentTop - virtualScroll - stageTop;
    if (!c.anchor) {
      canvas.style.transform = 'translate3d(0,' + y.toFixed(3) + 'px,0)';
      return;
    }
    const nextIndex = c.mobileStops.findIndex(stop => stop.progress > progress);
    const endStopIndex = nextIndex < 0 ? c.mobileStops.length - 1 : Math.max(1, nextIndex);
    const from = c.mobileStops[endStopIndex - 1];
    const to = c.mobileStops[endStopIndex];
    const fraction = Math.max(0, Math.min(1, (progress - from.progress) / (to.progress - from.progress)));
    const blend = fraction * fraction * (3 - 2 * fraction);
    const framedX = from.offset + (to.offset - from.offset) * blend;
    const x = Math.max(10 - point.x, Math.min(framedX, c.width - 10 - point.x));
    pointer.setAttribute('cx', point.x);
    pointer.setAttribute('cy', point.y);
    // Let the marker move into the screen before following it upward. Stop
    // following once the last card and Contact fit below the visible entries.
    const mobileY = Math.max(c.minimumY, Math.min(0, c.followY - point.y));
    // Keep the curve, text and thumbnails together as the view moves.
    canvas.style.transform = 'translate3d(' + x.toFixed(3) + 'px,' + mobileY.toFixed(3) + 'px,0)';
    // Fade departing cards before the viewport cuts through their text.
    // Their positions still follow the same canvas transform as the spline.
    entries.forEach(entry => {
      const left = parseFloat(entry.style.left) + x;
      const opacity = Math.max(0, Math.min(1, left / mobileCardInset));
      entry.style.opacity = opacity.toFixed(3);
      // Fully faded previews must not leave invisible links over the map.
      // Inherit visibility so the initial loading guard remains effective.
      entry.style.visibility = opacity > 0 ? 'inherit' : 'hidden';
    });
    ending.style.transform = 'translateX(' + (-x).toFixed(3) + 'px)';
  }

  function updateMilestoneReveals() {
    if (!animation) return;
    const progress = animation.progress();
    let current = 0;
    milestoneReveals.forEach((reveal, i) => {
      const threshold = reveal.reached ? reveal.hideAt : reveal.at;
      const reached = progress + .0001 >= threshold || reveal.entry.contains(document.activeElement);
      if (reached) current = i;
      if (reached === reveal.reached) return;
      reveal.reached = reached;
      reveal.entry.classList.toggle('career-milestone--awaiting-reveal', !reached);
      if (reached) reveal.animation.play();
      else reveal.animation.reverse();
    });
    track.classList.toggle('career-track--complete', Boolean(scrollCamera?.anchor && milestoneReveals.at(-1)?.reached));
    prioritizePreviews(current);
  }

  function drawCurve(width, height, narrow, scale, desktopAspect, mobileTopInset) {
    const desktopSpan = (height - 80 * scale) / (desktopAspect * curveExtent);
    const span = narrow ? width * 2 : Math.min(width, desktopSpan);
    const offset = narrow ? 8 : (width - span) / 2;
    const x = value => offset + value * span;
    const startY = narrow ? mobileTopInset : 56 * scale;
    const verticalSpan = narrow ? height - startY - 24 : height - 80 * scale;
    const y = value => startY + value * verticalSpan / curveExtent;
    // Leave room to the left of the first date for its thumbnail.
    const startX = narrow ? x(.36) : Math.max(x(.10), 180 * scale);
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

  function measureMobileLabels(width) {
    const anchor = Math.max(32, Math.min(56, width * .12));
    const cardLeft = anchor + 18;
    const cardWidth = width - cardLeft;
    entries.forEach(entry => { entry.style.width = cardWidth + 'px'; });
    const heights = entries.map(entry => entry.offsetHeight);
    const contentWidths = entries.map(entry => {
      const parts = entry.querySelectorAll('.career-year, .career-checkpoint, .career-preview');
      const right = Math.max(...Array.from(parts, part => part.getBoundingClientRect().right));
      return right - entry.getBoundingClientRect().left;
    });
    const minimumSpan = heights.slice(0, -1).reduce((sum, height) => sum + height + 24, 0);
    return { anchor, cardLeft, contentWidths, heights, minimumSpan };
  }

  function placeMobileLabels(metrics, layout) {
    const lastAt = Number(entries[entries.length - 1].dataset.curveAt);
    const extraSpan = Math.max(0, metrics.y(lastAt) - metrics.y(0) - layout.minimumSpan);
    const points = [];
    const labels = [];
    let rowY = metrics.y(0);
    entries.forEach((entry, i) => {
      if (i) {
        const gap = Number(entry.dataset.curveAt) - Number(entries[i - 1].dataset.curveAt);
        rowY += layout.heights[i - 1] + 24 + extraSpan * gap / lastAt;
      }
      const at = metrics.atY(rowY).progress;
      const point = path.getPointAtLength(at * metrics.length);
      const left = point.x + 18;
      const top = i ? point.y - 8 : point.y - layout.heights[0] - 12;
      entry.style.left = left + 'px';
      entry.style.top = top + 'px';
      points.push({ x: point.x, y: point.y, progress: at });
      labels.push({ left, right: left + layout.contentWidths[i], top, bottom: top + layout.heights[i] });
    });
    return { points, labels };
  }

  function frameMobileStops(points, labels, width, anchor) {
    return points.map((point, i) => {
      const card = labels[i];
      const previous = labels[Math.max(0, i - 1)];
      const preferredOffset = anchor - point.x;
      const bothLeft = mobileCardInset - Math.min(card.left, previous.left);
      const bothRight = width - Math.max(card.right, previous.right);
      const sharedOffset = Math.max(bothLeft, Math.min(preferredOffset, bothRight));
      // If both cards cannot fit, give the newly revealed card priority.
      const offset = Math.min(width - card.right, Math.max(mobileCardInset - card.left, sharedOffset));
      return { progress: point.progress, offset };
    });
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

  function captureReadingPosition(useCached = true) {
    if (!animation || !milestoneReveals.length) return null;
    if (useCached && scrollCamera?.readingPosition) return scrollCamera.readingPosition;
    const progress = animation.progress();
    let index = 0;
    milestoneReveals.forEach((reveal, i) => {
      if (progress + .0001 >= reveal.at) index = i;
    });
    const start = milestoneReveals[index].at;
    const end = milestoneReveals[index + 1]?.at ?? 1;
    const fraction = Math.max(0, Math.min(1, (progress - start) / (end - start || 1)));
    const scroll = scrollTop();
    const atTop = scroll <= 1;
    const atBottom = scroll >= scrollLimit() - 2;
    return { index, fraction, atTop, atBottom };
  }

  function rebuild() {
    const width = track.clientWidth;
    const narrow = width < 720;
    const previousReadingPosition = captureReadingPosition();
    // The small viewport stays constant when a phone's address bar folds away.
    // Actual viewport/orientation changes still recalculate the geometry.
    const viewport = narrow && viewportMeasure ? Math.round(viewportMeasure.getBoundingClientRect().height) : window.innerHeight;
    const largeViewport = narrow && viewportMeasure ? Math.max(viewport, Math.round(parseFloat(getComputedStyle(viewportMeasure, '::after').height) || window.innerHeight)) : viewport;
    if (!width || !viewport) return;
    const scale = parseFloat(getComputedStyle(track).getPropertyValue('--career-layout-scale')) || 1;
    const nextSignature = [width, viewport, largeViewport, scale, reducedMotion.matches, touchDevice.matches, canAnimate].join(':');
    if (nextSignature === signature) return;
    signature = nextSignature;
    reset();
    setMobileEnding(false);
    // A native scroll area keeps touch gestures off the document viewport,
    // where Chrome moves its address bar and the entire pinned timeline.
    const useLocalScroll = Boolean(mobileScroller && narrow && canAnimate && touchDevice.matches && !reducedMotion.matches);
    scroller = useLocalScroll ? mobileScroller : window;
    document.documentElement.classList.toggle('career-local-scroll', useLocalScroll);
    updateDesktopSmoothing(narrow);
    track.classList.add('career-track--positioned');
    track.classList.toggle('career-track--narrow', narrow);
    track.classList.toggle('career-track--tight', narrow && width < 300);
    if (narrow) track.classList.add('career-track--compact');
    const mobileLayout = narrow ? measureMobileLabels(width) : null;
    // Leave a stable inset for the final card even when browser controls
    // reappear and native scrolling exposes the shorter ending viewport.
    const mobileTopInset = narrow ? Math.max(56, mobileLayout.heights[0] + 16, largeViewport - viewport + 24) : 0;
    const minimumHeight = narrow ? Math.ceil(mobileLayout.minimumSpan / .95 + mobileTopInset + 24) : 0;

    // Calibrate using actual SVG arc length, rather than only its height.
    // Desktop fits >=40% even with the header and title present. On phones,
    // preserve enough vertical space for the measured cards to stay separate.
    const viewportTop = useLocalScroll ? mobileScroller.getBoundingClientRect().top : 0;
    const documentTop = track.getBoundingClientRect().top - viewportTop + scrollTop();
    const available = Math.max(120, viewport - documentTop - 16);
    // On wide screens the reference gives the curve more room horizontally.
    const desktopAspect = desktopCurveAspect / (1 + (scale - 1) * 2 / 3);
    let height = Math.round(available * 2 * curveExtent);
    if (narrow) height = Math.max(height, minimumHeight);
    if (!narrow) height = Math.min(height, Math.round(width * desktopAspect * curveExtent + 80 * scale));
    let metrics, visibleFraction;
    for (let i = 0; i < 9; i++) {
      metrics = drawCurve(width, height, narrow, scale, desktopAspect, mobileTopInset);
      visibleFraction = minimumVisibleFraction(metrics, height, available);
      if (visibleFraction >= .42 || height === minimumHeight) break;
      height = Math.max(minimumHeight, Math.round(height * .9));
    }
    const compact = narrow || height < 1100 * scale;
    track.classList.toggle('career-track--compact', compact);
    track.dataset.visibleCurveFraction = visibleFraction.toFixed(3);
    track.dataset.curveHeight = String(height);

    const mobilePlacement = narrow ? placeMobileLabels(metrics, mobileLayout) : null;
    const points = mobilePlacement ? mobilePlacement.points : entries.map(entry => {
      const targetY = metrics.y(Number(entry.dataset.curveAt));
      const at = metrics.atY(targetY).progress;
      const exact = path.getPointAtLength(at * metrics.length);
      return { x: exact.x, y: exact.y, progress: at };
    });
    const slowMobile = narrow && canAnimate && !reducedMotion.matches;
    track.style.setProperty('--career-first-stop-y', points[0].y + 'px');
    // Halve the required gesture distance on touch devices, preserving the
    // existing desktop speed and the slower second half of the journey.
    const touchScrollFactor = touchDevice.matches ? .5 : 1;
    const scrollMultiplier = (slowMobile ? 6 : 2) * touchScrollFactor;
    const trackLeft = track.getBoundingClientRect().left;
    const cameraAnchor = slowMobile ? trackLeft + mobileLayout.anchor : 0;
    const labels = mobilePlacement ? mobilePlacement.labels : placeLabels(points, metrics, width, narrow, scale, cameraAnchor, trackLeft);
    if (narrow && !slowMobile) {
      entries.forEach((entry, i) => {
        entry.style.left = mobileLayout.cardLeft + 'px';
        labels[i].left = mobileLayout.cardLeft;
        labels[i].right = width;
      });
    }
    stops.replaceChildren(...points.map((point, i) => {
      const circle = element('circle', { cx: point.x, cy: point.y, r: narrow ? 6 : 8 * scale, class: 'career-stop' });
      circle.addEventListener('click', () => entries[i].querySelector('.career-checkpoint').click());
      return circle;
    }));
    pointer.setAttribute('r', String(narrow ? 7 : 7 * scale));
    pointer.setAttribute('cx', '0');
    pointer.setAttribute('cy', '0');
    const contentHeight = Math.ceil(Math.max(height, ...labels.map(box => box.bottom)) + 24);
    canvas.style.height = contentHeight + 'px';
    track.style.height = contentHeight + 'px';
    track.dataset.scrollMultiplier = String(scrollMultiplier);
    track.dataset.lateScrollMultiplier = String(scrollMultiplier * 2);
    track.dataset.touchScrollFactor = String(touchScrollFactor);
    delete track.dataset.cameraAnchor;

    if (!canAnimate || reducedMotion.matches) return;
    const revealLine = Math.round(viewport * (narrow ? .65 : .5));
    const normalStart = Math.max(0, documentTop - revealLine);
    const tailHeight = (narrow ? (contact?.offsetHeight || 0) + 16 : 0) +
      (document.querySelector('.career-outro')?.offsetHeight || 0) +
      (document.querySelector('.portfolio-footer')?.offsetHeight || 0);
    const maximumEnd = documentTop + contentHeight + tailHeight - viewport - 1;
    if (maximumEnd <= normalStart) {
      gsap.set(path, { drawSVG: '100%' });
      gsap.set(texts, { autoAlpha: 1 });
      return;
    }
    const normalEnd = Math.min(maximumEnd, Math.max(documentTop + height - revealLine, documentTop + contentHeight - viewport));
    const normalDistance = Math.max(1, normalEnd - normalStart);
    const endAt = slowMobile ? points[points.length - 1].progress : 1;
    const endWeight = journeyDistance(endAt);
    const scrollDistance = normalDistance * scrollMultiplier * endWeight;
    const end = normalStart + scrollDistance;
    let stageHeight = viewport;
    let mobileStops;
    let followY = 0;
    let minimumY = 0;
    if (slowMobile) {
      setMobileEnding(true);
      const lastPoint = points[points.length - 1];
      const endingTop = Math.max(labels[labels.length - 1].bottom, metrics.y(1)) + 28;
      ending.style.width = width + 'px';
      ending.style.top = endingTop + 'px';
      const endingBottom = endingTop + ending.offsetHeight;
      stageHeight = Math.max(largeViewport, points[0].y + endingBottom - lastPoint.y);
      minimumY = Math.min(0, stageHeight - endingBottom);
      // On mobile the footer moves into the scene, so clip the artwork above it.
      if (backdrops && footer) {
        const footerSpace = Math.ceil(footer.getBoundingClientRect().height + Math.max(0, stageHeight - endingBottom));
        backdrops.style.setProperty('--career-backdrop-footer-space', footerSpace + 'px');
      }
      followY = Math.min(viewport * .55, lastPoint.y + minimumY);
      mobileStops = frameMobileStops(points, labels, width, mobileLayout.anchor);
    }
    // Mobile unpins exactly at the final node. Any remaining native scroll
    // is the actual ending viewport, including space under browser controls.
    const outerHeight = slowMobile ? end - documentTop + stageHeight : contentHeight + scrollDistance - normalDistance;
    track.dataset.normalScrollDistance = normalDistance.toFixed(3);
    track.dataset.scrollDistance = scrollDistance.toFixed(3);
    track.dataset.scrollStart = normalStart.toFixed(3);
    track.dataset.scrollEnd = end.toFixed(3);
    track.classList.add('career-track--slow');
    track.style.setProperty('--career-stage-height', stageHeight + 'px');
    track.style.height = outerHeight + 'px';
    if (slowMobile) track.dataset.cameraAnchor = cameraAnchor.toFixed(3);
    scrollCamera = { documentTop, viewport, width, narrow, start: normalStart, end, outerHeight, normalDistance, anchor: cameraAnchor, length: metrics.length, lastStopAt: points[points.length - 1].progress, mobileStops, followY, minimumY };
    animation = gsap.timeline({
      paused: true,
      defaults: { ease: 'none' },
      onUpdate: () => { updateScrollCamera(); updateMilestoneReveals(); }
    });
    animation.fromTo(path, { drawSVG: 0 }, { drawSVG: '100%', duration: 1 }, 0);
    animation.fromTo(pointer, { autoAlpha: 0 }, { autoAlpha: 1, duration: .004 }, 0);
    if (!narrow) {
      animation.to(pointer, {
        duration: 1,
        motionPath: { path, align: path, alignOrigin: [.5, .5] }
      }, 0);
    }
    points.forEach((point, i) => {
      const entry = entries[i];
      const at = point.progress;
      const reveal = gsap.timeline({ paused: true });
      if (narrow) {
        reveal.fromTo(entry.querySelector('.career-year'), {
          opacity: .35, x: -8
        }, { opacity: 1, x: 0, duration: .4, ease: 'power2.out' }, 0);
      }
      // Desktop grid milestones can use display: contents for their copy.
      // Animate the entry itself so its text and thumbnails reveal together.
      const content = narrow ? entry.querySelector('.career-copy') : entry;
      reveal.fromTo(content, {
        opacity: 0, x: narrow ? 0 : -24, y: 8
      }, { opacity: 1, x: 0, y: 0, duration: narrow ? .3 : .6, ease: 'power3.out' }, narrow ? 0 : .06);
      reveal.fromTo(stops.children[i], {
        attr: { r: narrow ? 2.5 : 3 * scale }, autoAlpha: narrow ? .3 : .4
      }, { attr: { r: narrow ? 6.5 : 8 * scale }, autoAlpha: 1, duration: .5, ease: 'back.out(2)' }, 0);
      const reached = at === 0;
      if (reached) reveal.progress(1);
      entry.classList.toggle('career-milestone--awaiting-reveal', !reached);
      // A small reverse gesture or toolbar expansion at the bottom should
      // not blink the final card and ending controls on and off.
      const lastMobile = slowMobile && i === points.length - 1;
      const reverseMargin = lastMobile ? Math.min((journeyDistance(at) - journeyDistance(points[i - 1].progress)) * normalDistance * scrollMultiplier / 3, Math.max(48, largeViewport - viewport + 24)) : 0;
      const hideAt = lastMobile ? journeyProgress(Math.max(0, journeyDistance(at) - reverseMargin / (normalDistance * scrollMultiplier)) / 1.5) : at;
      milestoneReveals.push({ entry, at, hideAt, animation: reveal, reached });
    });
    const playhead = { progress: 0 };
    scrollTween = gsap.to(playhead, {
      progress: endAt,
      duration: 1,
      ease: slowMobile ? distance => distance >= 1 ? 1 : journeyProgress(distance * endWeight / 1.5) / endAt : journeyProgress,
      onUpdate: () => animation.progress(playhead.progress),
      scrollTrigger: {
        id: 'artur-career-timeline',
        scroller,
        trigger: track,
        start: normalStart,
        end,
        // Native touch/momentum scrolling already provides smooth motion.
        // Keep the camera current when a gesture reverses or reaches the top.
        scrub: narrow ? true : smoother ? true : .8,
        onUpdate: updateScrollCamera
      }
    });
    track.dataset.timelineState = 'animated';
    if (smoother) ScrollTrigger.refresh();
    else scrollTween.scrollTrigger.refresh();
    if (previousReadingPosition) {
      const { index, fraction, atTop, atBottom } = previousReadingPosition;
      const start = points[index].progress;
      const end = points[index + 1]?.progress ?? 1;
      const restoredDistance = journeyDistance(Math.min(endAt, start + (end - start) * fraction)) / endWeight;
      const maximumScroll = scrollLimit();
      const target = atTop ? 0 : atBottom ? maximumScroll : Math.min(maximumScroll, normalStart + restoredDistance * scrollDistance);
      // Update ScrollSmoother's visual position as well as native scrolling.
      // Otherwise entering the wide layout visibly eases from the old offset.
      if (smoother) smoother.scrollTop(target);
      else scroller.scrollTo(0, target);
      ScrollTrigger.update();
    }
    scrollTween.progress(scrollTween.scrollTrigger.progress);
    updateScrollCamera();
    updateMilestoneReveals();
  }

  function scheduleRebuild() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => window.requestAnimationFrame(rebuild), 120);
  }

  function setupScrollCue() {
    const cue = track.querySelector('.career-scroll-cue');
    if (!cue) return;
    if (scrollTop() > 0) {
      cue.hidden = true;
      return;
    }
    function dismissOnScroll() {
      if (scrollTop() <= 0) return;
      cue.classList.add('career-scroll-cue--dismissed');
      window.removeEventListener('scroll', dismissOnScroll);
      mobileScroller?.removeEventListener('scroll', dismissOnScroll);
    }
    window.addEventListener('scroll', dismissOnScroll, { passive: true });
    mobileScroller?.addEventListener('scroll', dismissOnScroll, { passive: true });
  }

  // This script runs first. Draw the curve before the deferred GSAP files
  // finish, then add the motion once those files have executed.
  function initializeTimeline() {
    function start() {
      if (initialized) return;
      initialized = true;
      enableAnimation();
      if (!canAnimate) {
        signature = '';
        rebuild();
      }
      document.dispatchEvent(new Event('career-layout-ready'));
    }
    // Measure the actual font before revealing the scene, with a bounded
    // wait so a slow font cannot keep the timeline hidden indefinitely.
    const deadline = window.setTimeout(start, 1800);
    (document.fonts?.ready || Promise.resolve()).then(() => {
      window.clearTimeout(deadline);
      start();
    }, start);
  }
  if (document.readyState === 'complete') initializeTimeline();
  else document.addEventListener('DOMContentLoaded', initializeTimeline, { once: true });
  setupScrollCue();
  prioritizePreviews(0);
  rebuild();
  window.addEventListener('resize', scheduleRebuild, { passive: true });
  window.addEventListener('scroll', updateScrollCamera, { passive: true });
  mobileScroller?.addEventListener('scroll', updateScrollCamera, { passive: true });
  reducedMotion.addEventListener('change', scheduleRebuild);
  touchDevice.addEventListener('change', scheduleRebuild);
  if (window.ResizeObserver) new ResizeObserver(scheduleRebuild).observe(track);
  document.fonts?.addEventListener('loadingdone', () => {
    if (!initialized) return;
    signature = '';
    scheduleRebuild();
  });
})();

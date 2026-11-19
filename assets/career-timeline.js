(() => {
  'use strict';

  const track = document.querySelector('[data-career-timeline]');
  if (!track) return;

  // ScrollTrigger + DrawSVG + MotionPath, following the supplied snorklTV
  // tutorial. This second layout follows the user's broad S-curve sketch.
  const svg = track.querySelector('svg');
  const rail = track.querySelector('.career-rail');
  const path = track.querySelector('[data-career-path]');
  const background = track.querySelector('[data-career-background]');
  const pointer = track.querySelector('[data-career-pointer]');
  const guides = track.querySelector('[data-career-guides]');
  const stops = track.querySelector('[data-career-stops]');
  const entries = [...track.querySelectorAll('.career-milestone')];
  const texts = entries.flatMap(entry => [...entry.querySelectorAll('.career-year, .career-copy')]);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const dialog = document.querySelector('#career-details');
  const dialogBody = dialog.querySelector('[data-career-details-body]');
  const ns = 'http://www.w3.org/2000/svg';
  const canAnimate = Boolean(window.gsap && window.ScrollTrigger && window.DrawSVGPlugin && window.MotionPathPlugin);
  let animation;
  let signature = '';
  let resizeTimer;

  if (canAnimate) gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, MotionPathPlugin);

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
  }

  entries.forEach(entry => entry.querySelector('button').addEventListener('click', () => showDetails(entry)));
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });

  function reset() {
    if (animation) {
      animation.scrollTrigger.kill();
      animation.kill();
      animation = null;
    }
    if (canAnimate) gsap.set([...texts, pointer, path, ...stops.children], { clearProps: 'all' });
    track.dataset.timelineState = 'static';
  }

  function drawCurve(width, height, narrow, scale) {
    const span = narrow ? Math.min(132, width * .34) : width;
    const offset = narrow ? 8 : 0;
    const x = value => offset + value * span;
    const y = value => 56 * scale + value * (height - 80 * scale);
    const d = 'M ' + x(.10) + ' ' + y(0) +
      ' C ' + x(.51) + ' ' + y(.015) + ', ' + x(.40) + ' ' + y(.12) + ', ' + x(.29) + ' ' + y(.23) +
      ' C ' + x(.11) + ' ' + y(.40) + ', ' + x(.12) + ' ' + y(.47) + ', ' + x(.26) + ' ' + y(.58) +
      ' C ' + x(.39) + ' ' + y(.70) + ', ' + x(.65) + ' ' + y(.81) + ', ' + x(.74) + ' ' + y(.91) +
      ' C ' + x(.79) + ' ' + y(.96) + ', ' + x(.77) + ' ' + y(.99) + ', ' + x(.76) + ' ' + y(1);
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
    return { length, atY, y };
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

  function placeLabels(points, metrics, width, narrow, scale) {
    const placed = [];
    entries.forEach((entry, i) => {
      const point = points[i];
      const above = entry.dataset.curveSide === 'above';
      const side = above ? 'above' : narrow ? 'right' : entry.dataset.curveSide;
      const preferredWidth = narrow ? Math.min(240, width - 24) : Math.min(300 * scale, width * .30);
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
          left = Math.max(0, Math.min(width - preferredWidth, point.x - 32 * scale));
        } else if (side === 'right') {
          left = maxX + 18 * scale;
          labelWidth = Math.max(60, Math.min(preferredWidth, width - left));
        } else {
          labelWidth = Math.max(60, Math.min(preferredWidth, minX - 18 * scale));
          left = Math.max(0, minX - 18 * scale - labelWidth);
        }
        entry.style.width = labelWidth + 'px';
        labelHeight = entry.offsetHeight;
        let nextTop = top;
        for (const other of placed) {
          const horizontalOverlap = left < other.right + 8 * scale && left + labelWidth > other.left - 8 * scale;
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
    const viewport = window.innerHeight;
    if (!width || !viewport) return;
    const narrow = width < 720;
    const scale = parseFloat(getComputedStyle(track).getPropertyValue('--career-layout-scale')) || 1;
    const nextSignature = [width, viewport, scale, reducedMotion.matches].join(':');
    if (nextSignature === signature) return;
    signature = nextSignature;
    reset();
    track.classList.add('career-track--positioned');
    track.classList.toggle('career-track--narrow', narrow);

    // Calibrate using actual SVG arc length, rather than only its height.
    // Even the first viewport (with the header and title present) fits >=40%.
    const documentTop = track.getBoundingClientRect().top + window.scrollY;
    const available = Math.max(120, viewport - documentTop - 16);
    let height = Math.round(available * 2);
    let metrics, visibleFraction;
    for (let i = 0; i < 9; i++) {
      metrics = drawCurve(width, height, narrow, scale);
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
    const labels = placeLabels(points, metrics, width, narrow, scale);
    guides.replaceChildren(...points.flatMap((point, i) => {
      const box = labels[i];
      if (box.side === 'above') return [];
      const right = box.side === 'right';
      const endX = right ? box.left - 6 * scale : box.right + 6 * scale;
      const endY = box.top + 9 * scale;
      const startX = point.x + (right ? 6 * scale : -6 * scale);
      const middle = (startX + endX) / 2;
      return [element('polyline', {
        points: startX + ',' + point.y + ' ' + middle + ',' + point.y + ' ' + endX + ',' + endY,
        class: 'career-guide'
      })];
    }));
    stops.replaceChildren(...points.map((point, i) => {
      const circle = element('circle', { cx: point.x, cy: point.y, r: narrow ? 6 : 8 * scale, class: 'career-stop' });
      circle.addEventListener('click', () => showDetails(entries[i]));
      return circle;
    }));
    pointer.setAttribute('r', String(narrow ? 5 : 7 * scale));
    track.style.height = Math.ceil(Math.max(height, ...labels.map(box => box.bottom)) + 24) + 'px';

    if (!canAnimate || reducedMotion.matches) return;
    animation = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        id: 'artur-career-timeline',
        trigger: rail,
        start: 'top center',
        end: 'bottom center',
        scrub: true
      }
    });
    animation.fromTo(path, { drawSVG: 0 }, { drawSVG: '100%', duration: 1 }, 0);
    animation.fromTo(pointer, { autoAlpha: 0 }, { autoAlpha: 1, duration: .004 }, 0);
    animation.to(pointer, {
      duration: 1,
      motionPath: { path, align: path, alignOrigin: [.5, .5] }
    }, 0);
    points.forEach((point, i) => {
      const at = point.progress;
      const duration = Math.min(.025, (1 - at) * .8);
      animation.fromTo(stops.children[i], { attr: { r: 3 * scale }, autoAlpha: .4 }, {
        attr: { r: narrow ? 6 : 8 * scale }, autoAlpha: 1, duration,
        ease: 'back.out(2.5)'
      }, at);
      animation.fromTo(entries[i].querySelectorAll('.career-year, .career-copy'), {
        opacity: .8
      }, { opacity: 1, duration, ease: 'power2.out' }, at);
    });
    track.dataset.timelineState = 'animated';
    animation.scrollTrigger.refresh();
    animation.progress(animation.scrollTrigger.progress);
  }

  function scheduleRebuild() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => window.requestAnimationFrame(rebuild), 120);
  }
  rebuild();
  window.addEventListener('resize', scheduleRebuild, { passive: true });
  reducedMotion.addEventListener('change', scheduleRebuild);
  if (window.ResizeObserver) new ResizeObserver(scheduleRebuild).observe(track);
  if (document.fonts) document.fonts.ready.then(() => { signature = ''; scheduleRebuild(); });
})();

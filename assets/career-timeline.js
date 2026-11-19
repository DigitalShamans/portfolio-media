(() => {
  'use strict';

  const track = document.querySelector('[data-career-timeline]');
  if (!track) return;

  // Pattern studied in snorklTV's Scroll-Driven SVG Path Follower:
  // https://www.youtube.com/watch?v=ersN5fk8py0
  // https://codepen.io/snorkltv/pen/KKmZYGy
  // One scrubbed timeline drives DrawSVG, MotionPath, and milestone reveals.
  const svg = track.querySelector('svg');
  const rail = track.querySelector('.career-rail');
  const path = track.querySelector('[data-career-path]');
  const pointer = track.querySelector('[data-career-pointer]');
  const guides = track.querySelector('[data-career-guides]');
  const stops = track.querySelector('[data-career-stops]');
  const entries = [...track.querySelectorAll('.career-milestone')];
  const texts = entries.flatMap(entry => [...entry.querySelectorAll('.career-year, .career-copy')]);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const ns = 'http://www.w3.org/2000/svg';
  const bends = [.68, .32, .79, .43, .74, .30, .72, .39, .80, .28, .70, .46];
  const canAnimate = Boolean(window.gsap && window.ScrollTrigger && window.DrawSVGPlugin && window.MotionPathPlugin);
  let animation;
  let signature = '';
  let resizeTimer;

  if (canAnimate) {
    gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, MotionPathPlugin);
  }

  function element(name, attributes) {
    const node = document.createElementNS(ns, name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    return node;
  }

  function reset() {
    if (animation) {
      animation.scrollTrigger.kill();
      animation.kill();
      animation = null;
    }
    if (canAnimate) {
      gsap.set([...texts, pointer, path, ...stops.children], { clearProps: 'all' });
    }
    track.dataset.timelineState = 'static';
  }

  // Y is strictly increasing along this path, so a binary search gives the
  // actual path-length fraction at each milestone, even when rows wrap.
  function progressAtY(y, length) {
    let low = 0;
    let high = length;
    for (let i = 0; i < 22; i++) {
      const middle = (low + high) / 2;
      if (path.getPointAtLength(middle).y < y) low = middle;
      else high = middle;
    }
    return (low + high) / (2 * length);
  }

  function rebuild() {
    const width = rail.clientWidth;
    const height = track.clientHeight;
    if (!width || !height) return;

    // offset* measurements ignore GSAP's temporary reveal transforms.
    const points = entries.map((entry, i) => {
      const year = entry.querySelector('.career-year');
      return {
        x: width * bends[i % bends.length],
        y: entry.offsetTop + year.offsetTop + year.offsetHeight + 14
      };
    });
    const nextSignature = JSON.stringify([width, height, points, reducedMotion.matches]);
    if (nextSignature === signature) return;
    signature = nextSignature;
    reset();

    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const route = [{ x: width * .16, y: 0 }, ...points, { x: width * .65, y: height - 10 }];
    let d = `M ${route[0].x} ${route[0].y}`;
    for (let i = 1; i < route.length; i++) {
      const from = route[i - 1];
      const to = route[i];
      const middleY = (from.y + to.y) / 2;
      d += ` C ${from.x} ${middleY}, ${to.x} ${middleY}, ${to.x} ${to.y}`;
    }
    path.setAttribute('d', d);
    guides.replaceChildren(...points.map(point => element('line', {
      x1: 0, y1: point.y, x2: width, y2: point.y, class: 'career-guide'
    })));
    stops.replaceChildren(...points.map(point => element('circle', {
      cx: point.x, cy: point.y, r: width < 120 ? 8 : 12, class: 'career-stop'
    })));
    pointer.setAttribute('r', width < 120 ? '6' : '8');

    // With reduced motion or unavailable libraries the complete career stays
    // readable, with a static path. No content depends on GSAP to exist.
    if (!canAnimate || reducedMotion.matches) return;

    const length = path.getTotalLength();
    animation = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        id: 'artur-career-timeline',
        trigger: track,
        start: 'top center',
        end: 'bottom center',
        scrub: true
      }
    });
    animation.fromTo(path, { drawSVG: 0 }, { drawSVG: '100%', duration: 1 }, 0);
    animation.fromTo(pointer, { autoAlpha: 0 }, {
      autoAlpha: 1,
      duration: .005
    }, 0);
    animation.to(pointer, {
      duration: 1,
      motionPath: { path, align: path, alignOrigin: [.5, .5] }
    }, 0);

    points.forEach((point, i) => {
      const at = progressAtY(point.y, length);
      // Animate radius around the fixed SVG centre. This also avoids origin
      // shifts when a zero-scale circle is measured during initialization.
      animation.fromTo(stops.children[i], { attr: { r: 0 }, autoAlpha: 0 }, {
        attr: { r: width < 120 ? 8 : 12 },
        autoAlpha: 1,
        duration: .025,
        ease: 'back.out(2.5)'
      }, at);
      animation.fromTo(entries[i].querySelectorAll('.career-year, .career-copy'), {
        opacity: 0, y: 10
      }, { opacity: 1, y: 0, duration: .025, ease: 'power2.out' }, at);
    });
    track.dataset.timelineState = 'animated';
    // MotionPath alignment is calculated on creation, so rebuild after layout
    // changes instead of refreshing a tween with stale alignment geometry.
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
  if (document.fonts) document.fonts.ready.then(scheduleRebuild);
})();

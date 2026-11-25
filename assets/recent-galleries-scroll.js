'use strict';

(() => {
  const region = document.querySelector('.recent-galleries');
  if (!region) return;

  const page = document.scrollingElement;
  const portfolio = document.querySelector('#full-portfolio[data-scroll-framing]');
  const header = portfolio && document.querySelector('.portfolio-page > .site-header');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const responseTime = 72;
  let motion;
  let scheduled = false;

  function readPosition() {
    return { inner: region.scrollTop, page: window.scrollY };
  }

  function samePosition(a, b) {
    return a.inner === b.inner && a.page === b.page;
  }

  function applyPosition(next, current) {
    if (next.inner !== current.inner) region.scrollTop = next.inner;
    if (next.page !== current.page) {
      window.scrollTo({ top: next.page, behavior: 'instant' });
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(advance);
  }

  function advance(time) {
    scheduled = false;
    if (!motion) return;

    const current = readPosition();
    if (!samePosition(current, motion.applied)) {
      // A native scroll took over, for example a scrollbar drag or keyboard input.
      motion = null;
      return;
    }

    const innerLeft = motion.target.inner - motion.position.inner;
    const pageLeft = motion.target.page - motion.position.page;
    const remaining = innerLeft + pageLeft;
    if (Math.abs(remaining) <= .5 || reducedMotion.matches) {
      // Round the last framed step so a small trackpad tick still moves a CSS pixel.
      const target = motion.framing ? { ...motion.target, page: Math.round(motion.target.page) } : motion.target;
      applyPosition(target, current);
      motion = null;
      return;
    }

    const elapsed = Math.max(0, Math.min(time - motion.time, 32));
    const travel = remaining * (1 - Math.exp(-elapsed / responseTime));
    const inside = Math.sign(travel) * Math.min(Math.abs(travel), Math.abs(innerLeft));
    // Advance along one path. The page starts moving as soon as the list reaches its edge.
    motion.position.inner += inside;
    motion.position.page += travel - inside;
    applyPosition(motion.position, current);
    motion.applied = readPosition();
    motion.time = time;
    schedule();
  }

  function clampScroll(position, limit) {
    return Math.max(0, Math.min(limit, position));
  }

  function framedPageTarget(from, delta, current, limit, unadjusted) {
    if (!header || reducedMotion.matches || !delta) return unadjusted;

    const headerHeight = header.getBoundingClientRect().height;
    const usableHeight = page.clientHeight - headerHeight;
    if (usableHeight <= 0) return unadjusted;
    const rect = portfolio.getBoundingClientRect();
    if (rect.height <= 0) return unadjusted;

    // These are the two positions where a grid edge meets the visible area.
    // Between them either the whole grid fits or it fills the available height.
    const topEdge = current + rect.top - headerHeight;
    const bottomEdge = current + rect.bottom - page.clientHeight;
    const first = Math.min(topEdge, bottomEdge);
    const last = Math.max(topEdge, bottomEdge);
    const ramp = Math.min(160, usableHeight * .18);
    let low = Math.min(from, unadjusted);
    let high = Math.max(from, unadjusted);
    if (high <= first - ramp || low >= last + ramp) return unadjusted;

    // Integrate the two smoothstep ramps. A pixel in the fully framed range
    // takes 4/3 as much wheel input, including when a large step crosses it.
    function rampArea(distance) {
      if (distance <= 0) return 0;
      if (distance >= ramp) return distance - ramp / 2;
      const progress = distance / ramp;
      return ramp * progress ** 3 * (1 - progress / 2);
    }
    function wheelPosition(top) {
      return top + (rampArea(top - first + ramp) - rampArea(top - last)) / 3;
    }

    const target = wheelPosition(from) + delta;
    if (target >= wheelPosition(limit)) return limit;
    if (target <= wheelPosition(0)) return 0;
    for (let iteration = 0; iteration < 18 && high - low > .05; iteration++) {
      const middle = (low + high) / 2;
      if (wheelPosition(middle) < target) low = middle;
      else high = middle;
    }
    return (low + high) / 2;
  }

  function hasIndependentScroller(target) {
    for (let element = target; element && element !== document.body && element !== page;
      element = element.parentElement) {
      if (element.scrollHeight > element.clientHeight + 1 &&
          /^(auto|scroll)$/.test(window.getComputedStyle(element).overflowY)) return true;
    }
    return false;
  }

  function handleWheel(event, inRecent) {
    if (!event.cancelable || event.defaultPrevented || event.ctrlKey || event.metaKey) return;
    const { deltaMode, deltaX, deltaY } = event;
    if (!deltaY || Math.abs(deltaX) >= Math.abs(deltaY)) return;
    if (!inRecent && (reducedMotion.matches || event.shiftKey || event.altKey)) return;

    const innerLimit = Math.max(0, region.scrollHeight - region.clientHeight);
    if (inRecent && innerLimit < 1) return;
    const viewportHeight = inRecent ? region.clientHeight : page.clientHeight;
    const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? viewportHeight : 1;
    const delta = deltaY * unit;
    if (!Number.isFinite(delta)) return;

    const current = readPosition();
    const direction = Math.sign(delta);
    const continues = !reducedMotion.matches && motion?.direction === direction
      && samePosition(current, motion.applied);
    const from = continues ? motion.target : current;
    const inner = inRecent ? clampScroll(from.inner + delta, innerLimit) : from.inner;
    const remainder = delta - (inner - from.inner);
    const pageLimit = Math.max(0, page.scrollHeight - page.clientHeight);
    const unadjusted = clampScroll(from.page + remainder, pageLimit);
    const target = { inner, page: framedPageTarget(from.page, remainder, current.page, pageLimit, unadjusted) };
    const framing = Math.abs(unadjusted - target.page) > .1;
    if (!inRecent) {
      if ((!framing || Math.abs(delta) < 1) && !(continues && motion.framing)) return;
      if (hasIndependentScroller(event.target)) return;
    }

    if (samePosition(current, target)) {
      motion = null;
      return;
    }

    event.preventDefault();
    if (reducedMotion.matches) {
      motion = null;
      applyPosition(target, current);
      return;
    }

    if (continues) {
      motion.target = target;
      motion.framing ||= framing;
    } else {
      motion = {
        target, direction, framing, applied: current, position: { ...current },
        time: window.performance.now()
      };
    }
    schedule();
  }

  region.addEventListener('wheel', event => handleWheel(event, true), { passive: false });
  if (header) document.addEventListener('wheel', event => handleWheel(event, false), { passive: false });
})();

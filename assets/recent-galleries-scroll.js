'use strict';

(() => {
  const region = document.querySelector('.recent-galleries');
  if (!region) return;

  const page = document.scrollingElement;
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
      applyPosition(motion.target, current);
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

  region.addEventListener('wheel', event => {
    if (!event.cancelable || event.defaultPrevented || event.ctrlKey || event.metaKey) return;
    const { deltaMode, deltaX, deltaY } = event;
    if (!deltaY || Math.abs(deltaX) >= Math.abs(deltaY)) return;

    const innerLimit = Math.max(0, region.scrollHeight - region.clientHeight);
    if (innerLimit < 1) return;
    const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? region.clientHeight : 1;
    const delta = deltaY * unit;
    if (!Number.isFinite(delta)) return;

    const current = readPosition();
    const direction = Math.sign(delta);
    const continues = !reducedMotion.matches && motion?.direction === direction
      && samePosition(current, motion.applied);
    const from = continues ? motion.target : current;
    const inner = Math.max(0, Math.min(innerLimit, from.inner + delta));
    const remainder = delta - (inner - from.inner);
    const pageLimit = Math.max(0, page.scrollHeight - page.clientHeight);
    const target = { inner, page: Math.max(0, Math.min(pageLimit, from.page + remainder)) };

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
    } else {
      motion = {
        target, direction, applied: current, position: { ...current },
        time: window.performance.now()
      };
    }
    schedule();
  }, { passive: false });
})();

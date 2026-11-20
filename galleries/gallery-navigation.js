(function () {
  'use strict';

  const navigation = document.querySelector('.gallery-navigation');
  if (!navigation || navigator.maxTouchPoints < 1) return;
  const fullPortfolio = navigation.dataset?.galleryLoop === 'full';

  const excluded = '.shot, .shot-entry, .comparison-indicator, picture, img, video, audio, canvas, iframe, svg, '
    + 'a, button, input, textarea, select, label, summary, '
    + '[contenteditable]:not([contenteditable="false"]), [role="button"], [role="link"], [role="slider"]';
  const editables = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
  const minimumSwipe = 48;
  const feedbackDuration = 180;
  const feedback = document.createElement('div');
  feedback.className = 'gallery-swipe-feedback';
  feedback.setAttribute('aria-hidden', 'true');
  feedback.hidden = true;
  const arrow = document.createElement('span');
  feedback.append(arrow);
  document.body.append(feedback);
  let gesture;
  let navigating = false;
  let navigationTimer;

  function unavailable() {
    return document.hidden || document.fullscreenElement || document.querySelector('dialog[open]')
      || Math.abs((window.visualViewport?.scale ?? 1) - 1) > .01
      || document.activeElement?.closest(editables)
      || window.getSelection?.()?.isCollapsed === false;
  }

  function hideFeedback() {
    feedback.hidden = true;
    feedback.classList.remove('is-visible', 'is-ready');
  }

  function reset() {
    gesture = undefined;
    if (!navigating) hideFeedback();
  }

  function cancel() {
    clearTimeout(navigationTimer);
    navigationTimer = undefined;
    navigating = false;
    reset();
  }

  function destination(direction) {
    const link = navigation.querySelector('.gallery-navigation__link--' + direction);
    if (!link) return;
    const url = new URL(link.href, window.location.href);
    const prefix = window.location.pathname.split('/galleries/')[0];
    const localPath = url.pathname.slice(prefix.length);
    if (url.origin !== window.location.origin || url.search || url.hash ||
        url.pathname.split('/galleries/')[0] !== prefix) return;
    if (fullPortfolio) {
      if (prefix === '/artur' && /^\/galleries\/(?!hb-)[a-z0-9-]+\/$/.test(localPath)) return url;
    } else if (/^\/galleries\/hb-[a-z0-9-]+\/$/.test(localPath)) return url;
  }

  function showFeedback(dx, ready = Math.abs(dx) >= minimumSwipe) {
    const direction = dx < 0 ? 'next' : 'previous';
    if (!destination(direction)) return;
    feedback.dataset.direction = direction;
    arrow.textContent = direction === 'next' ? '→' : '←';
    feedback.hidden = false;
    feedback.classList.add('is-visible');
    feedback.classList.toggle('is-ready', ready);
  }

  function start(event) {
    if (event.touches.length !== 1) { cancel(); return; }
    if (navigating) return;
    reset();
    if (unavailable() || !event.target?.closest || event.target.closest(excluded)) return;
    const touch = event.touches[0];
    // Non-interactive text containers include usable empty background too.
    // The start position need not be near either screen edge.
    gesture = {
      id: touch.identifier, x: touch.clientX, y: touch.clientY,
      started: Date.now(), scroll: window.scrollY, horizontal: false
    };
  }

  function move(event) {
    if (!gesture) return;
    if (event.touches.length !== 1 || unavailable() || Date.now() - gesture.started > 1600) {
      reset();
      return;
    }
    const touch = Array.from(event.touches).find(item => item.identifier === gesture.id);
    if (!touch) { reset(); return; }
    const dx = touch.clientX - gesture.x;
    const dy = touch.clientY - gesture.y;
    if (!gesture.horizontal) {
      if (Math.hypot(dx, dy) < 10) return;
      if (Math.abs(dx) >= 10 && Math.abs(dx) >= Math.abs(dy) * 1.3) gesture.horizontal = true;
      else if (Math.abs(dy) >= 10 && Math.abs(dy) >= Math.abs(dx)) { reset(); return; }
    }
    if (gesture?.horizontal) {
      // Non-cancelable Chrome events alone must not discard an intentional
      // swipe; native gesture cancellation still arrives as touchcancel.
      if (event.cancelable) event.preventDefault();
      showFeedback(dx);
    }
  }

  function finish(event) {
    const current = gesture;
    gesture = undefined;
    if (!current || navigating) return;
    if (event.touches.length || unavailable() || Date.now() - current.started > 1600) { reset(); return; }
    const touch = Array.from(event.changedTouches).find(item => item.identifier === current.id);
    if (!touch) { reset(); return; }
    const dx = touch.clientX - current.x;
    const dy = touch.clientY - current.y;
    // A quick flick may reach touchend without an intermediate touchmove.
    const horizontal = current.horizontal || (Math.abs(dx) >= Math.abs(dy) * 1.3
      && Math.abs(window.scrollY - current.scroll) <= 24);
    if (!horizontal || Math.abs(dx) < minimumSwipe || Math.abs(dy) > Math.abs(dx) * .85) { reset(); return; }
    const url = destination(dx < 0 ? 'next' : 'previous');
    if (!url) { reset(); return; }
    if (event.cancelable) event.preventDefault();
    navigating = true;
    showFeedback(dx, true);
    // Always let the arrow paint before leaving, including fast/cached pages.
    navigationTimer = setTimeout(() => {
      navigationTimer = undefined;
      if (unavailable()) { cancel(); return; }
      window.location.assign(url.href);
    }, feedbackDuration);
  }

  window.addEventListener('touchstart', start, { capture: true, passive: true });
  window.addEventListener('touchmove', move, { capture: true, passive: false });
  window.addEventListener('touchend', finish, { capture: true, passive: false });
  window.addEventListener('touchcancel', cancel, { capture: true, passive: true });
  window.addEventListener('orientationchange', cancel);
  window.addEventListener('pagehide', cancel);
  window.addEventListener('pageshow', cancel);
  document.addEventListener('visibilitychange', cancel);
}());

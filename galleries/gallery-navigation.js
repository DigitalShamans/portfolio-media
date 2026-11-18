(function () {
  'use strict';

  const navigation = document.querySelector('.gallery-navigation');
  if (!navigation || navigator.maxTouchPoints < 1) return;

  const backgroundTags = new Set(['HTML', 'BODY', 'MAIN', 'SECTION', 'HEADER', 'FOOTER', 'NAV', 'DIV']);
  const excluded = '.shot, .shot-entry, .comparison-indicator, picture, img, video, audio, canvas, iframe, svg, '
    + 'a, button, input, textarea, select, label, summary, '
    + '[contenteditable]:not([contenteditable="false"]), [role="button"], [role="link"], [role="slider"]';
  const editables = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
  let gesture;
  let navigating = false;

  function blocked() {
    return navigating || document.hidden || document.fullscreenElement
      || document.querySelector('dialog[open]')
      || Math.abs((window.visualViewport?.scale ?? 1) - 1) > .01
      || document.activeElement?.closest(editables)
      || window.getSelection?.()?.isCollapsed === false;
  }

  function reset() { gesture = undefined; }

  function start(event) {
    reset();
    if (event.touches.length !== 1 || blocked()) return;
    const target = event.target;
    if (!backgroundTags.has(target.tagName) || target.closest(excluded)) return;
    const touch = event.touches[0];
    const width = document.documentElement.clientWidth;
    // Keep the browser/OS back and forward gesture edges native.
    if (touch.clientX <= 20 || touch.clientX >= width - 20) return;
    gesture = {
      id: touch.identifier, x: touch.clientX, y: touch.clientY,
      started: Date.now(), scroll: window.scrollY, axis: null,
      threshold: Math.max(64, Math.min(120, width * .18))
    };
  }

  function move(event) {
    if (!gesture) return;
    if (event.touches.length !== 1 || blocked() || Date.now() - gesture.started > 1200) {
      reset();
      return;
    }
    const touch = Array.from(event.touches).find(item => item.identifier === gesture.id);
    if (!touch) { reset(); return; }
    const dx = Math.abs(touch.clientX - gesture.x);
    const dy = Math.abs(touch.clientY - gesture.y);
    if (!gesture.axis) {
      if (Math.hypot(dx, dy) < 12) return;
      if (dx >= 12 && dx >= dy * 1.6) gesture.axis = 'horizontal';
      else if (dy >= 12 && dy >= dx) { reset(); return; }
    }
    if (gesture?.axis === 'horizontal') {
      if (event.cancelable) event.preventDefault();
      else reset();
    }
  }

  function finish(event) {
    const current = gesture;
    reset();
    if (!current || event.touches.length || blocked() || Date.now() - current.started > 1200) return;
    const touch = Array.from(event.changedTouches).find(item => item.identifier === current.id);
    if (!touch) return;
    const dx = touch.clientX - current.x;
    const dy = touch.clientY - current.y;
    if (current.axis !== 'horizontal' || Math.abs(dx) < current.threshold
        || Math.abs(dx) < Math.abs(dy) * 1.6 || Math.abs(window.scrollY - current.scroll) > 8) return;
    const direction = dx < 0 ? 'next' : 'previous';
    const link = navigation.querySelector('.gallery-navigation__link--' + direction);
    if (!link) return;
    const destination = new URL(link.href, window.location.href);
    const prefix = window.location.pathname.split('/galleries/')[0];
    if (destination.origin !== window.location.origin
        || !destination.pathname.startsWith(prefix + '/galleries/hb-')) return;
    navigating = true;
    window.location.assign(destination.href);
  }

  // Capture runs before the optional GSAP normalizer. Only a recognized
  // horizontal background drag is cancelled; image events still pass through.
  window.addEventListener('touchstart', start, { capture: true, passive: true });
  window.addEventListener('touchmove', move, { capture: true, passive: false });
  window.addEventListener('touchend', finish, { capture: true, passive: true });
  window.addEventListener('touchcancel', reset, { capture: true, passive: true });
  window.addEventListener('orientationchange', reset);
  window.addEventListener('pagehide', reset);
  window.addEventListener('pageshow', () => { navigating = false; reset(); });
  document.addEventListener('visibilitychange', reset);
}());

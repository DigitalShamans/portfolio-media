'use strict';

(() => {
  const region = document.querySelector('.recent-galleries');
  if (!region) return;

  // Keep the original six-banner scroll area, but hand any unconsumed wheel
  // distance to the document on the SAME event. Native nested scrolling can
  // silently discard that remainder at either end of a hidden scrollbar.
  region.addEventListener('wheel', event => {
    if (!event.cancelable || event.defaultPrevented || event.ctrlKey || event.metaKey ||
        !event.deltaY || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;

    const limit = Math.max(0, region.scrollHeight - region.clientHeight);
    if (limit < 1) return;

    // Wheel deltaMode can express pixels (trackpads), lines or whole pages.
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? region.clientHeight : 1;
    const delta = event.deltaY * unit;
    if (!Number.isFinite(delta)) return;

    const previous = region.scrollTop;
    const next = Math.max(0, Math.min(limit, previous + delta));
    const remainder = delta - (next - previous);
    event.preventDefault();
    region.scrollTop = next;

    if (Math.abs(remainder) > .01) {
      // Explicit 'instant' avoids the homepage's CSS smooth-anchor behavior
      // turning leftover wheel distance into a delayed/ignored scroll step.
      window.scrollBy({ top: remainder, left: 0, behavior: 'instant' });
    }
  }, { passive: false });
})();

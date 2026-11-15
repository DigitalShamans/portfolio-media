'use strict';

const galleryContent = document.querySelector('.gallery-content');
const gallery = document.querySelector('.gallery');
const title = document.querySelector('.intro h1').textContent;
const dragComparisons = gallery.dataset.comparisonGesture === 'drag';

// Desktop browser zoom changes viewport CSS pixels and devicePixelRatio together.
// Keep the default fit in unzoomed CSS pixels so browser zoom scales the shots.
const desktop = window.matchMedia('(pointer: fine)').matches;
const initialPageScale = desktop && window.outerWidth > 0 ? window.outerWidth / window.innerWidth : 1;
const unzoomedDpr = window.devicePixelRatio / initialPageScale;

function fitGallery() {
  const pageScale = window.devicePixelRatio / unzoomedDpr;
  const fitWidth = Math.min(window.innerWidth, window.innerHeight * 16 / 9);
  galleryContent.style.setProperty('--shot-width', (0.9 * fitWidth * pageScale) + 'px');
}

fitGallery();
window.addEventListener('resize', fitGallery);
const galleryStatus = document.querySelector('#gallery-status');
const shots = [];
const viewer = document.querySelector('#viewer');
const frame = document.querySelector('#viewer-frame');
const stage = document.querySelector('#stage');
const original = document.querySelector('#original');
const previous = document.querySelector('#previous');
const next = document.querySelector('#next');
const previousSide = document.querySelector('#previous-side');
const nextSide = document.querySelector('#next-side');
const counter = document.querySelector('#counter');
const zoom = document.querySelector('#zoom');
const fullscreen = document.querySelector('#fullscreen');
const close = document.querySelector('#close');
const status = document.querySelector('#status');
let current = 0;
let opener;
let drag;
let didDrag = false;
let comparisons = [];
let comparisonIndex = 0;
let selectedComparison = 0;
let displayedComparison = 0;
let viewerIndicator;
let openingPointer;
let pointerOpened = false;
let fullscreenActive = false;
let keepViewerOpen = false;

function setupContinuousGalleryScroll() {
  const desktopScrolling = window.matchMedia('(any-hover: hover) and (any-pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scroller = document.scrollingElement;
  const activityDecay = 0.16;
  const coastDecay = 0.09;
  const centerTolerance = 0.75;
  let frameId;
  let previousFrame;
  let position;
  let written;
  let direction = 0;
  let pending = 0;
  let coast = 0;
  let activity = 0;
  let activityTime = 0;
  let target;
  let targetReach;

  function reset() {
    if (frameId !== undefined) cancelAnimationFrame(frameId);
    frameId = undefined;
    previousFrame = undefined;
    written = scroller.scrollTop;
    position = written;
    direction = pending = coast = activity = 0;
    target = undefined;
  }

  function decayActivity(now) {
    if (now <= activityTime) return;
    activity *= Math.exp(-(now - activityTime) / 1000 / activityDecay);
    activityTime = now;
  }

  function render(now) {
    frameId = undefined;
    if (viewer.open || !desktopScrolling.matches || reducedMotion.matches) {
      reset();
      return;
    }
    const scrollTop = scroller.scrollTop;
    if (Math.abs(scrollTop - written) > 1) {
      if (pending === 0) {
        reset();
        return;
      }
      // A layout shift between input and this frame must not lose the new input.
      position = written = scrollTop;
      coast = 0;
      target = undefined;
    }

    const dt = Math.min(0.042, Math.max(0, (now - previousFrame) / 1000));
    previousFrame = now;
    decayActivity(now);

    const height = scroller.clientHeight;
    const maxScroll = Math.max(0, scroller.scrollHeight - height);
    const wheel = pending;
    pending = 0;
    coast += wheel * 0.28;
    const coasting = coast * -Math.expm1(-dt / coastDecay);
    coast -= coasting;

    // Commit the wheel drive first. Attraction can help movement only in that direction.
    position = Math.max(0, Math.min(maxScroll, position + direction * (wheel * 0.72 + coasting)));
    // Small isolated trackpad movements can only pick up close centres.
    const reach = Math.min(250, height * 0.27) * -Math.expm1(-activity / 22);
    if (target !== undefined && direction * (centerAt(target) - position) <= 0) target = undefined;
    if (target === undefined && (wheel > 0 || coast > 0.25)) {
      const next = centerInDirection(position + direction * centerTolerance, direction);
      if (next >= 0 && next < shots.length && direction * (centerAt(next) - position) < reach) {
        target = next;
        targetReach = reach;
      }
    }

    if (target !== undefined) {
      const center = centerAt(target);
      const gap = (center - position) * direction;
      targetReach = Math.max(reach, targetReach);
      // Fade in at the edge of the attraction range, with no hard pull on entry.
      const proximity = 1 - Math.min(1, gap / targetReach) ** 2;
      const pressure = activity / Math.max(170, height * 0.18);
      const strength = proximity ** 2 / (1 + pressure ** 3);
      if (gap <= centerTolerance) {
        position = center;
        target = undefined;
      } else if (coast <= 0.25 && proximity < 0.22) {
        target = undefined;
      } else {
        const attraction = Math.min(height * 1.25 * strength * dt, gap * -Math.expm1(-13 * strength * dt));
        position += direction * attraction;
      }
    }

    window.scrollTo({ top: position, behavior: 'instant' });
    written = scroller.scrollTop;
    if (target !== undefined || (coast > 0.25 && (direction > 0 ? position < maxScroll : position > 0))) {
      frameId = requestAnimationFrame(render);
    } else {
      coast = 0;
    }

    function centerAt(index) {
      const rect = shots[index].element.getBoundingClientRect();
      return Math.max(0, Math.min(maxScroll, scrollTop + rect.top + (rect.height - height) / 2));
    }

    function centerInDirection(top, travelDirection) {
      let low = 0;
      let high = shots.length;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (centerAt(middle) < top) low = middle + 1;
        else high = middle;
      }
      return travelDirection > 0 ? low : low - 1;
    }
  }

  reset();
  document.addEventListener('wheel', event => {
    if (!desktopScrolling.matches || reducedMotion.matches || viewer.open || !shots.length ||
        !event.cancelable || event.defaultPrevented || event.ctrlKey || event.metaKey ||
        event.altKey || event.shiftKey) {
      reset();
      return;
    }
    const mode = event.deltaMode;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    const lineHeight = mode === 1
      ? Number.parseFloat(getComputedStyle(document.documentElement).lineHeight) || 16
      : 1;
    const units = mode === 2 ? scroller.clientHeight : lineHeight;
    const delta = event.deltaY * units;
    if (!Number.isFinite(delta) || delta === 0) return;
    event.preventDefault();

    if (Math.abs(scroller.scrollTop - written) > 1) reset();
    const nextDirection = Math.sign(delta);
    if (nextDirection !== direction) {
      direction = nextDirection;
      pending = coast = 0;
      target = undefined;
    }
    const now = performance.now();
    decayActivity(now);
    // Every packet contributes its distance, independent of the number of events.
    activity += Math.abs(delta);
    pending += Math.abs(delta);
    if (frameId === undefined) {
      previousFrame = now;
      frameId = requestAnimationFrame(render);
    }
  }, { passive: false });
  document.addEventListener('pointerdown', reset, { capture: true, passive: true });
  document.addEventListener('keydown', reset, { capture: true });
  window.addEventListener('resize', reset);
}

function setupClassicGalleryScroll() {
  const desktopScrolling = window.matchMedia('(any-hover: hover) and (any-pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scroller = document.scrollingElement;
  let movingDirection = 0;

  function imageAtViewportCenter() {
    const hit = document.elementFromPoint(scroller.clientWidth / 2, scroller.clientHeight / 2);
    return hit?.closest('.shot-entry') ?? hit?.closest('.shot');
  }

  function centerOffset(entry) {
    const rect = entry?.getBoundingClientRect();
    if (!rect || rect.height <= 0 || rect.height > scroller.clientHeight) return null;
    const offset = rect.top + (rect.height - scroller.clientHeight) / 2;
    const target = scroller.scrollTop + offset;
    return target >= 0 && target <= scroller.scrollHeight - scroller.clientHeight ? offset : null;
  }

  document.addEventListener('wheel', event => {
    if (!desktopScrolling.matches || viewer.open || !event.cancelable || event.defaultPrevented ||
        event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;

    const mode = event.deltaMode;
    const delta = event.deltaY;
    const distance = Math.abs(delta);
    if (distance <= Math.abs(event.deltaX) || (mode === 0 && distance < 32)) {
      movingDirection = 0;
      return;
    }

    const direction = Math.sign(delta);
    if (direction === movingDirection) {
      event.preventDefault();
      return;
    }
    movingDirection = 0;

    const entry = imageAtViewportCenter();
    const offset = centerOffset(entry);
    if (offset === null) return;

    let movement = offset;
    if (Math.abs(offset) <= 24) {
      const neighbor = direction > 0 ? entry.nextElementSibling : entry.previousElementSibling;
      movement = centerOffset(neighbor);
      if (movement === null || movement * direction < 1) return;
    } else {
      const snapDistance = Math.min(scroller.clientHeight * 0.17, 160);
      const pixels = distance * (mode === 1 ? 40 : mode === 2 ? scroller.clientHeight : 1);
      const remaining = offset * direction;
      if (remaining < 0 || remaining > snapDistance || pixels > remaining + snapDistance) return;
    }

    event.preventDefault();
    movingDirection = reducedMotion.matches ? 0 : direction;
    window.scrollBy({ top: movement, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  }, { passive: false });

  function endWheelMove() {
    movingDirection = 0;
  }

  if ('onscrollend' in document) {
    document.addEventListener('scrollend', endWheelMove);
  } else {
    let scrollTimer;
    document.addEventListener('scroll', () => {
      if (!movingDirection) return;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(endWheelMove, 160);
    }, { passive: true });
  }
}

if (gallery.hasAttribute('data-continuous-scroll')) setupContinuousGalleryScroll();
else setupClassicGalleryScroll();

function fitImage() {
  stage.classList.remove('native');
  stage.scrollTo(0, 0);
  zoom.textContent = '100%';
  positionViewerIndicator();
}

function showStatus(message) {
  status.textContent = message;
  status.hidden = !message;
}

function showImage(index) {
  const { image, sources } = shots[index];
  current = index;
  comparisons = [];
  comparisonIndex = 0;
  selectedComparison = 0;
  displayedComparison = 0;
  stage.classList.toggle('has-comparison', sources.length > 1);
  viewerIndicator?.remove();
  viewerIndicator = sources.length > 1 ? createComparisonIndicator(sources.length, selectViewerComparison) : null;
  if (viewerIndicator) {
    viewerIndicator.hidden = true;
    frame.append(viewerIndicator);
  }
  fitImage();
  zoom.disabled = true;
  previous.disabled = previousSide.disabled = next.disabled = nextSide.disabled = shots.length < 2;
  counter.textContent = (index + 1) + ' / ' + shots.length;
  original.alt = image.alt;
  showStatus('Loading 4K image…');
  original.src = sources[0];
  if (original.complete && original.naturalWidth) imageLoaded();
}

function imageLoaded() {
  zoom.disabled = false;
  showStatus('');
  const { sources } = shots[current];
  if (viewerIndicator) {
    const displayed = sources.indexOf(original.currentSrc || original.src);
    displayedComparison = Math.max(0, displayed);
    setActiveSegment(viewerIndicator, displayedComparison);
    viewerIndicator.hidden = false;
    positionViewerIndicator();
  }
  if (sources.length === 1 || comparisons.length) return;
  comparisons = sources.slice(1).map(source => {
    const image = new Image();
    image.addEventListener('load', updateComparison, { once: true });
    image.src = source;
    return image;
  });
}

function updateComparison() {
  if (!viewer.open) return;
  const alternate = comparisons[comparisonIndex - 1];
  const source = comparisonIndex === 0 ? shots[current].sources[0] : alternate?.naturalWidth && alternate.src;
  if (source && original.src !== source) original.src = source;
}

function selectViewerComparison(index) {
  selectedComparison = comparisonIndex = index;
  updateComparison();
}

function canCompare(event) {
  return (event.pointerType === 'mouse' || event.pointerType === 'pen') && !event.buttons;
}

function comparisonAt(x, left, width, count) {
  return Math.min(count - 1, Math.max(0, Math.floor((x - left) * count / width)));
}

function setupComparisonTouch(surface, getComparison) {
  let gesture;
  let suppressClick = false;

  surface.addEventListener('pointerdown', event => {
    suppressClick = false;
    gesture = undefined;
    if (event.pointerType !== 'touch' || !event.isPrimary) return;
    const comparison = getComparison(event);
    if (!comparison) return;
    gesture = {
      ...comparison,
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      horizontal: false
    };
    surface.setPointerCapture(event.pointerId);
  });

  function track(event) {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.horizontal) {
      if (Math.hypot(dx, dy) < 12) return;
      suppressClick = true;
      if (Math.abs(dx) <= Math.abs(dy)) {
        gesture = undefined;
        return;
      }
      gesture.horizontal = true;
    }
    if (dragComparisons) {
      const { left, width } = gesture.bounds;
      gesture.select(comparisonAt(event.clientX, left, width, gesture.count));
    } else if (event.type === 'pointerup' && Math.abs(dx) >= 32 && Math.abs(dx) > Math.abs(dy)) {
      const { count, index, select } = gesture;
      const step = dx > 0 ? 1 : -1;
      select((index + step + count) % count);
    }
  }

  surface.addEventListener('pointermove', track);
  function finish(event) {
    if (gesture?.id === event.pointerId) gesture = undefined;
  }
  surface.addEventListener('pointerup', event => {
    track(event);
    finish(event);
  });
  surface.addEventListener('pointercancel', finish);
  surface.addEventListener('lostpointercapture', finish);
  surface.addEventListener('click', event => {
    if (!suppressClick || event.detail === 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true });
}

function viewerImageBounds() {
  const rect = original.getBoundingClientRect();
  const ratio = original.naturalWidth / original.naturalHeight;
  const width = Math.min(rect.width, rect.height * ratio);
  const height = width / ratio;
  return { left: rect.left + (rect.width - width) / 2, top: rect.top + (rect.height - height) / 2, width, height };
}

function positionViewerIndicator() {
  if (!viewerIndicator || viewerIndicator.hidden || !original.naturalWidth) return;
  const { left, top, width, height } = viewerImageBounds();
  const frameRect = frame.getBoundingClientRect();
  viewerIndicator.style.left = (left - frameRect.left) + 'px';
  viewerIndicator.style.width = width + 'px';
  viewerIndicator.style.setProperty('--comparison-bottom', (top + height - frameRect.top) + 'px');
}

new ResizeObserver(positionViewerIndicator).observe(stage);
stage.addEventListener('scroll', positionViewerIndicator, { passive: true });

function isInsideImage(event, { left, top, width, height }) {
  return event.clientX >= left && event.clientX < left + width &&
    event.clientY >= top && event.clientY < top + height;
}

function compareAtPointer(event) {
  if (!comparisons.length || !original.naturalWidth || !canCompare(event)) return;
  if (openingPointer && event.screenX === openingPointer.x && event.screenY === openingPointer.y) return;
  openingPointer = null;
  const bounds = viewerImageBounds();
  comparisonIndex = isInsideImage(event, bounds)
    ? comparisonAt(event.clientX, bounds.left, bounds.width, comparisons.length + 1)
    : selectedComparison;
  updateComparison();
}

original.addEventListener('load', imageLoaded);
original.addEventListener('error', () => {
  zoom.disabled = true;
  if (viewerIndicator) viewerIndicator.hidden = true;
  showStatus('This image could not be loaded.');
});

function createComparisonIndicator(count, select) {
  const indicator = document.createElement('span');
  indicator.className = 'comparison-indicator';
  indicator.setAttribute('role', 'group');
  indicator.setAttribute('aria-label', 'Comparison images');
  for (let index = 0; index < count; index++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', 'Show variant ' + (index + 1) + ' of ' + count);
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => select(index));
    indicator.append(button);
  }
  setActiveSegment(indicator, 0);
  return indicator;
}

function setActiveSegment(indicator, index) {
  indicator.querySelector('[aria-pressed="true"]')?.setAttribute('aria-pressed', 'false');
  indicator.children[index].setAttribute('aria-pressed', 'true');
}

function setupGalleryComparison(entry, link, sources) {
  let selected = 0;
  let requested = 0;
  let displayed = 0;
  const alternates = [];
  const indicator = createComparisonIndicator(sources.length, select);
  entry.append(indicator);

  function show(index) {
    alternates[displayed]?.classList.remove('is-visible');
    alternates[index]?.classList.add('is-visible');
    displayed = index;
    setActiveSegment(indicator, index);
  }

  function preview(index) {
    requested = index;
    if (index === displayed) return;
    if (index === 0) {
      show(0);
      return;
    }

    let alternate = alternates[index];
    if (!alternate) {
      alternate = new Image();
      alternate.className = 'shot-comparison';
      alternate.alt = '';
      alternate.setAttribute('aria-hidden', 'true');
      alternate.draggable = false;
      alternate.addEventListener('load', () => {
        if (requested === index) show(index);
      }, { once: true });
      alternates[index] = alternate;
      alternate.src = sources[index];
      link.append(alternate);
    }
    if (alternate.naturalWidth) show(index);
  }

  function select(index) {
    selected = index;
    preview(index);
  }

  link.addEventListener('pointermove', event => {
    if (!canCompare(event)) return;
    const rect = link.getBoundingClientRect();
    preview(comparisonAt(event.clientX, rect.left, rect.width, sources.length));
  });
  entry.addEventListener('pointerleave', event => {
    if (canCompare(event)) preview(selected);
  });
  link.classList.add('has-comparison');
  setupComparisonTouch(link, () => ({
    bounds: link.getBoundingClientRect(),
    count: sources.length,
    index: displayed,
    select
  }));

  return () => preview(selected);
}

function createShot(entry, index) {
  const label = title + ' screenshot ' + (index + 1);
  const sources = GalleryData.images(entry).map(name => new URL(encodeURIComponent(name), document.baseURI).href);
  const link = document.createElement('a');
  link.className = 'shot';
  link.href = sources[0];
  link.setAttribute('aria-label', 'Open ' + label + ' in 4K');
  const image = document.createElement('img');
  image.alt = label;
  image.width = 3840;
  image.height = 2160;
  image.decoding = 'async';
  image.draggable = false;
  if (index === 0) image.fetchPriority = 'high';
  else image.loading = 'lazy';
  image.src = sources[0];
  link.append(image);
  let element = link;
  let resetComparison;
  if (sources.length > 1) {
    element = document.createElement('div');
    element.className = 'shot-entry';
    element.append(link);
    resetComparison = setupGalleryComparison(element, link, sources);
  }
  if (typeof viewer.showModal === 'function') {
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = link;
      pointerOpened = event.detail > 0;
      resetComparison?.();
      openingPointer = { x: event.screenX, y: event.screenY };
      showImage(index);
      viewer.showModal();
      void setFullscreen(true);
    });
  }
  return { element, image, sources };
}

async function loadGallery() {
  try {
    const response = await fetch('gallery.json');
    if (!response.ok) throw new Error('Gallery order unavailable.');
    const entries = GalleryData.parse(await response.text());
    shots.push(...entries.map(createShot));
    gallery.append(...shots.map(shot => shot.element));
    galleryStatus.hidden = true;
  } catch (error) {
    console.error('Gallery could not be loaded', error);
    galleryStatus.textContent = 'The gallery could not be loaded. Please refresh to try again.';
  }
}

function step(amount) {
  if (shots.length < 2) return;
  showImage((current + amount + shots.length) % shots.length);
}

for (const button of [previous, previousSide]) button.addEventListener('click', () => step(-1));
for (const button of [next, nextSide]) button.addEventListener('click', () => step(1));
close.addEventListener('click', () => viewer.close());

viewer.addEventListener('keydown', event => {
  if (stage.classList.contains('native') && event.target === stage) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    step(event.key === 'ArrowLeft' ? -1 : 1);
  }
});

zoom.addEventListener('click', () => {
  if (stage.classList.contains('native')) {
    fitImage();
    return;
  }
  const scale = window.devicePixelRatio || 1;
  stage.style.setProperty('--native-width', (original.naturalWidth / scale) + 'px');
  stage.style.setProperty('--native-height', (original.naturalHeight / scale) + 'px');
  stage.classList.add('native');
  stage.scrollTo((stage.scrollWidth - stage.clientWidth) / 2, (stage.scrollHeight - stage.clientHeight) / 2);
  zoom.textContent = 'Fit';
  positionViewerIndicator();
  stage.focus();
});

stage.addEventListener('click', () => {
  if (!didDrag) viewer.close();
  didDrag = false;
});

stage.addEventListener('pointerdown', event => {
  didDrag = false;
  if (event.pointerType !== 'mouse' || event.button !== 0 || !stage.classList.contains('native')) return;
  event.preventDefault();
  stage.focus();
  drag = { x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop };
  stage.setPointerCapture(event.pointerId);
  stage.classList.add('dragging');
});

stage.addEventListener('pointermove', event => {
  if (!drag) {
    compareAtPointer(event);
    return;
  }
  const dx = drag.x - event.clientX;
  const dy = drag.y - event.clientY;
  if (Math.hypot(dx, dy) > 5) didDrag = true;
  if (didDrag) stage.scrollTo(drag.left + dx, drag.top + dy);
});

stage.addEventListener('lostpointercapture', () => {
  drag = null;
  stage.classList.remove('dragging');
});

stage.addEventListener('pointerleave', event => {
  if (!canCompare(event)) return;
  comparisonIndex = selectedComparison;
  updateComparison();
});

setupComparisonTouch(stage, event => {
  if (!comparisons.length || !original.naturalWidth || stage.classList.contains('native')) return;
  const bounds = viewerImageBounds();
  if (!isInsideImage(event, bounds)) return;
  return { bounds, count: comparisons.length + 1, index: displayedComparison, select: selectViewerComparison };
});

fullscreen.hidden = !document.fullscreenEnabled || !frame.requestFullscreen;
async function setFullscreen(enabled, reportError = false) {
  if (fullscreen.hidden) return;
  try {
    if (enabled) await frame.requestFullscreen();
    else await document.exitFullscreen();
  } catch (error) {
    if (!enabled) keepViewerOpen = false;
    console.warn('Fullscreen request failed', error);
    if (reportError) showStatus('Fullscreen is unavailable here. Try your browser’s fullscreen shortcut.');
  }
}

fullscreen.addEventListener('click', () => {
  keepViewerOpen = document.fullscreenElement === frame;
  void setFullscreen(!keepViewerOpen, true);
});
document.addEventListener('fullscreenchange', () => {
  const isFullscreen = document.fullscreenElement === frame;
  fullscreen.textContent = isFullscreen ? 'Exit fullscreen' : 'Fullscreen';
  if (fullscreenActive && !isFullscreen) {
    if (viewer.open && !keepViewerOpen) viewer.close();
    keepViewerOpen = false;
  }
  fullscreenActive = isFullscreen;
  if (isFullscreen && !viewer.open) void setFullscreen(false);
});

viewer.addEventListener('close', () => {
  if (document.fullscreenElement === frame) void setFullscreen(false);
  comparisons = [];
  viewerIndicator?.remove();
  viewerIndicator = null;
  original.removeAttribute('src');
  fitImage();
  if (opener) {
    const shot = opener;
    if (pointerOpened) {
      shot.classList.add('viewer-return-focus');
      shot.addEventListener('blur', () => shot.classList.remove('viewer-return-focus'), { once: true });
    }
    shot.focus({ preventScroll: true });
  }
});

void loadGallery();

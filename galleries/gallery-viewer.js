'use strict';

const galleryContent = document.querySelector('.gallery-content');
const gallery = document.querySelector('.gallery');
const galleryRevision = document.body.dataset.galleryRevision;
const galleryAccess = window.galleryAccess;
const galleryAssetVersions = JSON.parse(document.body.dataset.galleryAssetVersions || '{}');
const title = document.querySelector('.intro h1').textContent;
const dragComparisons = gallery.dataset.comparisonGesture === 'drag';

// Desktop browser zoom changes viewport CSS pixels and devicePixelRatio together.
// Keep the default fit in unzoomed CSS pixels so browser zoom scales the shots.
const desktop = window.matchMedia('(pointer: fine)').matches;
const initialPageScale = desktop && window.outerWidth > 0 ? window.outerWidth / window.innerWidth : 1;
const unzoomedDpr = window.devicePixelRatio / initialPageScale;

function fitGallery() {
  const pageScale = window.devicePixelRatio / unzoomedDpr;
  // On mobile, an oversized gallery can inflate innerWidth after rotation.
  const viewportWidth = desktop ? window.innerWidth : document.documentElement.clientWidth;
  const fitWidth = Math.min(viewportWidth, window.innerHeight * 16 / 9);
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
original.fetchPriority = 'high';
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
const imageRequests = new WeakMap();
const foregroundLoads = new Set();
let nextBackgroundIndex = 0;
let backgroundLoading = false;

function setupClassicGalleryScroll() {
  const desktopScrolling = window.matchMedia('(any-hover: hover) and (any-pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scroller = document.scrollingElement;
  const twoImageScroll = gallery.hasAttribute('data-two-image-scroll');
  const groupedImageScroll = gallery.hasAttribute('data-grouped-image-scroll');
  const combinedImageScroll = groupedImageScroll || gallery.hasAttribute('data-combined-image-scroll');
  let movingDirection = 0;
  let activeStep;
  let wheelStroke;

  function cancelGalleryStep() {
    if (!activeStep) return;
    cancelAnimationFrame(activeStep.frame);
    activeStep = undefined;
    movingDirection = 0;
  }

  function interruptGalleryScroll() {
    wheelStroke = undefined;
    cancelGalleryStep();
  }

  function recordWheelStroke(direction, time) {
    // Start immediately, then group ticks until the wheel has been quiet for 150ms.
    if (!wheelStroke || wheelStroke.direction !== direction || time - wheelStroke.last >= 150) {
      wheelStroke = { direction, last: time, handled: false };
    } else {
      wheelStroke.last = Math.max(wheelStroke.last, time);
    }
    return wheelStroke;
  }

  function scrollDuration(offset) {
    // Match Chromium's desktop programmatic scroll for the original distance.
    return Math.min(1500, Math.sqrt(Math.abs(offset)) * 1000 / 60);
  }

  function easedProgress(elapsed) {
    if (elapsed <= 0 || elapsed >= 1) return Math.max(0, Math.min(1, elapsed));
    // Solve x(t) for cubic-bezier(0.4, 0, 0, 1), then evaluate y(t).
    let low = 0;
    let high = 1;
    for (let index = 0; index < 14; index++) {
      const t = (low + high) / 2;
      const x = 1.2 * t * (1 - t) ** 2 + t ** 3;
      if (x < elapsed) low = t;
      else high = t;
    }
    const t = (low + high) / 2;
    return t * t * (3 - 2 * t);
  }

  function extendGalleryStep() {
    const extension = activeStep?.extension;
    if (!extension || extension.started !== undefined) return;
    extension.started = performance.now();
    // Give a late second step time to ease into the additional distance.
    extension.duration = Math.max(activeStep.end - extension.started, 0.6 * scrollDuration(extension.offset));
  }

  function animateGalleryStep(offset, oneImageOffset, extraOffset) {
    const start = scroller.scrollTop;
    const started = performance.now();
    const duration = scrollDuration(oneImageOffset);
    const extension = extraOffset === undefined ? undefined : { offset: extraOffset };
    const step = { end: started + duration, extension, frame: undefined };
    activeStep = step;
    let lastPosition = start;

    function advance(now) {
      if (viewer.open || !desktopScrolling.matches || Math.abs(scroller.scrollTop - lastPosition) > 1) {
        cancelGalleryStep();
        return;
      }
      const progress = easedProgress((now - started) / duration);
      let extra = 0;
      let extending = false;
      if (extension?.started !== undefined) {
        // The second path starts at zero displacement and speed.
        const extraProgress = easedProgress((now - extension.started) / extension.duration);
        extra = extension.offset * extraProgress;
        extending = extraProgress < 1;
      }
      window.scrollTo({ top: start + offset * progress + extra, behavior: 'instant' });
      lastPosition = scroller.scrollTop;
      if (progress === 1 && !extending) {
        activeStep = undefined;
        movingDirection = 0;
      } else {
        step.frame = requestAnimationFrame(advance);
      }
    }
    step.frame = requestAnimationFrame(advance);
  }

  if (twoImageScroll || combinedImageScroll) {
    document.addEventListener('pointerdown', interruptGalleryScroll, { capture: true, passive: true });
    document.addEventListener('keydown', interruptGalleryScroll, { capture: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) interruptGalleryScroll();
    });
    window.addEventListener('resize', interruptGalleryScroll);
    reducedMotion.addEventListener?.('change', interruptGalleryScroll);
  }

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

  function groupedCenterOffsets(direction) {
    const entries = gallery.children;
    const top = scroller.scrollTop;
    const height = scroller.clientHeight;
    const maxScroll = Math.max(0, scroller.scrollHeight - height);
    const start = direction > 0 ? 0 : entries.length - 1;
    let nearCenter = false;
    let movement;

    // Use the actual row positions even when the viewport centre is over a gap.
    for (let index = start; index >= 0 && index < entries.length; index += direction) {
      const rect = entries[index].getBoundingClientRect();
      if (rect.height <= 0) continue;
      const center = top + rect.top + (rect.height - height) / 2;
      const offset = Math.max(0, Math.min(maxScroll, center)) - top;
      if (Math.abs(offset) <= 24) nearCenter = true;
      if (offset * direction <= 24) continue;
      if (movement !== undefined) {
        if ((offset - movement) * direction > 1) return { movement, extraOffset: offset - movement };
        continue;
      }
      movement = offset;
      if (!nearCenter) break;
    }
    if (movement !== undefined) return { movement };
  }

  document.addEventListener('wheel', event => {
    if (!desktopScrolling.matches || viewer.open || event.defaultPrevented ||
        event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
      interruptGalleryScroll();
      return;
    }

    const mode = event.deltaMode;
    const delta = event.deltaY;
    const distance = Math.abs(delta);
    const vertical = distance > Math.abs(event.deltaX);
    const direction = Math.sign(delta);
    const stroke = groupedImageScroll && vertical ? recordWheelStroke(direction, event.timeStamp) : undefined;
    if (!event.cancelable) {
      cancelGalleryStep();
      return;
    }
    if (stroke?.handled) {
      event.preventDefault();
      return;
    }
    if (!vertical || (mode === 0 && distance < 32)) {
      cancelGalleryStep();
      movingDirection = 0;
      return;
    }

    if (direction === movingDirection) {
      event.preventDefault();
      if (stroke) stroke.handled = true;
      extendGalleryStep();
      return;
    }
    cancelGalleryStep();
    movingDirection = 0;

    let movement;
    let oneImageOffset;
    let extraOffset;
    if (groupedImageScroll) {
      const targets = groupedCenterOffsets(direction);
      if (!targets) return;
      movement = targets.movement;
      extraOffset = targets.extraOffset;
      if (extraOffset !== undefined) oneImageOffset = movement;
    } else {
      const entry = imageAtViewportCenter();
      const offset = centerOffset(entry);
      if (offset === null) return;
      movement = offset;
      if (Math.abs(offset) <= 24) {
        const neighbor = direction > 0 ? entry.nextElementSibling : entry.previousElementSibling;
        movement = centerOffset(neighbor);
        if (movement === null || movement * direction < 1) return;
        if (twoImageScroll || combinedImageScroll) {
          const secondNeighbor = direction > 0 ? neighbor.nextElementSibling : neighbor.previousElementSibling;
          const secondOffset = centerOffset(secondNeighbor);
          if (secondOffset !== null && (secondOffset - movement) * direction > 0) {
            oneImageOffset = movement;
            if (twoImageScroll) movement = secondOffset;
            else extraOffset = secondOffset - movement;
          }
        }
      } else {
        const snapDistance = Math.min(scroller.clientHeight * 0.17, 160);
        const pixels = distance * (mode === 1 ? 40 : mode === 2 ? scroller.clientHeight : 1);
        const remaining = offset * direction;
        if (remaining < 0 || remaining > snapDistance || pixels > remaining + snapDistance) return;
      }
    }

    event.preventDefault();
    if (stroke) stroke.handled = true;
    movingDirection = reducedMotion.matches ? 0 : direction;
    if (oneImageOffset !== undefined && !reducedMotion.matches) {
      animateGalleryStep(movement, oneImageOffset, extraOffset);
    } else {
      window.scrollBy({ top: movement, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    }
  }, { passive: false });

  function endWheelMove() {
    if (!activeStep) movingDirection = 0;
  }

  if ('onscrollend' in document) {
    document.addEventListener('scrollend', endWheelMove);
  } else {
    let scrollTimer;
    document.addEventListener('scroll', () => {
      if (!movingDirection || activeStep) return;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(endWheelMove, 160);
    }, { passive: true });
  }
}

setupClassicGalleryScroll();

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

function resolvedImageSource(source) {
  return galleryAccess ? galleryAccess.resolved(source) : source;
}

function setImageSource(image, source, ready, failed) {
  const resolved = resolvedImageSource(source);
  if (resolved) {
    imageRequests.delete(image);
    image.src = resolved;
    ready?.(resolved);
    return;
  }
  const request = Symbol();
  imageRequests.set(image, request);
  void galleryAccess.image(source, image.fetchPriority).then(url => {
    if (imageRequests.get(image) !== request) return;
    imageRequests.delete(image);
    image.src = url;
    ready?.(url);
  }, () => {
    if (imageRequests.get(image) !== request) return;
    imageRequests.delete(image);
    failed?.();
  });
}

function showImage(index, initialVariant = 0) {
  const shot = shots[index];
  const { image, sources } = shot;
  prioritizeShot(shot);
  current = index;
  comparisons = [];
  comparisonIndex = initialVariant;
  selectedComparison = initialVariant;
  displayedComparison = initialVariant;
  stage.classList.toggle('has-comparison', sources.length > 1);
  viewerIndicator?.remove();
  viewerIndicator = sources.length > 1
    ? createComparisonIndicator(sources.length, selectViewerComparison, initialVariant)
    : null;
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
  if (galleryAccess) original.removeAttribute('src');
  setImageSource(original, sources[initialVariant], () => {
    if (original.complete && original.naturalWidth) imageLoaded();
  }, () => showStatus('This image could not be loaded.'));
  if (galleryAccess && initialVariant !== 0) {
    void shot.primaryLoad.then(() => {
      if (shots[current] === shot) updateComparison();
    });
  }
}

function imageLoaded() {
  zoom.disabled = false;
  showStatus('');
  const { sources } = shots[current];
  if (viewerIndicator) {
    const displayed = sources.findIndex(source => resolvedImageSource(source) === (original.currentSrc || original.src));
    displayedComparison = Math.max(0, displayed);
    setActiveSegment(viewerIndicator, displayedComparison);
    viewerIndicator.hidden = false;
    positionViewerIndicator();
  }
  if (sources.length === 1 || comparisons.length) return;
  comparisons = sources.slice(1).map(source => {
    const image = new Image();
    image.addEventListener('load', updateComparison, { once: true });
    setImageSource(image, source);
    return image;
  });
}

function updateComparison() {
  if (!viewer.open) return;
  const alternate = comparisons[comparisonIndex - 1];
  const source = comparisonIndex === 0 ? resolvedImageSource(shots[current].sources[0]) : alternate?.naturalWidth && alternate.src;
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

function createComparisonIndicator(count, select, initialVariant = 0) {
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
  setActiveSegment(indicator, initialVariant);
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
      setImageSource(alternate, sources[index], undefined, () => {
        alternates[index] = undefined;
        alternate.remove();
      });
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

  return () => {
    const initialVariant = displayed;
    preview(selected);
    return initialVariant;
  };
}

function galleryAssetUrl(filename) {
  if (galleryAccess) return filename;
  const url = new URL(encodeURIComponent(filename), document.baseURI);
  const revision = galleryAssetVersions[filename] ?? galleryRevision;
  if (revision) url.searchParams.set('v', revision);
  return url.href;
}

function loadPrimary(shot, priority) {
  const { image, link, sources } = shot;
  if (priority === 'high' || !shot.primaryLoad) image.fetchPriority = priority;
  if (shot.primaryLoad) return shot.primaryLoad;

  shot.primaryLoad = new Promise(resolve => {
    function finish() {
      image.removeEventListener('load', finish);
      image.removeEventListener('error', finish);
      resolve();
    }

    image.addEventListener('load', finish);
    image.addEventListener('error', finish);
    setImageSource(image, sources[0], url => {
      link.href = url;
      if (image.complete && image.naturalWidth) finish();
    }, finish);
  });
  return shot.primaryLoad;
}

function loadNextBackgroundShot() {
  if (backgroundLoading || foregroundLoads.size) return;
  while (shots[nextBackgroundIndex]?.primaryLoad) nextBackgroundIndex++;
  const shot = shots[nextBackgroundIndex];
  if (!shot) return;

  backgroundLoading = true;
  void loadPrimary(shot, 'low').then(() => {
    backgroundLoading = false;
    loadNextBackgroundShot();
  });
}

function prioritizeShot(shot) {
  const request = loadPrimary(shot, 'high');
  if (foregroundLoads.has(request)) return;

  foregroundLoads.add(request);
  void request.then(() => {
    foregroundLoads.delete(request);
    loadNextBackgroundShot();
  });
}

function loadVisibleShotsFirst() {
  const shotsByElement = new Map(shots.map(shot => [shot.element, shot]));
  const observer = new IntersectionObserver(entries => {
    for (const { isIntersecting, target } of entries) {
      if (!isIntersecting) continue;
      observer.unobserve(target);
      prioritizeShot(shotsByElement.get(target));
    }
  });

  const visible = shots.filter(({ element }) => {
    const { top, bottom } = element.getBoundingClientRect();
    return bottom > 0 && top < window.innerHeight;
  });
  for (const shot of visible.length ? visible : shots.slice(0, 1)) prioritizeShot(shot);
  for (const shot of shots) {
    if (!shot.primaryLoad) observer.observe(shot.element);
  }
}

function createShot(entry, index) {
  const label = title + ' screenshot ' + (index + 1);
  const sources = GalleryData.images(entry).map(galleryAssetUrl);
  const link = document.createElement('a');
  link.className = 'shot';
  link.href = galleryAccess ? '#viewer' : sources[0];
  link.setAttribute('aria-label', 'Open ' + label + ' in 4K');
  const image = document.createElement('img');
  image.className = 'shot-primary';
  image.alt = label;
  image.width = 3840;
  image.height = 2160;
  image.decoding = 'async';
  image.draggable = false;
  link.append(image);
  let element = link;
  let finishComparisonPreview;
  if (sources.length > 1) {
    element = document.createElement('div');
    element.className = 'shot-entry';
    element.append(link);
    finishComparisonPreview = setupGalleryComparison(element, link, sources);
  }
  if (typeof viewer.showModal === 'function') {
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = link;
      pointerOpened = event.detail > 0;
      const initialVariant = finishComparisonPreview?.() ?? 0;
      openingPointer = { x: event.screenX, y: event.screenY };
      showImage(index, initialVariant);
      viewer.showModal();
      void setFullscreen(true);
    });
  }
  return { element, image, link, sources };
}

async function loadGallery() {
  try {
    const response = galleryAccess ? await galleryAccess.manifest() : await fetch(galleryAssetUrl('gallery.json'));
    if (!response.ok) throw new Error('Gallery order unavailable.');
    const entries = GalleryData.parse(await response.text());
    shots.push(...entries.map(createShot));
    gallery.append(...shots.map(shot => shot.element));
    galleryStatus.hidden = true;
    loadVisibleShotsFirst();
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
  imageRequests.delete(original);
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

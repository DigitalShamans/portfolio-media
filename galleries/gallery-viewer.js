'use strict';

const galleryDiagnostics = window.PortfolioDiagnostics;

const galleryContent = document.querySelector('.gallery-content, .gallery-map-page');
const gallery = document.querySelector('.gallery');
const galleryRevision = document.body.dataset.galleryRevision;
const galleryAccess = window.galleryAccess;
const imageResolution = galleryAccess?.resolution ?? GalleryResolution.current();
const galleryAssetVersions = JSON.parse(document.body.dataset.galleryAssetVersions || '{}');
const title = document.querySelector('.intro h1, #map-title').textContent;

const finePointer = window.matchMedia('(pointer: fine)');
const desktopScrolling = window.matchMedia('(any-hover: hover) and (any-pointer: fine)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let displaySize = `${screen.width}x${screen.height}`;
let baselinePixelRatio = window.devicePixelRatio;

function fitGallery() {
  const viewport = document.documentElement;
  const currentDisplaySize = `${screen.width}x${screen.height}`;
  // Changing the emulated display can also change its pixel ratio.
  if (currentDisplaySize !== displaySize) {
    displaySize = currentDisplaySize;
    baselinePixelRatio = window.devicePixelRatio;
  }
  // Mobile CSS uses stable viewport sizing independently of browser toolbar changes.
  if (!finePointer.matches) {
    galleryContent.style.removeProperty('--shot-width');
    return;
  }
  const pageScale = window.devicePixelRatio / baselinePixelRatio;
  const fitWidth = Math.min(viewport.clientWidth, viewport.clientHeight * 16 / 9);
  galleryContent.style.setProperty('--shot-width', (0.9 * fitWidth * pageScale) + 'px');
}

fitGallery();
window.addEventListener('resize', fitGallery);
finePointer.addEventListener('change', fitGallery);
const galleryStatus = document.querySelector('#gallery-status');
const shots = [];
const viewer = document.querySelector('#viewer');
// This optional enhancement must never block gallery loading or desktop scrolling.
const primaryTouch = window.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;
galleryDiagnostics?.state('gallery-touch', 'Native touch scrolling', primaryTouch
  ? 'Waiting for the mobile scroll controller.' : 'GSAP touch normalization needs a coarse primary pointer and touch support.');
if (primaryTouch) {
  const mobileScrollScript = document.createElement('script');
  mobileScrollScript.src = new URL('./gallery-mobile-scroll.js?v=3', document.currentScript.src).href;
  mobileScrollScript.addEventListener('load', () => {
    const mapScroll = gallery.hasAttribute('data-gsap-gallery-scroll');
    window.GalleryMobileScroll?.start({
      gallery, viewer,
      gestureRoot: mapScroll ? galleryContent : gallery,
      swipeControls: mapScroll ? '.gallery-map-overview-button, .gallery-map-region' : ''
    });
  }, { once: true });
  mobileScrollScript.addEventListener('error', () => {
    galleryDiagnostics?.state('gallery-touch', 'Native touch scrolling', 'The mobile scroll controller could not load.');
  }, { once: true });
  document.head.append(mobileScrollScript);
}
const frame = document.querySelector('#viewer-frame');
const stage = document.querySelector('#stage');
const canvas = document.querySelector('#viewer-canvas');
const viewerArrows = document.querySelector('.viewer-arrows');
const original = document.querySelector('#original');
original.fetchPriority = 'high';
const previousSide = document.querySelector('#previous-side');
const nextSide = document.querySelector('#next-side');
const counter = document.querySelector('#counter');
const fullscreen = document.querySelector('#fullscreen');
const fullscreenSupported = document.fullscreenEnabled && typeof frame.requestFullscreen === 'function';
const status = document.querySelector('#status');
let current = 0;
let viewerOrigin;
const viewerTouches = new Map();
const viewerZoom = { scale: 1, x: 0, y: 0 };
let viewerGesture;
let viewerWheel;
let viewerZoomAnimation;
let mouseGesture;
let suppressViewerClick = false;
let lastViewerPointer;
let viewerZoomClickCount = 0;
let viewerAspect = 0;
let viewerRequest = 0;
let comparisonsInitialized = false;
let viewerHover = null;
let comparisonIndex = 0;
let selectedComparison = 0;
let displayedComparison = 0;
let viewerIndicator;
let openingPointer;
let fullscreenActive = false;
const imageRetryDelay = 1000;
const foregroundLoads = new Set();
let nextBackgroundIndex = 0;
let backgroundLoading = false;
const galleryPositionKey = 'gallery-scroll-position:' + window.location.pathname;

function getGalleryPositionStorage() {
  if (!galleryContent.classList.contains('gallery-content') || window.location.hash) return null;
  try {
    const storage = window.sessionStorage;
    storage.getItem(galleryPositionKey);
    window.history.scrollRestoration = 'manual';
    return storage;
  } catch {
    return null;
  }
}

const galleryPositionStorage = getGalleryPositionStorage();

function readGalleryPosition() {
  try {
    const position = JSON.parse(galleryPositionStorage?.getItem(galleryPositionKey) ?? 'null');
    if (Number.isFinite(position?.top) && position.top >= 0) return position;
  } catch { /* Treat unavailable or unreadable storage as a first visit. */ }
}

function currentGalleryPosition() {
  const top = Math.max(0, window.scrollY);
  const position = { top };
  if (top > 0) {
    const height = document.documentElement.clientHeight;
    const center = height / 2;
    let nearest = Infinity;
    for (const shot of shots) {
      const rect = shot.element.getBoundingClientRect();
      if (rect.top >= height) break;
      if (rect.bottom <= 0 || rect.height <= 0) continue;
      const distance = Math.abs(center - (rect.top + rect.height / 2));
      if (distance >= nearest) continue;
      nearest = distance;
      position.filename = shot.filenames[0];
      position.offset = (center - rect.top) / rect.height;
    }
  }
  return position;
}

function restoreGalleryPosition(position) {
  if (!position || window.location.hash) return;
  const shot = Number.isFinite(position.offset)
    ? shots.find(item => item.filenames.includes(position.filename))
    : undefined;
  let top = position.top;
  if (shot) {
    const rect = shot.element.getBoundingClientRect();
    top = window.scrollY + rect.top + position.offset * rect.height - document.documentElement.clientHeight / 2;
  }
  window.scrollTo({ top, behavior: 'instant' });
  return shot;
}

function settleGalleryPosition(position, imageReady, embedsReady) {
  if (!position?.top) return imageReady;
  const input = new AbortController();
  for (const type of ['pointerdown', 'wheel', 'keydown']) {
    window.addEventListener(type, () => input.abort(), {
      capture: true, passive: true, signal: input.signal
    });
  }
  return Promise.all([imageReady, embedsReady, document.fonts?.ready]).then(([loaded]) => {
    // Replace the placeholder-based position once the real image aspect ratio
    // and any embedded rows are known, unless the viewer has interacted.
    if (!input.signal.aborted) restoreGalleryPosition(position);
    return loaded;
  }).finally(() => input.abort());
}

function trackGalleryPosition() {
  if (!galleryPositionStorage) return;
  // Mobile browsers can change the viewport geometry while hiding a page.
  // Use the last position measured while the gallery was visible.
  let position = currentGalleryPosition();
  let frame;
  function updatePosition() {
    if (frame !== undefined) return;
    frame = window.requestAnimationFrame(() => {
      frame = undefined;
      if (!document.hidden && !viewer.open) position = currentGalleryPosition();
    });
  }
  function savePosition() {
    try {
      galleryPositionStorage.setItem(galleryPositionKey, JSON.stringify(position));
    } catch { /* Navigating still works without storage. */ }
  }
  window.addEventListener('scroll', updatePosition, { passive: true });
  window.addEventListener('resize', updatePosition);
  window.addEventListener('pagehide', savePosition);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) savePosition();
    else updatePosition();
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      restoreGalleryPosition(readGalleryPosition());
      updatePosition();
    }
  });
}

function setupClassicGalleryScroll() {
  // This page has its own continuous GSAP controller, including small wheel deltas.
  if (gallery.hasAttribute('data-gsap-gallery-scroll')) return;
  if (gallery.hasAttribute('data-native-gallery-scroll')) {
    galleryDiagnostics?.state('gallery-wheel', 'Native wheel scrolling', 'This gallery uses native scrolling.');
    return;
  }
  galleryDiagnostics?.state('gallery-wheel', desktopScrolling.matches ? 'Image stepping available' : 'Native wheel scrolling',
    'The wheel controller is independent of GSAP.', { imageResolution });
  const scroller = document.scrollingElement;
  const twoImageScroll = gallery.hasAttribute('data-two-image-scroll');
  const groupedImageScroll = gallery.hasAttribute('data-grouped-image-scroll');
  const combinedImageScroll = groupedImageScroll || gallery.hasAttribute('data-combined-image-scroll');
  let movingDirection = 0;
  let activeStep;
  let wheelStroke;

  function cancelGalleryStep() {
    if (!activeStep) return;
    galleryDiagnostics?.count('gallery-wheel', 'step cancelled');
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
      galleryDiagnostics?.sample('gallery-wheel', lastPosition);
      if (progress === 1 && !extending) {
        galleryDiagnostics?.count('gallery-wheel', 'step completed');
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
      galleryDiagnostics?.count('gallery-wheel', 'wheel bypassed by input or viewer');
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
      galleryDiagnostics?.count('gallery-wheel', 'browser-owned wheel');
      cancelGalleryStep();
      return;
    }
    if (stroke?.handled) {
      event.preventDefault();
      return;
    }
    if (!vertical || (mode === 0 && distance < 32)) {
      galleryDiagnostics?.count('gallery-wheel', vertical ? 'small wheel delta left native' : 'horizontal wheel left native');
      galleryDiagnostics?.state('gallery-wheel', 'Native wheel scrolling', vertical
        ? 'Small wheel deltas stay with the browser.' : 'Horizontal wheel movement stays with the browser.');
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
      if (!targets) {
        galleryDiagnostics?.count('gallery-wheel', 'no step target');
        return;
      }
      movement = targets.movement;
      // Opening alignment and other single stops use the same motion as grouped steps.
      oneImageOffset = movement;
      extraOffset = targets.extraOffset;
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
      galleryDiagnostics?.state('gallery-wheel', 'JavaScript image step', 'This wheel animation uses requestAnimationFrame.');
      galleryDiagnostics?.count('gallery-wheel', 'animated step started');
      animateGalleryStep(movement, oneImageOffset, extraOffset);
    } else {
      galleryDiagnostics?.state('gallery-wheel', reducedMotion.matches ? 'Instant step' : 'Browser smooth step',
        reducedMotion.matches ? 'Reduced motion is enabled.' : 'The browser receives a smooth scroll request.');
      galleryDiagnostics?.count('gallery-wheel', 'browser step requested');
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
  viewerZoomClickCount = 0;
  cancelViewerZoomAnimation();
  setViewerZoom(1, 0, 0);
  positionViewerControls();
}

function showStatus(message) {
  status.textContent = message;
  status.hidden = !message;
}

function imageUrl(image) {
  return image.currentSrc || image.src;
}

function loadImageSource(image, url, adopt = false) {
  return new Promise(resolve => {
    function finish(loaded) {
      image.removeEventListener('load', onLoad);
      image.removeEventListener('error', onError);
      resolve(loaded);
    }

    function currentRequestComplete() {
      return image.complete && (adopt || !image.currentSrc || image.currentSrc === url);
    }

    function onLoad() {
      if (currentRequestComplete() && image.naturalWidth) finish(true);
    }

    function onError() {
      if (currentRequestComplete() && !image.naturalWidth) finish(false);
    }

    image.addEventListener('load', onLoad);
    image.addEventListener('error', onError);
    if (adopt) {
      // Adopt the parser's request even when it settled before the viewer script ran.
      if (image.complete) finish(image.naturalWidth > 0);
    } else {
      image.src = url;
      onLoad();
    }
  });
}

async function retryPublicOriginal(url, priority) {
  try {
    // The delivery route requires an exact URL. Force a fresh request to that URL.
    const response = await fetch(url, { cache: 'reload', credentials: 'omit', priority });
    if (response.ok) return URL.createObjectURL(await response.blob());
    await response.body?.cancel();
  } catch {
    // A request or response-body failure will use the WebP.
  }
}

async function loadImage(image, source, { link, pictureSource } = {}) {
  let url = source.url;
  if (galleryAccess) {
    try {
      url = galleryAccess.resolved(url) ?? await galleryAccess.image(url, image.fetchPriority);
    } catch {
      return false;
    }
  }
  if (link) link.href = url;

  const loaded = await loadImageSource(image, url, Boolean(pictureSource));
  if (loaded) {
    if (pictureSource) {
      // Keep the chosen resolution stable after adopting the server-rendered picture.
      const chosen = imageUrl(image);
      if (image.src !== chosen) image.src = chosen;
      pictureSource.remove();
    }
    return true;
  }
  if (!source.fallbackUrl || image.currentSrc === source.fallbackUrl) {
    galleryAccess?.discard?.(source.url, imageUrl(image));
    return false;
  }

  if (pictureSource) {
    // Suppress the picture's automatic WebP selection until the original retry settles.
    image.removeAttribute('src');
    pictureSource.remove();
  }
  await new Promise(resolve => setTimeout(resolve, imageRetryDelay));
  const retry = await retryPublicOriginal(url, image.fetchPriority);
  if (retry) {
    if (await loadImageSource(image, retry)) return true;
    URL.revokeObjectURL(retry);
  }
  return loadImageSource(image, source.fallbackUrl);
}

function showImage(index, initialVariant = 0) {
  const shot = shots[index];
  const { image, sources } = shot;
  const primary = prioritizeShot(shot);
  const request = ++viewerRequest;
  current = index;
  comparisonsInitialized = false;
  viewerHover = null;
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
    canvas.append(viewerIndicator);
  }
  fitImage();
  previousSide.disabled = nextSide.disabled = shots.length < 2;
  counter.textContent = (index + 1) + ' / ' + shots.length;
  showStatus('Loading image…');
  const selectedImage = initialVariant === 0 ? image : shot.comparison.getImage(initialVariant, true);
  if (selectedImage?.naturalWidth) {
    displayOriginal(selectedImage);
  } else if (!sources[0].fallbackUrl) {
    viewerAspect = 0;
    original.removeAttribute('src');
  }

  void primary.then(loaded => {
    if (request !== viewerRequest || !viewer.open || comparisonIndex !== 0) return;
    if (loaded) displayOriginal(image);
    else if (initialVariant === 0) showStatus('This image could not be loaded.');
  });
}

function displayOriginal(image) {
  const source = imageUrl(image);
  // A pending comparison can temporarily clear the viewer element's intrinsic size.
  viewerAspect = image.naturalWidth / image.naturalHeight;
  original.alt = shots[current].image.alt;
  if (original.src !== source) original.src = source;
  if (original.complete && original.naturalWidth) queueMicrotask(imageLoaded);
}

function imageLoaded() {
  if (!viewer.open || !original.complete || !original.naturalWidth) return;
  const shot = shots[current];
  const source = imageUrl(original);
  const displayed = shot.sources.findIndex((_, index) => {
    const image = index === 0 ? shot.image : shot.comparison.getImage(index);
    return image?.naturalWidth && imageUrl(image) === source;
  });
  if (displayed < 0) return;
  if (viewerZoom.scale > 1) setViewerZoom(viewerZoom.scale, viewerZoom.x, viewerZoom.y);
  viewer.dispatchEvent(new CustomEvent('gallery-imagechange', {
    detail: { filename: shot.filenames[displayed], index: current, variant: displayed }
  }));
  showStatus('');
  if (viewerIndicator) {
    displayedComparison = displayed;
    setActiveSegment(viewerIndicator, displayedComparison);
    viewerIndicator.hidden = false;
  }
  positionViewerControls();
  if (!shot.comparison || comparisonsInitialized) return;
  comparisonsInitialized = true;
  for (let index = 1; index < shot.sources.length; index++) shot.comparison.getImage(index, true);
}

function updateComparison(requestImage = false) {
  if (!viewer.open) return;
  const shot = shots[current];
  if (comparisonIndex === 0 && !shot.image.naturalWidth) {
    if (requestImage) prioritizeShot(shot);
    return;
  }
  const image = comparisonIndex === 0 ? shot.image : shot.comparison.getImage(comparisonIndex, requestImage);
  if (image?.naturalWidth && original.src !== imageUrl(image)) displayOriginal(image);
}

function selectViewerComparison(index) {
  selectedComparison = comparisonIndex = index;
  updateComparison(true);
}

function canCompare(event) {
  return (event.pointerType === 'mouse' || event.pointerType === 'pen') && !event.buttons;
}

function comparisonInBottomStrip(event, { left, top, width, height }, count) {
  const x = event.clientX - left;
  const y = event.clientY - top;
  if (x < 0 || x >= width || y < height * 0.94 || y >= height) return null;
  return Math.min(count - 1, Math.floor(x * count / width));
}

function setupImageTouch(surface, getInteraction) {
  let gesture;
  let suppressClick = false;

  surface.addEventListener('pointerdown', event => {
    suppressClick = false;
    gesture = undefined;
    if (event.pointerType !== 'touch' || !event.isPrimary) return;
    const interaction = getInteraction(event);
    if (!interaction) return;
    gesture = {
      ...interaction,
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      axis: null
    };
    surface.setPointerCapture(event.pointerId);
  });

  function track(event) {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.axis) {
      if (Math.hypot(dx, dy) < 12) return;
      suppressClick = true;
      gesture.axis = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      if (gesture.axis === 'vertical') {
        gesture = undefined;
        return;
      }
    }
    if (event.type !== 'pointerup') return;
    if (gesture.count > 1 && Math.abs(dx) >= 32 && Math.abs(dx) > Math.abs(dy)) {
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

function viewerImageBounds(rect = original.getBoundingClientRect()) {
  const width = Math.min(rect.width, rect.height * viewerAspect);
  const height = viewerAspect ? width / viewerAspect : 0;
  return { left: rect.left + (rect.width - width) / 2, top: rect.top + (rect.height - height) / 2, width, height };
}

function positionViewerControls() {
  if (!viewerAspect) return;
  // Lay out image controls before zooming; the canvas carries them with the image.
  const viewport = stage.getBoundingClientRect();
  const { left, top, width, height } = viewerImageBounds(viewport);
  viewerArrows.style.left = (left - viewport.left + width / 2) + 'px';
  viewerArrows.style.top = (top - viewport.top + height / 2) + 'px';
  viewerArrows.style.width = width + 'px';
  if (!viewerIndicator || viewerIndicator.hidden) return;
  viewerIndicator.style.left = (left - viewport.left) + 'px';
  viewerIndicator.style.width = width + 'px';
  viewerIndicator.style.setProperty('--comparison-bottom', (top + height - viewport.top) + 'px');
}

new ResizeObserver(() => {
  if (viewerZoom.scale > 1) setViewerZoom(viewerZoom.scale, viewerZoom.x, viewerZoom.y);
  positionViewerControls();
}).observe(stage);

function isInsideImage(event, { left, top, width, height }) {
  return event.clientX >= left && event.clientX < left + width &&
    event.clientY >= top && event.clientY < top + height;
}

function compareAtPointer(event) {
  if (viewerZoom.scale > 1 || !comparisonsInitialized || !viewerAspect || !canCompare(event)) return;
  if (openingPointer && event.screenX === openingPointer.x && event.screenY === openingPointer.y) return;
  openingPointer = null;
  const overComparison = stage.contains(event.target) || viewerIndicator?.contains(event.target);
  const hovered = overComparison
    ? comparisonInBottomStrip(event, viewerImageBounds(), shots[current].sources.length)
    : null;
  if (viewerHover === hovered) return;
  viewerHover = hovered;
  comparisonIndex = hovered ?? selectedComparison;
  updateComparison(hovered !== null);
}

original.addEventListener('load', imageLoaded);
original.addEventListener('error', () => {
  if (!viewer.open || !original.hasAttribute('src')) return;
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

function setupGalleryComparison(entry, link, sources, shotIndex) {
  let selected = 0;
  let requested = 0;
  let displayed = 0;
  let hovered = null;
  const alternates = [];
  const indicator = createComparisonIndicator(sources.length, select);
  entry.append(indicator);

  function show(index) {
    alternates[displayed]?.classList.remove('is-visible');
    alternates[index]?.classList.add('is-visible');
    displayed = index;
    setActiveSegment(indicator, index);
  }

  // The tile and fullscreen viewer share each alternate image and its in-flight request.
  function getImage(index, request = false) {
    if (alternates[index] || !request) return alternates[index];
    const alternate = new Image();
    alternate.className = 'shot-comparison';
    alternate.alt = '';
    alternate.setAttribute('aria-hidden', 'true');
    alternate.draggable = false;
    alternates[index] = alternate;

    const source = sources[index];
    link.append(alternate);
    void loadImage(alternate, source).then(loaded => {
      if (!loaded) {
        // Keep an exhausted 4K/WebP pair from restarting on every hover or toggle.
        if (!source.fallbackUrl) delete alternates[index];
        alternate.remove();
        return;
      }
      if (requested === index) show(index);
      if (shots[current]?.link === link && comparisonIndex === index) updateComparison();
    });
    return alternate;
  }

  function preview(index, request = true) {
    requested = index;
    if (index === 0) {
      const shot = shots[shotIndex];
      if (!shot.image.naturalWidth) {
        if (request) prioritizeShot(shot);
        return;
      }
    }
    if (index !== displayed && (index === 0 || getImage(index, request)?.naturalWidth)) show(index);
  }

  function select(index) {
    selected = index;
    preview(index);
  }

  entry.addEventListener('pointermove', event => {
    if (!canCompare(event)) return;
    const index = comparisonInBottomStrip(event, link.getBoundingClientRect(), sources.length);
    if (index === hovered) return;
    hovered = index;
    preview(index ?? selected, index !== null);
  });
  entry.addEventListener('pointerleave', event => {
    hovered = null;
    if (canCompare(event)) preview(selected, false);
  });
  link.classList.add('has-comparison');
  setupImageTouch(link, () => ({
    count: sources.length,
    index: displayed,
    select
  }));

  return {
    getImage,
    select,
    primaryLoaded() {
      if (requested === 0 && displayed !== 0) show(0);
    },
    finishPreview() {
      const initialVariant = displayed;
      preview(selected, false);
      return initialVariant;
    }
  };
}

function galleryAssetUrl(filename) {
  const url = new URL(encodeURIComponent(filename), gallery.dataset.galleryRoot || document.baseURI);
  const revision = galleryAssetVersions[filename] ?? galleryRevision;
  if (revision) url.searchParams.set('v', revision);
  return url.href;
}

function primaryIsVisible(shot) {
  return shot.inViewport || (viewer.open && shots[current] === shot && comparisonIndex === 0);
}

function scheduleVisibleRetry(shot) {
  if (!primaryIsVisible(shot) || shot.autoRetryUsed || shot.retryTimer !== undefined) return;
  shot.retryTimer = setTimeout(() => {
    shot.retryTimer = undefined;
    if (!primaryIsVisible(shot) || !shot.primaryFailed) return;
    shot.autoRetryUsed = true;
    prioritizeShot(shot);
  }, imageRetryDelay);
}

function loadPrimary(shot, priority) {
  const { image, link, sources } = shot;
  const source = sources[0];
  if (priority === 'high' || !shot.primaryLoad) image.fetchPriority = priority;
  if (shot.primaryLoad && (!shot.primaryFailed || priority !== 'high' || source.fallbackUrl)) return shot.primaryLoad;

  clearTimeout(shot.retryTimer);
  shot.retryTimer = undefined;
  shot.primaryFailed = false;
  const request = shot.initialLoad ?? loadImage(image, source, { link });
  shot.initialLoad = undefined;
  shot.primaryLoad = request.then(loaded => {
    shot.primaryFailed = !loaded;
    if (loaded) {
      shot.comparison?.primaryLoaded();
      if (viewer.open && shots[current] === shot && comparisonIndex === 0) displayOriginal(image);
    } else if (!source.fallbackUrl) {
      scheduleVisibleRetry(shot);
    }
    return loaded;
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
  if (!foregroundLoads.has(request)) {
    foregroundLoads.add(request);
    void request.then(() => {
      foregroundLoads.delete(request);
      loadNextBackgroundShot();
    });
  }
  return request;
}

function loadVisibleShotsFirst() {
  const shotsByElement = new Map(shots.map(shot => [shot.element, shot]));
  const observer = new IntersectionObserver(entries => {
    for (const { isIntersecting, target } of entries) {
      const shot = shotsByElement.get(target);
      if (isIntersecting === shot.inViewport) continue;
      shot.inViewport = isIntersecting;
      if (isIntersecting) prioritizeShot(shot);
      else if (!primaryIsVisible(shot)) {
        clearTimeout(shot.retryTimer);
        shot.retryTimer = undefined;
      }
    }
  });

  const visible = shots.filter(shot => {
    const { top, bottom } = shot.element.getBoundingClientRect();
    shot.inViewport = bottom > 0 && top < window.innerHeight;
    observer.observe(shot.element);
    return shot.inViewport;
  });
  for (const shot of visible.length ? visible : shots.slice(0, 1)) prioritizeShot(shot);
}

function createShot(entry, index, firstImage) {
  const label = title + ' screenshot ' + (index + 1);
  const filenames = GalleryData.images(entry);
  const sources = filenames.map(filename => galleryAccess
    ? { url: filename }
    : GalleryResolution.publicImageSource(galleryAssetUrl(filename), imageResolution));
  const existing = index === 0 && firstImage?.source.url === sources[0].url &&
    firstImage.source.fallbackUrl === sources[0].fallbackUrl ? firstImage : undefined;
  const link = existing?.link ?? document.createElement('a');
  link.className = 'shot';
  link.setAttribute('aria-label', 'Open ' + label + ' in fullscreen');
  const image = existing?.image ?? document.createElement('img');
  if (!existing) {
    link.href = galleryAccess ? '#viewer' : sources[0].url;
    image.className = 'shot-primary';
    image.alt = label;
    image.width = imageResolution === '4k' ? 3840 : 2560;
    image.height = imageResolution === '4k' ? 2160 : 1440;
    image.decoding = 'async';
    image.draggable = false;
    link.append(image);
  }
  let element = link;
  let comparison;
  if (sources.length > 1) {
    element = document.createElement('div');
    element.className = 'shot-entry';
    element.append(link);
    comparison = setupGalleryComparison(element, link, sources, index);
  }
  if (typeof viewer.showModal === 'function') {
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openViewer(index, comparison?.finishPreview() ?? 0, link, event);
    });
  }
  return { element, image, link, filenames, sources, comparison, initialLoad: existing?.load };
}

async function loadGallery() {
  const fallback = gallery.querySelector('[data-gallery-fallback]');
  galleryStatus.textContent = 'Loading gallery…';
  galleryStatus.hidden = false;
  try {
    let firstImage;
    if (fallback) {
      const image = fallback.querySelector('img');
      const pictureSource = fallback.querySelector('source');
      const source = GalleryResolution.publicImageSource(fallback.dataset.galleryOriginal, imageResolution);
      firstImage = { image, link: fallback, source, load: loadImage(image, source, { link: fallback, pictureSource }) };
    }
    const response = galleryAccess ? await galleryAccess.manifest() : await fetch(galleryAssetUrl('gallery.json'));
    if (!response.ok) throw new Error('Gallery order unavailable.');
    const entries = GalleryData.parse(await response.text());
    const restoreFocus = fallback && document.activeElement === fallback;
    shots.push(...entries.map((entry, index) => createShot(entry, index, firstImage)));
    gallery.replaceChildren(...shots.map(shot => shot.element));
    const position = readGalleryPosition();
    const restoredShot = restoreGalleryPosition(position);
    trackGalleryPosition();
    loadVisibleShotsFirst();
    const embedsReady = gallery.dataset.galleryEmbeds && typeof GalleryEmbeds !== 'undefined'
      ? GalleryEmbeds.mount(gallery, entries, shots.map(shot => shot.element),
        galleryAssetUrl(gallery.dataset.galleryEmbeds), galleryAssetUrl)
      : undefined;
    if (restoreFocus) shots[0].link.focus({ preventScroll: true });
    galleryStatus.hidden = true;

    const arrivalShot = restoredShot ?? shots[0];
    const arrivalReady = (restoredShot || window.__galleryDesktopEdgeArrived) && arrivalShot
      ? prioritizeShot(arrivalShot) : arrivalShot?.primaryLoad;
    return {
      entries,
      items: shots.map(shot => ({ element: shot.element, link: shot.link, image: shot.image, filenames: shot.filenames })),
      // Uncover the desktop gallery after the landing image and scroll offset
      // are ready, including any JPG retry / WebP fallback.
      arrivalImage: arrivalShot?.image,
      firstReady: settleGalleryPosition(position, arrivalReady, embedsReady)
    };
  } catch (error) {
    if (fallback && fallback.parentNode !== gallery) gallery.replaceChildren(fallback);
    console.error('Gallery could not be loaded', error);
    galleryStatus.textContent = 'The gallery could not be loaded. Please refresh to try again.';
  }
}

function step(amount) {
  if (shots.length < 2) return;
  showImage((current + amount + shots.length) % shots.length);
}

previousSide.addEventListener('click', () => step(-1));
nextSide.addEventListener('click', () => step(1));

viewer.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    step(event.key === 'ArrowLeft' ? -1 : 1);
  }
});

function setViewerZoom(scale, x, y) {
  const viewport = stage.getBoundingClientRect();
  const bounds = viewerImageBounds(viewport);
  const maxX = scale > 1 && viewerAspect ? Math.max(0, (bounds.width * scale - viewport.width) / 2) : 0;
  const maxY = scale > 1 && viewerAspect ? Math.max(0, (bounds.height * scale - viewport.height) / 2) : 0;
  viewerZoom.scale = scale;
  viewerZoom.x = Math.max(-maxX, Math.min(maxX, x));
  viewerZoom.y = Math.max(-maxY, Math.min(maxY, y));
  stage.classList.toggle('zoomed', scale > 1);
  canvas.style.transform = scale === 1 ? '' : `translate(${viewerZoom.x}px, ${viewerZoom.y}px) scale(${scale})`;
  viewer.dispatchEvent(new CustomEvent('gallery-zoomchange', { detail: { ...viewerZoom } }));
}

function zoomViewerAt(scale, anchor, point, from = viewerZoom) {
  const viewport = stage.getBoundingClientRect();
  const anchorX = viewport.left + viewport.width / 2;
  const anchorY = viewport.top + viewport.height / 2;
  const ratio = scale / from.scale;
  setViewerZoom(scale,
    point.x - anchorX - (anchor.x - anchorX - from.x) * ratio,
    point.y - anchorY - (anchor.y - anchorY - from.y) * ratio);
}

function pointFor(event) {
  return { x: event.clientX, y: event.clientY };
}

function clampViewerScale(scale) {
  // Round back to fit when inverse wheel ticks leave a tiny remainder.
  return scale < 1.000001 ? 1 : Math.min(scale, 4);
}

function cancelViewerZoomAnimation() {
  if (!viewerZoomAnimation) return;
  cancelAnimationFrame(viewerZoomAnimation.frame);
  viewerZoomAnimation = undefined;
}

function animateViewerZoom(time) {
  const zoom = viewerZoomAnimation;
  if (!viewer.open || !zoom) {
    viewerZoomAnimation = undefined;
    return;
  }
  const elapsed = zoom.lastFrame === undefined ? 1000 / 60 : time - zoom.lastFrame;
  zoom.lastFrame = time;
  // Ease toward the target based on elapsed time at any display refresh rate.
  const remaining = zoom.target - viewerZoom.scale;
  let amount = 1;
  if (Math.abs(remaining) >= 0.001) {
    if (zoom.filteredWheelScale === undefined) {
      amount = 1 - Math.exp(-elapsed / 40);
    } else {
      // Smooth both wheel input and the displayed scale, carrying velocity across ticks.
      const step = elapsed / 100;
      const decay = Math.exp(-step);
      const inputGap = zoom.target - zoom.filteredWheelScale;
      amount = 1 - (1 + inputGap / remaining * step) * decay;
      zoom.filteredWheelScale = zoom.target - inputGap * decay;
    }
  }
  const scale = amount === 1 ? zoom.target : viewerZoom.scale + remaining * amount;
  if (zoom.target === 1) {
    // Fit has no pan. Ease toward the center together with the scale.
    const panFactor = 1 - amount;
    setViewerZoom(scale, viewerZoom.x * panFactor, viewerZoom.y * panFactor);
  } else {
    zoomViewerAt(scale, zoom.anchor, zoom.anchor);
  }
  if (scale === zoom.target) viewerZoomAnimation = undefined;
  else zoom.frame = requestAnimationFrame(animateViewerZoom);
}

function easeViewerZoomTo(target, anchor, filteredWheelScale) {
  if (reducedMotion.matches || target === viewerZoom.scale) {
    cancelViewerZoomAnimation();
    if (target === 1) setViewerZoom(1, 0, 0);
    else zoomViewerAt(target, anchor, anchor);
  } else if (viewerZoomAnimation) {
    Object.assign(viewerZoomAnimation, { target, anchor, filteredWheelScale });
  } else {
    viewerZoomAnimation = { target, anchor, filteredWheelScale, frame: requestAnimationFrame(animateViewerZoom) };
  }
}

function zoomViewerWithWheel(event) {
  if (!viewerAspect || viewerTouches.size || mouseGesture?.panning) return;
  const mode = event.deltaMode;
  // Shift-wheel can arrive on the horizontal axis.
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  if (!delta) return;
  viewerZoomClickCount = 0;
  const unit = mode === WheelEvent.DOM_DELTA_LINE ? 16
    : mode === WheelEvent.DOM_DELTA_PAGE ? stage.clientHeight : 1;
  const previousTarget = viewerZoomAnimation?.target ?? viewerZoom.scale;
  // Keep accumulating ticks in the same direction. A reversal starts where the image is now.
  const baseScale = delta < 0 ? Math.max(viewerZoom.scale, previousTarget)
    : Math.min(viewerZoom.scale, previousTarget);
  const target = clampViewerScale(baseScale * Math.exp(-delta * unit * 0.0018));
  if (target === previousTarget) return;
  const filteredScale = baseScale === previousTarget ? viewerZoomAnimation?.filteredWheelScale : undefined;
  easeViewerZoomTo(target, pointFor(event), filteredScale ?? viewerZoom.scale);
}

function pinchGeometry() {
  const [first, second] = viewerTouches.values();
  return {
    point: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
    distance: Math.max(1, Math.hypot(first.x - second.x, first.y - second.y))
  };
}

function startViewerPinch() {
  viewerGesture = { mode: 'pinch', ...pinchGeometry(), zoom: { ...viewerZoom } };
  suppressViewerClick = true;
}

function moveViewerTouch(event) {
  const previous = viewerTouches.get(event.pointerId);
  if (!previous) return;
  const point = pointFor(event);
  viewerTouches.set(event.pointerId, point);
  if (viewerGesture.mode === 'pinch') {
    if (!viewerAspect) return;
    const next = pinchGeometry();
    const scale = clampViewerScale(viewerGesture.zoom.scale * next.distance / viewerGesture.distance);
    zoomViewerAt(scale, viewerGesture.point, next.point, viewerGesture.zoom);
    return;
  }
  const { start, mode } = viewerGesture;
  if (Math.hypot(point.x - start.x, point.y - start.y) >= 10) suppressViewerClick = true;
  if (mode === 'pan' && suppressViewerClick) {
    setViewerZoom(viewerZoom.scale, viewerZoom.x + point.x - previous.x, viewerZoom.y + point.y - previous.y);
  }
}

function endViewerTouch(event) {
  if (!viewerTouches.has(event.pointerId)) return;
  if (event.type === 'pointerup') moveViewerTouch(event);
  const { mode, start } = viewerGesture;
  viewerTouches.delete(event.pointerId);
  if (viewerTouches.size >= 2) {
    startViewerPinch();
  } else if (viewerTouches.size === 1) {
    viewerGesture = { mode: viewerZoom.scale > 1 ? 'pan' : 'hold', start: viewerTouches.values().next().value };
  } else {
    viewerGesture = undefined;
    if (mode !== 'swipe' || event.type !== 'pointerup') return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const displacement = Math.abs(dx) > Math.abs(dy) ? dx : dy;
    if (Math.abs(displacement) >= 32) step(displacement < 0 ? 1 : -1);
  }
}

function viewerHitImage(event) {
  return isInsideImage(event, viewerImageBounds());
}

// Stop a completed gesture before a hotspot or image-control button can react to its click.
stage.addEventListener('click', event => {
  if (!suppressViewerClick || event.detail === 0) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, { capture: true });

stage.addEventListener('click', event => {
  if (event.target.closest('.viewer-arrows, .comparison-indicator') || event.detail === 0) return;
  const mouseClick = lastViewerPointer === 'mouse' && event.button === 0;
  // A browser's click count can continue after we've handled a pair.
  if (mouseClick && viewerZoomClickCount && event.detail === viewerZoomClickCount + 1) {
    viewerZoomClickCount = 0;
    easeViewerZoomTo(1);
    return;
  }
  if (!viewerHitImage(event)) {
    viewer.close();
    return;
  }
  if (!mouseClick) return;
  viewerZoomClickCount = event.detail;
  const scale = viewerZoomAnimation?.target ?? viewerZoom.scale;
  easeViewerZoomTo(scale > 1 ? 1 : 2, pointFor(event));
});

stage.addEventListener('auxclick', event => {
  if (event.button === 1) event.preventDefault();
});

stage.addEventListener('contextmenu', event => {
  if (viewerZoom.scale > 1 && lastViewerPointer === 'mouse' && event.button === 2) {
    event.preventDefault();
  }
});

stage.addEventListener('pointerdown', event => {
  lastViewerPointer = event.pointerType;
  if (event.pointerType !== 'mouse' || event.button !== 0) {
    viewerZoomClickCount = 0;
    cancelViewerZoomAnimation();
  }
  if (event.pointerType === 'touch') {
    const point = pointFor(event);
    if (!viewerTouches.size) {
      suppressViewerClick = false;
      viewerGesture = { mode: viewerZoom.scale > 1 ? 'pan' : 'swipe', start: point };
    }
    viewerTouches.set(event.pointerId, point);
    if (viewerTouches.size === 2) startViewerPinch();
    event.target.setPointerCapture(event.pointerId);
    return;
  }
  suppressViewerClick = false;
  if (event.pointerType !== 'mouse' || ![0, 1, 2].includes(event.button)) return;
  const panning = event.button !== 0;
  // The middle button would trigger browser autoscroll even at fit.
  if (event.button === 1 || (panning && viewerZoom.scale > 1)) event.preventDefault();
  if (panning) {
    if (viewerZoom.scale === 1) return;
    stage.setPointerCapture(event.pointerId);
    stage.classList.add('dragging');
  }
  mouseGesture = {
    id: event.pointerId, start: pointFor(event), panning, buttonMask: event.buttons,
    x: viewerZoom.x, y: viewerZoom.y
  };
});

stage.addEventListener('pointermove', event => {
  if (event.pointerType === 'touch') {
    moveViewerTouch(event);
    return;
  }
  if (mouseGesture?.id !== event.pointerId) return;
  if (!(event.buttons & mouseGesture.buttonMask)) return;
  const dx = event.clientX - mouseGesture.start.x;
  const dy = event.clientY - mouseGesture.start.y;
  if (Math.hypot(dx, dy) > 5) suppressViewerClick = true;
  if (mouseGesture.panning && suppressViewerClick) {
    setViewerZoom(viewerZoom.scale, mouseGesture.x + dx, mouseGesture.y + dy);
  }
});

for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  stage.addEventListener(type, event => {
    endViewerTouch(event);
    if (mouseGesture?.id !== event.pointerId) return;
    mouseGesture = undefined;
    stage.classList.remove('dragging');
  });
}

frame.addEventListener('pointermove', compareAtPointer);
frame.addEventListener('pointerleave', event => {
  if (viewerZoom.scale > 1 || !canCompare(event)) return;
  openingPointer = null;
  viewerHover = null;
  comparisonIndex = selectedComparison;
  updateComparison();
});

frame.addEventListener('wheel', event => {
  if (!viewer.open || event.metaKey) return;
  if (event.ctrlKey || event.shiftKey || event.altKey) {
    if (!desktopScrolling.matches) return;
    if (event.cancelable) event.preventDefault();
    zoomViewerWithWheel(event);
    return;
  }
  if (!event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
  event.preventDefault();
  const direction = Math.sign(event.deltaY);
  const now = event.timeStamp;
  if (!viewerWheel || viewerWheel.direction !== direction || now - viewerWheel.lastEvent >= 150) {
    viewerWheel = { direction, accumulated: 0, lastStep: -Infinity };
  }
  viewerWheel.lastEvent = now;
  if (now - viewerWheel.lastStep < 120) return;
  viewerWheel.accumulated += event.deltaMode ? 24 : Math.abs(event.deltaY);
  if (viewerWheel.accumulated < 24) return;
  viewerWheel.accumulated = 0;
  viewerWheel.lastStep = now;
  step(direction);
}, { passive: false });

async function setFullscreen(enabled) {
  if (!fullscreenSupported) return;
  try {
    if (enabled) await frame.requestFullscreen();
    else await document.exitFullscreen();
  } catch (error) {
    console.warn('Fullscreen request failed', error);
  }
}

fullscreen.addEventListener('click', () => viewer.close());
document.addEventListener('fullscreenchange', () => {
  const isFullscreen = document.fullscreenElement === frame;
  fullscreen.textContent = isFullscreen ? 'Exit fullscreen' : 'Back to gallery';
  if (fullscreenActive && !isFullscreen && viewer.open) viewer.close();
  fullscreenActive = isFullscreen;
  if (isFullscreen && !viewer.open) void setFullscreen(false);
});

viewer.addEventListener('close', async () => {
  if (viewer.open) return;
  const origin = viewerOrigin;
  viewerOrigin = undefined;
  const fullscreenExit = document.fullscreenElement === frame ? setFullscreen(false) : undefined;
  const request = ++viewerRequest;
  viewerTouches.clear();
  viewerGesture = viewerWheel = mouseGesture = undefined;
  lastViewerPointer = undefined;
  viewerAspect = 0;
  suppressViewerClick = false;
  stage.classList.remove('dragging');
  comparisonsInitialized = false;
  viewerIndicator?.remove();
  viewerIndicator = null;
  original.removeAttribute('src');
  fitImage();
  if (!origin) return;
  const navigated = current !== origin.index;
  const target = navigated ? shots[current]?.link : origin.link;
  await fullscreenExit;
  const deadline = performance.now() + 600;
  function restore(time) {
    if (viewer.open || request !== viewerRequest || !target?.isConnected) return;
    // The fullscreen promise can settle before the windowed viewport is restored.
    if (navigated && time < deadline &&
        (window.innerWidth !== origin.width || window.innerHeight !== origin.height)) {
      requestAnimationFrame(restore);
      return;
    }
    if (navigated) {
      const smoother = window.ScrollSmoother?.get?.();
      if (smoother?.content().contains(target)) smoother.scrollTo(target, false, 'center center');
      else target.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
    }
    if (origin.pointerOpened) {
      target.classList.add('viewer-return-focus');
      target.addEventListener('blur', () => target.classList.remove('viewer-return-focus'), { once: true });
    }
    target.focus({ preventScroll: true });
  }
  requestAnimationFrame(restore);
});

function openViewer(index, variant = 0, source = shots[index].link, event) {
  if (typeof viewer.showModal !== 'function') return false;
  if (!viewer.open) {
    viewerOrigin = {
      index, link: source, pointerOpened: event?.detail > 0,
      width: window.innerWidth, height: window.innerHeight
    };
    openingPointer = event ? { x: event.screenX, y: event.screenY } : null;
  }
  showImage(index, variant);
  if (!viewer.open) viewer.showModal();
  if (document.fullscreenElement !== frame) void setFullscreen(true);
  return true;
}

function findGalleryImage(filename) {
  for (let index = 0; index < shots.length; index++) {
    const variant = shots[index].filenames.indexOf(filename);
    if (variant >= 0) return { index, variant, shot: shots[index] };
  }
  return null;
}

// The map uses the same renderer, image loading and fullscreen controls as a normal gallery.
window.GalleryViewer = {
  ready: loadGallery(),
  openImage(filename, { opener: source, event } = {}) {
    const found = findGalleryImage(filename);
    return found ? openViewer(found.index, found.variant, source || found.shot.link, event) : false;
  },
  selectImage(filename) {
    const found = findGalleryImage(filename);
    if (!found) return false;
    found.shot.comparison?.select(found.variant);
    return true;
  },
  close() { viewer.close(); }
};

'use strict';

const galleryContent = document.querySelector('.gallery-content, .gallery-map-page');
const gallery = document.querySelector('.gallery');
const galleryRevision = document.body.dataset.galleryRevision;
const galleryAccess = window.galleryAccess;
const imageResolution = galleryAccess?.resolution ?? GalleryResolution.current();
const galleryAssetVersions = JSON.parse(document.body.dataset.galleryAssetVersions || '{}');
const title = document.querySelector('.intro h1, #map-title').textContent;

const finePointer = window.matchMedia('(pointer: fine)');
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
if (window.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0) {
  const mobileScrollScript = document.createElement('script');
  mobileScrollScript.src = new URL('./gallery-mobile-scroll.js?v=1', document.currentScript.src).href;
  mobileScrollScript.addEventListener('load', () => {
    window.GalleryMobileScroll?.start({ gallery, viewer });
  }, { once: true });
  document.head.append(mobileScrollScript);
}
const frame = document.querySelector('#viewer-frame');
const stage = document.querySelector('#stage');
const original = document.querySelector('#original');
original.fetchPriority = 'high';
const previousSide = document.querySelector('#previous-side');
const nextSide = document.querySelector('#next-side');
const counter = document.querySelector('#counter');
const fullscreen = document.querySelector('#fullscreen');
const fullscreenSupported = document.fullscreenEnabled && typeof frame.requestFullscreen === 'function';
const status = document.querySelector('#status');
let current = 0;
let opener;
let drag;
let didDrag = false;
let viewerRequest = 0;
let comparisonsInitialized = false;
let viewerHover = null;
let comparisonIndex = 0;
let selectedComparison = 0;
let displayedComparison = 0;
let viewerIndicator;
let openingPointer;
let pointerOpened = false;
let fullscreenActive = false;
const imageRetryDelay = 1000;
const foregroundLoads = new Set();
let nextBackgroundIndex = 0;
let backgroundLoading = false;

function setupClassicGalleryScroll() {
  if (gallery.hasAttribute('data-native-gallery-scroll')) return;
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
  positionViewerIndicator();
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
    frame.append(viewerIndicator);
  }
  fitImage();
  previousSide.disabled = nextSide.disabled = shots.length < 2;
  counter.textContent = (index + 1) + ' / ' + shots.length;
  showStatus('Loading image…');
  const selectedImage = initialVariant === 0 ? image : shot.comparison.getImage(initialVariant, true);
  if (selectedImage?.naturalWidth) {
    displayOriginal(selectedImage);
  } else if (!sources[0].fallbackUrl) {
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
  viewer.dispatchEvent(new CustomEvent('gallery-imagechange', {
    detail: { filename: shot.filenames[displayed], index: current, variant: displayed }
  }));
  showStatus('');
  if (viewerIndicator) {
    displayedComparison = displayed;
    setActiveSegment(viewerIndicator, displayedComparison);
    viewerIndicator.hidden = false;
    positionViewerIndicator();
  }
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

function comparisonAt(x, left, width, count) {
  return Math.min(count - 1, Math.max(0, Math.floor((x - left) * count / width)));
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
      if (gesture.axis === 'vertical' && !gesture.navigate) {
        gesture = undefined;
        return;
      }
    }
    if (event.type !== 'pointerup') return;
    if (gesture.axis === 'vertical') {
      if (Math.abs(dy) >= 32 && Math.abs(dy) > Math.abs(dx)) gesture.navigate(dy < 0 ? 1 : -1);
    } else if (gesture.count > 1 && Math.abs(dx) >= 32 && Math.abs(dx) > Math.abs(dy)) {
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
  if (!comparisonsInitialized || !original.naturalWidth || !canCompare(event)) return;
  if (openingPointer && event.screenX === openingPointer.x && event.screenY === openingPointer.y) return;
  openingPointer = null;
  const bounds = viewerImageBounds();
  const hovered = isInsideImage(event, bounds)
    ? comparisonAt(event.clientX, bounds.left, bounds.width, shots[current].sources.length)
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

  link.addEventListener('pointermove', event => {
    if (!canCompare(event)) return;
    const rect = link.getBoundingClientRect();
    const index = comparisonAt(event.clientX, rect.left, rect.width, sources.length);
    if (index === hovered) return;
    hovered = index;
    preview(index);
  });
  link.addEventListener('pointerleave', () => { hovered = null; });
  entry.addEventListener('pointerleave', event => {
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
    loadVisibleShotsFirst();
    if (gallery.dataset.galleryEmbeds && typeof GalleryEmbeds !== 'undefined') {
      void GalleryEmbeds.mount(gallery, entries, shots.map(shot => shot.element),
        galleryAssetUrl(gallery.dataset.galleryEmbeds), galleryAssetUrl);
    }
    if (restoreFocus) shots[0].link.focus({ preventScroll: true });
    galleryStatus.hidden = true;
    return {
      entries,
      items: shots.map(shot => ({ element: shot.element, link: shot.link, image: shot.image, filenames: shot.filenames })),
      // On a desktop gallery handoff, reveal only after its first image has
      // completed the normal JPG retry / WebP fallback path.
      firstReady: window.__galleryDesktopEdgeArrived && shots[0]
        ? prioritizeShot(shots[0]) : shots[0]?.primaryLoad
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
  if (stage.classList.contains('native') && event.target === stage) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    step(event.key === 'ArrowLeft' ? -1 : 1);
  }
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
  openingPointer = null;
  viewerHover = null;
  comparisonIndex = selectedComparison;
  updateComparison();
});

setupImageTouch(stage, event => {
  if (!viewer.open || stage.classList.contains('native')) return;
  if (!comparisonsInitialized || !original.naturalWidth) return { navigate: step };
  const bounds = viewerImageBounds();
  if (!isInsideImage(event, bounds)) return { navigate: step };
  return {
    count: shots[current].sources.length,
    index: displayedComparison,
    select: selectViewerComparison,
    navigate: step
  };
});

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

viewer.addEventListener('close', () => {
  if (document.fullscreenElement === frame) void setFullscreen(false);
  viewerRequest++;
  comparisonsInitialized = false;
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

function openViewer(index, variant = 0, source = shots[index].link, event) {
  if (typeof viewer.showModal !== 'function') return false;
  if (!viewer.open) {
    opener = source;
    pointerOpened = event?.detail > 0;
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

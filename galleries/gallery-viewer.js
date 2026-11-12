'use strict';

const galleryContent = document.querySelector('.gallery-content');
const gallery = document.querySelector('.gallery');
const title = document.querySelector('.intro h1').textContent;

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
let openingPointer;
let pointerOpened = false;
let fullscreenActive = false;
let keepViewerOpen = false;

function fitImage() {
  stage.classList.remove('native');
  stage.scrollTo(0, 0);
  zoom.textContent = '100%';
}

function showStatus(message) {
  status.textContent = message;
  status.hidden = !message;
}

function showImage(index) {
  current = index;
  comparisons = [];
  comparisonIndex = 0;
  fitImage();
  zoom.disabled = true;
  previous.disabled = previousSide.disabled = next.disabled = nextSide.disabled = shots.length < 2;
  counter.textContent = (index + 1) + ' / ' + shots.length;
  original.alt = shots[index].image.alt;
  showStatus('Loading 4K image…');
  original.src = shots[index].sources[0];
  if (original.complete && original.naturalWidth) imageLoaded();
}

function imageLoaded() {
  zoom.disabled = false;
  showStatus('');
  const { sources } = shots[current];
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

function canCompare(event) {
  return (event.pointerType === 'mouse' || event.pointerType === 'pen') && !event.buttons;
}

function comparisonAt(x, left, width, count) {
  return Math.min(count - 1, Math.max(0, Math.floor((x - left) * count / width)));
}

function compareAtPointer(event) {
  if (!comparisons.length || !canCompare(event)) return;
  if (openingPointer && event.screenX === openingPointer.x && event.screenY === openingPointer.y) return;
  openingPointer = null;
  const rect = original.getBoundingClientRect();
  const ratio = original.naturalWidth / original.naturalHeight;
  const native = stage.classList.contains('native');
  const width = native ? rect.width : Math.min(rect.width, rect.height * ratio);
  const height = native ? rect.height : width / ratio;
  const left = rect.left + (rect.width - width) / 2;
  const top = rect.top + (rect.height - height) / 2;
  const inside = event.clientX >= left && event.clientX < left + width &&
    event.clientY >= top && event.clientY < top + height;
  comparisonIndex = inside ? comparisonAt(event.clientX, left, width, comparisons.length + 1) : 0;
  updateComparison();
}

original.addEventListener('load', imageLoaded);
original.addEventListener('error', () => {
  zoom.disabled = true;
  showStatus('This image could not be loaded.');
});

function setupGalleryComparison(link, sources) {
  const alternates = [];
  let active = 0;

  function select(index) {
    if (index === active) return;
    alternates[active]?.classList.remove('is-visible');
    active = index;
    if (index === 0) return;

    let alternate = alternates[index];
    if (!alternate) {
      alternate = new Image();
      alternate.className = 'shot-comparison';
      alternate.alt = '';
      alternate.setAttribute('aria-hidden', 'true');
      alternate.draggable = false;
      alternate.addEventListener('load', () => {
        alternate.classList.toggle('is-visible', active === index);
      }, { once: true });
      alternates[index] = alternate;
      alternate.src = sources[index];
      link.append(alternate);
    }
    if (alternate.naturalWidth) alternate.classList.add('is-visible');
  }

  link.addEventListener('pointermove', event => {
    if (!canCompare(event)) return;
    const rect = link.getBoundingClientRect();
    select(comparisonAt(event.clientX, rect.left, rect.width, sources.length));
  });

  const reset = () => select(0);
  link.addEventListener('pointerleave', reset);
  return reset;
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
  if (index === 0) image.fetchPriority = 'high';
  else image.loading = 'lazy';
  image.src = sources[0];
  link.append(image);
  const resetComparison = sources.length > 1 ? setupGalleryComparison(link, sources) : null;
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
  return { link, image, sources };
}

async function loadGallery() {
  try {
    const response = await fetch('gallery.json');
    if (!response.ok) throw new Error('Gallery order unavailable.');
    const entries = GalleryData.parse(await response.text());
    shots.push(...entries.map(createShot));
    gallery.append(...shots.map(shot => shot.link));
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

stage.addEventListener('pointerleave', () => {
  comparisonIndex = 0;
  updateComparison();
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

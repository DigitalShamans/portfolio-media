(function () {
  'use strict';

  // The outgoing slide completely covers the page at navigation time. Recreate
  // the same cover before the destination's first paint, so no document swap,
  // loading status, or incomplete gallery can show through.
  const key = 'gallery-desktop-edge-arrival';
  let arrival;
  try {
    const stored = window.sessionStorage.getItem(key);
    if (!stored) return;
    window.sessionStorage.removeItem(key);
    arrival = JSON.parse(stored);
  } catch { return; }

  const now = Date.now();
  // Older Hard Bullet markers have no loop field; keep their original behavior.
  const loop = arrival?.loop ?? 'hard-bullet';
  const validRoute = loop === 'hard-bullet'
    ? /^\/(?:artur\/)?galleries\/hb-[a-z0-9-]+\/$/.test(arrival?.pathname)
    : loop === 'full' && /^\/artur\/galleries\/(?!hb-)[a-z0-9-]+\/$/.test(arrival?.pathname);
  if (!arrival || !['next', 'previous'].includes(arrival.direction) ||
      arrival.pathname !== window.location.pathname || !validRoute ||
      !Number.isFinite(arrival.at) || now < arrival.at || now - arrival.at > 10000 ||
      typeof arrival.title !== 'string' || !arrival.title || arrival.title.length > 160) return;

  // Still disarm stationary edge pointers on arrival, including reduced motion.
  window.__galleryDesktopEdgeArrived = true;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const host = document.currentScript?.parentElement;
  if (!host || host.id !== 'gallery-edge-arrival') return;

  const panel = document.createElement('div');
  panel.className = 'gallery-desktop-edge-panel gallery-desktop-edge-panel--arrival';
  panel.setAttribute('aria-hidden', 'true');
  const content = document.createElement('div');
  content.className = 'gallery-desktop-edge-panel__content';
  const eyebrow = document.createElement('p');
  eyebrow.textContent = loop === 'full' ? 'Full Portfolio' : 'Hard Bullet';
  const heading = document.createElement('h2');
  heading.textContent = arrival.title;
  content.append(eyebrow, heading);
  panel.append(content);

  // Match the outgoing panel geometry before parsing the real site header.
  const height = arrival.headerHeight;
  if (Number.isFinite(height) && height >= 0 && height <= 400) {
    panel.style.top = Math.ceil(height) + 'px';
  }
  document.body.classList.add('gallery-edge-header-visible');
  host.append(panel);

  let finished = false;
  let deadline;
  function reveal() {
    if (finished) return;
    finished = true;
    clearTimeout(deadline);
    panel.remove();
    document.body.classList.remove('gallery-edge-header-visible');
  }
  // A failed manifest/image must never leave an uncloseable cover on the site.
  deadline = setTimeout(reveal, 7500);

  // Chrome holds the old document snapshot through the new document's first
  // render. Wait until its incoming snapshot is ready before clearing the cover.
  const snapshotReady = 'onpagereveal' in window
    ? new Promise(resolve => window.addEventListener('pagereveal', event => {
      Promise.resolve(event.viewTransition?.ready).then(resolve, resolve);
    }, { once: true }))
    : Promise.resolve();

  async function galleryReady() {
    // The RZ Start password gate has no public image or manifest to await.
    if (document.querySelector('#gallery-access')) return;
    const loaded = window.GalleryViewer?.ready;
    if (!loaded || typeof loaded.then !== 'function') return;
    const result = await loaded;
    if (result?.firstReady) await result.firstReady;
    const image = result?.items?.[0]?.image;
    if (image?.naturalWidth && typeof image.decode === 'function') {
      await image.decode().catch(() => {});
    }
  }

  function nextPaint() {
    if (document.hidden) return Promise.resolve();
    return new Promise(resolve => window.requestAnimationFrame(
      () => window.requestAnimationFrame(resolve)));
  }

  document.addEventListener('DOMContentLoaded', () => {
    Promise.all([snapshotReady, galleryReady()])
      .then(nextPaint).then(reveal, reveal);
  }, { once: true });
}());

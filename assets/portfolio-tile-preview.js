(() => {
  'use strict';

  const cards = [...document.querySelectorAll('#full-portfolio .portfolio-card[data-gallery-preview]')];
  if (!cards.length) return;
  const hover = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const diagnostics = window.PortfolioDiagnostics;
  const feature = 'portfolio-preview';
  const diagnosticsEnabled = () => diagnostics && window.PortfolioDiagnostics === diagnostics;
  const hoverDelay = 400;
  const closeDeadline = 330;
  const cache = new Map();
  const replacementChecks = new Map();
  const layer = document.createElement('div');
  layer.className = 'portfolio-tile-preview';
  layer.hidden = true;
  layer.inert = true;
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);

  let intent, active, hoverTimer, closeTimer, reportFrame, reportedAction;

  function reportReady() {
    if (!diagnosticsEnabled()) return;
    diagnostics.state(feature, !hover.matches ? 'Hover previews unavailable' :
      reducedMotion.matches ? 'Reduced motion' : 'CSS hover previews',
    !hover.matches ? 'Tile links open normally on touch devices.' :
      reducedMotion.matches ? 'The first gallery image appears without animation after a 400 ms hover.' :
        'Hover a Full Portfolio tile for 400 ms to preview its first gallery image.');
  }

  function stopReport(completed) {
    if (!reportedAction) return;
    const action = reportedAction;
    reportedAction = undefined;
    if (reportFrame !== undefined) cancelAnimationFrame(reportFrame);
    reportFrame = undefined;
    if (!diagnosticsEnabled()) return;
    if (completed) diagnostics.sample(feature, layer.getBoundingClientRect().width);
    diagnostics.event(feature, completed ? 'CSS completed' : 'CSS interrupted', { action });
    diagnostics.state(feature, 'CSS hover previews', 'Last ' +
      (completed ? 'completed' : 'interrupted') + ': preview ' + action + '.');
  }

  function sampleMotion() {
    reportFrame = undefined;
    if (!diagnosticsEnabled() || !reportedAction) return;
    diagnostics.sample(feature, layer.getBoundingClientRect().width);
    reportFrame = requestAnimationFrame(sampleMotion);
  }

  if (diagnostics) {
    layer.addEventListener('transitionrun', event => {
      if (!diagnosticsEnabled() || event.target !== layer || event.propertyName !== 'transform') return;
      stopReport(false);
      reportedAction = layer.classList.contains('is-open') ? 'enlarge' : 'shrink';
      diagnostics.event(feature, reportedAction === 'enlarge' ? 'CSS enlargements' : 'CSS shrinks');
      diagnostics.state(feature, 'CSS hover previews',
        reportedAction === 'enlarge' ? 'Enlarging the first gallery image.' : 'Shrinking the gallery preview.');
      diagnostics.sample(feature, layer.getBoundingClientRect().width);
      reportFrame = requestAnimationFrame(sampleMotion);
    });
    layer.addEventListener('transitioncancel', event => {
      if (event.target === layer && event.propertyName === 'transform') stopReport(false);
    });
  }

  function loadImage(url) {
    if (cache.has(url)) {
      const entry = cache.get(url);
      cache.delete(url);
      cache.set(url, entry);
      return entry;
    }
    const image = new Image();
    image.alt = '';
    image.decoding = 'async';
    image.draggable = false;
    const entry = new Promise(resolve => {
      image.addEventListener('load', async () => {
        try { await image.decode(); } catch { /* A loaded image remains usable if decode is unsupported. */ }
        resolve(image.naturalWidth && image.naturalHeight ? image : null);
      }, { once: true });
      image.addEventListener('error', () => {
        if (cache.get(url) === entry) cache.delete(url);
        resolve(null);
      }, { once: true });
    });
    cache.set(url, entry);
    // Keep only a few decoded previews; the browser still manages its HTTP cache.
    while (cache.size > 4) cache.delete(cache.keys().next().value);
    image.src = url;
    return entry;
  }

  async function loadPreview(card) {
    const original = card.dataset.galleryPreviewOriginal;
    if (!original || typeof GalleryResolution === 'undefined') return loadImage(card.dataset.galleryPreview);

    let check = replacementChecks.get(original);
    const now = performance.now();
    if (!check || now - check.started >= 30_000) {
      check = { started: now, ready: GalleryResolution.refreshPublicImageUpdates(original) };
      replacementChecks.set(original, check);
    }
    await check.ready;
    const { url, fallbackUrl } = GalleryResolution.publicImageSource(original, '1440p');
    const image = await loadImage(url);
    return image ?? (fallbackUrl ? loadImage(fallbackUrl) : null);
  }

  function setOrigin(card) {
    const bounds = card.getBoundingClientRect();
    const width = Number.parseFloat(layer.style.width);
    const height = Number.parseFloat(layer.style.height);
    const left = Number.parseFloat(layer.style.left);
    const top = Number.parseFloat(layer.style.top);
    layer.style.setProperty('--preview-origin-x', bounds.left + bounds.width / 2 - left - width / 2 + 'px');
    layer.style.setProperty('--preview-origin-y', bounds.top + bounds.height / 2 - top - height / 2 + 'px');
    layer.style.setProperty('--preview-origin-scale', Math.min(1, bounds.width / width, bounds.height / height));
  }

  function place(card, image) {
    const width = window.innerWidth * .6;
    const gap = 16;
    const headerBottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0;
    const topEdge = Math.max(gap, Math.min(window.innerHeight - gap, headerBottom + gap));
    const availableHeight = Math.max(1, window.innerHeight - topEdge - gap);
    const height = Math.min(width * image.naturalHeight / image.naturalWidth, availableHeight);
    layer.style.width = width + 'px';
    layer.style.height = height + 'px';
    layer.style.left = (window.innerWidth - width) / 2 + 'px';
    layer.style.top = topEdge + (availableHeight - height) / 2 + 'px';
    setOrigin(card);
  }

  function finishClose() {
    clearTimeout(closeTimer);
    closeTimer = undefined;
    stopReport(false);
    layer.hidden = true;
    layer.classList.remove('is-open');
    layer.replaceChildren();
    active = undefined;
  }

  function close(immediate = false) {
    if (!active) return;
    if (immediate) { finishClose(); return; }
    if (!layer.classList.contains('is-open')) return;
    setOrigin(active.card);
    layer.classList.remove('is-open');
    if (reducedMotion.matches) {
      if (diagnosticsEnabled()) diagnostics.event(feature, 'instant changes', { action: 'shrink' });
      finishClose();
    } else closeTimer = setTimeout(finishClose, closeDeadline);
  }

  layer.addEventListener('transitionend', event => {
    if (event.target !== layer || event.propertyName !== 'transform') return;
    stopReport(true);
    if (!layer.classList.contains('is-open')) finishClose();
  });

  function cancelIntent() {
    clearTimeout(hoverTimer);
    hoverTimer = undefined;
    intent = undefined;
  }

  function reset() {
    cancelIntent();
    close(true);
  }

  function open(request) {
    if (intent !== request || !request.dwelled || !request.image || !hover.matches ||
        document.hidden || !request.card.isConnected || !request.card.matches(':hover')) return;
    finishClose();
    active = request;
    place(request.card, request.image);
    layer.replaceChildren(request.image);
    layer.hidden = false;
    // Establish the tile-sized CSS state before the browser transitions to the preview.
    layer.getBoundingClientRect();
    layer.classList.add('is-open');
    if (reducedMotion.matches && diagnosticsEnabled()) diagnostics.event(feature, 'instant changes', { action: 'enlarge' });
  }

  function waitForHover(request) {
    clearTimeout(hoverTimer);
    request.dwelled = false;
    hoverTimer = setTimeout(() => {
      hoverTimer = undefined;
      if (intent !== request) return;
      request.dwelled = true;
      open(request);
    }, hoverDelay);
  }

  function enter(card, event) {
    if (!hover.matches || event.pointerType === 'touch' || event.buttons || intent?.card === card) return;
    cancelIntent();
    close();
    const request = intent = { card, dwelled: false, image: null };
    waitForHover(request);
    loadPreview(card).then(image => {
      if (intent !== request) return;
      request.image = image;
      if (!image && diagnosticsEnabled()) diagnostics.event(feature, 'preview image unavailable');
      open(request);
    });
  }

  for (const card of cards) {
    card.addEventListener('pointerenter', event => enter(card, event));
    card.addEventListener('pointerleave', () => {
      if (intent?.card === card) cancelIntent();
      if (active?.card === card) close();
    });
  }
  // These observers never prevent scrolling or change an anchor's click behavior.
  document.addEventListener('pointerdown', reset, { capture: true, passive: true });
  document.addEventListener('scroll', () => {
    if (active && active === intent) cancelIntent();
    close(true);
    // A pointer that enters a tile during eased scrolling can dwell once it settles.
    if (intent) waitForHover(intent);
  }, { capture: true, passive: true });
  window.addEventListener('wheel', reset, { capture: true, passive: true });
  window.addEventListener('resize', reset);
  window.addEventListener('blur', reset);
  window.addEventListener('pagehide', reset);
  window.addEventListener('pageshow', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') reset(); });
  hover.addEventListener('change', () => { reset(); reportReady(); });
  reducedMotion.addEventListener('change', () => { reset(); reportReady(); });
  reportReady();
})();

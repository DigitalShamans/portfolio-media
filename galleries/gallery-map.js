'use strict';

const GalleryMap = (() => {
  function mount(stage, map, resolveImage, { interactive = true, caption, help, onNavigate, navigateOnClick = true, previewSize = 1 } = {}) {
    const cleanup = [];
    const listen = (target, type, handler) => { target.addEventListener(type, handler); cleanup.push(() => target.removeEventListener(type, handler)); };
    const navigationEnabled = interactive && navigateOnClick && typeof onNavigate === 'function';
    const previewRatio = Number.isFinite(previewSize) ? Math.max(.2, Math.min(1, previewSize)) : 1;
    function picture(name, alt, primary = false, lazy = false) {
      const source = resolveImage(name);
      const picture = document.createElement('picture');
      if (source.original && source.media) {
        const wide = document.createElement('source');
        wide.media = source.media; wide.srcset = source.original;
        picture.append(wide);
      }
      const image = document.createElement('img');
      image.alt = alt; image.src = source.src; image.width = 2560; image.height = 1440;
      image.draggable = false; image.decoding = 'async';
      if (primary) image.fetchPriority = 'high';
      if (lazy) image.loading = 'lazy';
      image.addEventListener('error', () => {
        if (picture.querySelector('source')) {
          picture.querySelectorAll('source').forEach(item => item.remove());
          image.src = source.src;
        }
      });
      picture.append(image);
      return picture;
    }
    stage.replaceChildren();
    stage.classList.add('gallery-map-stage');
    stage.classList.remove('has-open-region');
    stage.classList.toggle('has-gallery-links', navigationEnabled);
    if (!map.overview.image) {
      const placeholder = document.createElement('p'); placeholder.className = 'gallery-map-placeholder';
      placeholder.textContent = 'Choose an overview image to start your map.'; stage.append(placeholder);
      return { cards: [], destroy() { stage.replaceChildren(); } };
    }
    const base = picture(map.overview.image, map.overview.alt || 'Level overview', true);
    base.className = 'gallery-map-base'; stage.append(base);
    const cards = map.regions.map(region => {
      const card = document.createElement('button'); card.type = 'button'; card.className = 'gallery-map-region';
      card.style.setProperty('--x', region.x + '%'); card.style.setProperty('--y', region.y + '%');
      card.dataset.x = region.x; card.dataset.y = region.y;
      card.setAttribute('aria-label', (navigationEnabled ? 'View ' : interactive ? 'Enlarge ' : 'Move ') + region.label + ' screenshot');
      card.setAttribute('aria-expanded', 'false');
      card.append(picture(region.image, region.label)); stage.append(card); return card;
    });
    if (!interactive) return { cards, destroy() { stage.replaceChildren(); } };

    const hover = matchMedia('(hover: hover) and (pointer: fine)');
    const blocked = new Set();
    let active = null, mode = null, pointer = null;
    const hoverDelay = 400;
    let pendingCard = null, hoverTimer;
    function cancelPendingHover() {
      clearTimeout(hoverTimer);
      hoverTimer = undefined; pendingCard = null;
    }
    const updateHelp = () => {
      if (!help) return;
      help.textContent = navigationEnabled
        ? (hover.matches ? 'Hover to enlarge. Click to scroll to the screenshot below.' : 'Tap to preview. Tap the enlarged screenshot again to scroll to it.')
        : (hover.matches ? 'Hover a screenshot to enlarge it. Move away from its thumbnail position to return.' : 'Tap a screenshot to enlarge it. Tap again or outside it to return.');
    };
    function geometry(card) {
      const width = stage.clientWidth, height = stage.clientHeight;
      const thumbWidth = width * .2, thumbHeight = thumbWidth * 9 / 16;
      const anchorX = width * Math.max(10, Math.min(90, Number(card.dataset.x))) / 100;
      const anchorY = height * Math.max(10, Math.min(90, Number(card.dataset.y))) / 100;
      const scale = Math.min(5, width / thumbWidth, height / thumbHeight) * previewRatio;
      const panelWidth = thumbWidth * scale, panelHeight = thumbHeight * scale;
      const x = width / 2, y = height / 2;
      const board = stage.getBoundingClientRect(), left = board.left + stage.clientLeft, top = board.top + stage.clientTop;
      // Keep the hover area centred on the original thumbnail, matching the reference.
      // Clip it at the map edges without shifting its centre towards the image centre.
      const hoverLeft = Math.max(0, anchorX - width * .225);
      const hoverTop = Math.max(0, anchorY - height * .27);
      const hoverRight = Math.min(width, anchorX + width * .225);
      const hoverBottom = Math.min(height, anchorY + height * .27);
      return { scale, shiftX: x - anchorX, shiftY: y - anchorY,
        expanded: { left: left + x - panelWidth / 2, top: top + y - panelHeight / 2, width: panelWidth, height: panelHeight },
        hoverArea: { left: left + hoverLeft, top: top + hoverTop, width: hoverRight - hoverLeft, height: hoverBottom - hoverTop },
        thumb: { left: left + anchorX - thumbWidth / 2, top: top + anchorY - thumbHeight / 2, width: thumbWidth, height: thumbHeight } };
    }
    const edgeDistance = (point, rect) => Math.min(point.x - rect.left, rect.left + rect.width - point.x, point.y - rect.top, rect.top + rect.height - point.y);
    function close(block = false) {
      cancelPendingHover();
      if (!active) return;
      const card = active; if (block) blocked.add(card);
      active = null; mode = null;
      card.classList.remove('is-open'); card.setAttribute('aria-expanded', 'false');
      for (const property of ['--scale', '--shift-x', '--shift-y']) card.style.removeProperty(property);
      stage.classList.remove('has-open-region'); if (caption) caption.textContent = 'Whole-level overview';
    }
    function place(card) {
      const layout = geometry(card); card.style.setProperty('--scale', layout.scale);
      card.style.setProperty('--shift-x', layout.shiftX + 'px'); card.style.setProperty('--shift-y', layout.shiftY + 'px'); return layout;
    }
    function open(card, inputMode) {
      if (active === card) return; close(); active = card; mode = inputMode;
      place(card);
      card.classList.add('is-open'); card.setAttribute('aria-expanded', 'true'); stage.classList.add('has-open-region');
      if (caption) caption.textContent = map.regions[cards.indexOf(card)].label;
    }
    function scheduleHover(card) {
      if (pendingCard === card) return;
      cancelPendingHover();
      if (!card) return;
      pendingCard = card;
      hoverTimer = setTimeout(() => {
        pendingCard = null; hoverTimer = undefined;
        if (hover.matches && !active && pointer && !blocked.has(card) && edgeDistance(pointer, geometry(card).thumb) >= 0) open(card, 'pointer');
      }, hoverDelay);
    }
    function checkHoverPosition() {
      if (!pointer) return;
      if (pendingCard && edgeDistance(pointer, geometry(pendingCard).thumb) < 0) cancelPendingHover();
      if (active && mode === 'pointer' && edgeDistance(pointer, geometry(active).hoverArea) <= 0) close(true);
    }
    listen(stage, 'pointermove', event => {
      if (!hover.matches || event.pointerType === 'touch') return;
      pointer = { x: event.clientX, y: event.clientY };
      for (const card of blocked) if (edgeDistance(pointer, geometry(card).thumb) < 0) blocked.delete(card);
      if (active) {
        if (mode !== 'pointer') return;
        checkHoverPosition();
      } else {
        const card = cards.find(item => !blocked.has(item) && edgeDistance(pointer, geometry(item).thumb) >= 0);
        scheduleHover(card);
      }
    });
    listen(stage, 'pointerleave', () => { if (mode === 'pointer') close(); pointer = null; blocked.clear(); });
    cards.forEach((card, index) => {
      listen(card, 'focus', () => { if (navigationEnabled && card.matches(':focus-visible')) open(card, 'keyboard'); });
      listen(card, 'pointerenter', event => {
        if (!hover.matches || event.pointerType === 'touch' || active || blocked.has(card)) return;
        pointer = { x: event.clientX, y: event.clientY }; scheduleHover(card);
      });
      listen(card, 'pointerleave', () => { if (pendingCard === card) cancelPendingHover(); });
      listen(card, 'click', event => {
        if (navigationEnabled && (hover.matches || event.detail === 0 || active === card)) {
          close(true);
          onNavigate(map.regions[index]);
          return;
        }
        if (hover.matches && event.detail !== 0) return;
        if (active === card) close(); else open(card, event.detail === 0 ? 'keyboard' : 'touch');
      });
    });
    listen(stage, 'click', event => { if (!event.target.closest('.gallery-map-region')) close(); });
    listen(document, 'keydown', event => { if (event.key === 'Escape' && active) { event.preventDefault(); close(true); } });
    listen(stage, 'focusout', event => { if (mode === 'keyboard' && !stage.contains(event.relatedTarget)) close(); });
    const resize = new ResizeObserver(() => { if (active) place(active); checkHoverPosition(); }); resize.observe(stage);
    listen(document, 'scroll', checkHoverPosition);
    listen(hover, 'change', () => { close(); blocked.clear(); updateHelp(); }); updateHelp();
    return { cards, close, picture, destroy() { close(); resize.disconnect(); cleanup.forEach(remove => remove()); stage.replaceChildren(); } };
  }
  return { mount };
})();


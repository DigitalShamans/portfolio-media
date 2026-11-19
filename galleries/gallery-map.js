'use strict';

const GalleryMap = (() => {
  function mount(stage, map, resolveImage, { interactive = true, caption, help, onNavigate } = {}) {
    const cleanup = [];
    const listen = (target, type, handler) => { target.addEventListener(type, handler); cleanup.push(() => target.removeEventListener(type, handler)); };
    const navigationEnabled = interactive && typeof onNavigate === 'function';
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
    let active = null, mode = null, interiorEntered = false, pointer = null;
    const updateHelp = () => {
      if (!help) return;
      help.textContent = navigationEnabled
        ? (hover.matches ? 'Hover to enlarge. Click to scroll to the screenshot below.' : 'Tap to preview. Tap the enlarged screenshot again to scroll to it.')
        : (hover.matches ? 'Hover a screenshot to enlarge it. Move towards its edge to return.' : 'Tap a screenshot to enlarge it. Tap again or outside it to return.');
    };
    function geometry(card) {
      const width = stage.clientWidth, height = stage.clientHeight;
      const thumbWidth = width * .2, thumbHeight = thumbWidth * 9 / 16;
      const anchorX = width * Math.max(10, Math.min(90, Number(card.dataset.x))) / 100;
      const anchorY = height * Math.max(10, Math.min(90, Number(card.dataset.y))) / 100;
      const scale = Math.min(5, width / thumbWidth, height / thumbHeight);
      const panelWidth = thumbWidth * scale, panelHeight = thumbHeight * scale;
      const x = width / 2, y = height / 2;
      const board = stage.getBoundingClientRect(), left = board.left + stage.clientLeft, top = board.top + stage.clientTop;
      return { scale, shiftX: x - anchorX, shiftY: y - anchorY,
        expanded: { left: left + x - panelWidth / 2, top: top + y - panelHeight / 2, width: panelWidth, height: panelHeight },
        thumb: { left: left + anchorX - thumbWidth / 2, top: top + anchorY - thumbHeight / 2, width: thumbWidth, height: thumbHeight } };
    }
    const edgeDistance = (point, rect) => Math.min(point.x - rect.left, rect.left + rect.width - point.x, point.y - rect.top, rect.top + rect.height - point.y);
    function closingMargin(rect) {
      const margin = 4 * Math.max(12, Math.min(40, rect.height * .12));
      // Preserve a central hover area even in an unusually small window.
      return Math.min(margin, Math.min(rect.width, rect.height) * .49);
    }
    function close(block = false) {
      if (!active) return;
      const card = active; if (block) blocked.add(card);
      active = null; mode = null; interiorEntered = false;
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
      const layout = place(card), margin = closingMargin(layout.expanded);
      interiorEntered = inputMode === 'pointer' && pointer && edgeDistance(pointer, layout.expanded) > margin;
      card.classList.add('is-open'); card.setAttribute('aria-expanded', 'true'); stage.classList.add('has-open-region');
      if (caption) caption.textContent = map.regions[cards.indexOf(card)].label;
    }
    listen(stage, 'pointermove', event => {
      if (!hover.matches || event.pointerType === 'touch') return;
      pointer = { x: event.clientX, y: event.clientY };
      for (const card of blocked) if (edgeDistance(pointer, geometry(card).thumb) < 0) blocked.delete(card);
      if (active) {
        if (mode !== 'pointer') return;
        const rect = geometry(active).expanded, distance = edgeDistance(pointer, rect), margin = closingMargin(rect);
        if (distance > margin) interiorEntered = true;
        if (distance < 0 || (interiorEntered && distance <= margin)) close(true);
      } else {
        const card = cards.find(item => !blocked.has(item) && edgeDistance(pointer, geometry(item).thumb) >= 0);
        if (card) open(card, 'pointer');
      }
    });
    listen(stage, 'pointerleave', () => { if (mode === 'pointer') close(); pointer = null; blocked.clear(); });
    cards.forEach((card, index) => {
      listen(card, 'focus', () => { if (navigationEnabled && card.matches(':focus-visible')) open(card, 'keyboard'); });
      listen(card, 'pointerenter', event => {
        if (!hover.matches || event.pointerType === 'touch' || active || blocked.has(card)) return;
        pointer = { x: event.clientX, y: event.clientY }; open(card, 'pointer');
      });
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
    const resize = new ResizeObserver(() => { if (active) place(active); }); resize.observe(stage);
    listen(hover, 'change', () => { close(); blocked.clear(); updateHelp(); }); updateHelp();
    return { cards, close, picture, destroy() { close(); resize.disconnect(); cleanup.forEach(remove => remove()); stage.replaceChildren(); } };
  }
  return { mount };
})();

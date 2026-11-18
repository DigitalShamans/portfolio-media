'use strict';

(() => {
  const stage = document.querySelector('#overview-stage');
  if (!stage) return;
  const cards = [...stage.querySelectorAll('.region')];
  const caption = document.querySelector('#active-region');
  const help = document.querySelector('#overview-help');
  const hover = matchMedia('(hover: hover) and (pointer: fine)');
  const blocked = new Set();
  let active = null;
  let mode = null;
  let interiorEntered = false;
  let pointer = null;

  function updateHelp() {
    help.textContent = hover.matches
      ? 'Hover a screenshot to enlarge it. Move towards its edge to return.'
      : 'Tap a screenshot to enlarge it. Tap again or outside it to return.';
  }

  function geometry(card) {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    const thumbWidth = width * .2;
    const thumbHeight = thumbWidth * 9 / 16;
    const anchorX = width * Number(card.dataset.x) / 100;
    const anchorY = height * Number(card.dataset.y) / 100;
    const gap = Math.min(12, width * .025);
    const scale = Math.min(3, (width - 2 * gap) / thumbWidth, (height - 2 * gap) / thumbHeight);
    const panelWidth = thumbWidth * scale;
    const panelHeight = thumbHeight * scale;
    const x = Math.max(gap + panelWidth / 2, Math.min(width - gap - panelWidth / 2, anchorX));
    const y = Math.max(gap + panelHeight / 2, Math.min(height - gap - panelHeight / 2, anchorY));
    const board = stage.getBoundingClientRect();
    const originX = board.left + stage.clientLeft;
    const originY = board.top + stage.clientTop;
    return {
      scale, shiftX: x - anchorX, shiftY: y - anchorY,
      expanded: { left: originX + x - panelWidth / 2, top: originY + y - panelHeight / 2, width: panelWidth, height: panelHeight },
      thumb: { left: originX + anchorX - thumbWidth / 2, top: originY + anchorY - thumbHeight / 2, width: thumbWidth, height: thumbHeight },
    };
  }

  function edgeDistance(point, rect) {
    return Math.min(point.x - rect.left, rect.left + rect.width - point.x,
      point.y - rect.top, rect.top + rect.height - point.y);
  }

  function close(block = false) {
    if (!active) return;
    const card = active;
    if (block) blocked.add(card);
    active = null;
    mode = null;
    interiorEntered = false;
    card.classList.remove('is-open');
    card.setAttribute('aria-expanded', 'false');
    card.style.removeProperty('--scale');
    card.style.removeProperty('--shift-x');
    card.style.removeProperty('--shift-y');
    stage.classList.remove('has-open-region');
    caption.textContent = 'Whole-level overview';
  }

  function place(card) {
    const layout = geometry(card);
    card.style.setProperty('--scale', layout.scale);
    card.style.setProperty('--shift-x', `${layout.shiftX}px`);
    card.style.setProperty('--shift-y', `${layout.shiftY}px`);
    return layout;
  }

  function open(card, inputMode) {
    if (active === card) return;
    close();
    active = card;
    mode = inputMode;
    const layout = place(card);
    const margin = Math.max(12, Math.min(40, layout.expanded.height * .12));
    interiorEntered = inputMode === 'pointer' && pointer && edgeDistance(pointer, layout.expanded) > margin;
    card.classList.add('is-open');
    card.setAttribute('aria-expanded', 'true');
    stage.classList.add('has-open-region');
    caption.textContent = card.dataset.label;
  }

  stage.addEventListener('pointermove', event => {
    if (!hover.matches || event.pointerType === 'touch') return;
    pointer = { x: event.clientX, y: event.clientY };
    // A collapsed card cannot reopen under a stationary cursor: leave its small
    // original footprint first. Edge detection uses final geometry, not the
    // moving animation bounds, so the image never chases the cursor.
    for (const card of blocked) {
      if (edgeDistance(pointer, geometry(card).thumb) < 0) blocked.delete(card);
    }
    if (active) {
      if (mode !== 'pointer') return;
      const rect = geometry(active).expanded;
      const distance = edgeDistance(pointer, rect);
      const margin = Math.max(12, Math.min(40, rect.height * .12));
      if (distance > margin) interiorEntered = true;
      if (distance < 0 || (interiorEntered && distance <= margin)) close(true);
      return;
    }
    const card = cards.find(item => !blocked.has(item) && edgeDistance(pointer, geometry(item).thumb) >= 0);
    if (card) open(card, 'pointer');
  });

  stage.addEventListener('pointerleave', () => {
    if (mode === 'pointer') close();
    pointer = null;
    blocked.clear();
  });

  for (const card of cards) {
    card.addEventListener('pointerenter', event => {
      if (!hover.matches || event.pointerType === 'touch' || active || blocked.has(card)) return;
      pointer = { x: event.clientX, y: event.clientY };
      open(card, 'pointer');
    });
    card.addEventListener('click', event => {
      if (hover.matches && event.detail !== 0) return;
      if (active === card) close();
      else open(card, event.detail === 0 ? 'keyboard' : 'touch');
    });
  }

  stage.addEventListener('click', event => {
    if (!event.target.closest('.region')) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && active) {
      event.preventDefault();
      close(true);
    }
  });
  stage.addEventListener('focusout', event => {
    if (mode === 'keyboard' && !stage.contains(event.relatedTarget)) close();
  });
  new ResizeObserver(() => { if (active) place(active); }).observe(stage);
  hover.addEventListener('change', () => { close(); blocked.clear(); updateHelp(); });
  updateHelp();
})();

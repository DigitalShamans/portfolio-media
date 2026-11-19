'use strict';

const GalleryMapEditor = (() => {
  function create({ preview, message, run, onStateChange }) {
    const find = selector => document.querySelector(selector);
    const panel = find('#map-panel'), stage = find('#map-stage'), overview = find('#map-overview');
    const alt = find('#map-overview-alt'), screenshot = find('#map-screenshot'), add = find('#map-add');
    const list = find('#map-regions'), selectedFields = find('#map-selected'), label = find('#map-label');
    const selectedFile = find('#map-selected-file'), position = find('#map-position'), validation = find('#map-validation');
    const save = find('#map-save'), download = find('#map-download'), toggle = find('#map-preview');
    const help = find('#map-help'), caption = find('#map-caption'), errorBox = find('#map-file-error');
    const errorText = find('#map-file-error-text'), reset = find('#map-reset'), fields = find('#map-fields');
    const published = find('#map-published');
    let map, sourceText = null, names = [], allowed = new Set(), directory, folderName = '';
    let dirty = false, busy = false, previewing = false, selected = -1, renderer, loadError = '', drag;

    const empty = () => ({ version: 1, overview: { image: '', alt: '' }, regions: [] });
    const defaultLabel = name => name.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
    function mapText() { return JSON.stringify(GalleryMapData.parse(JSON.stringify(map), allowed), null, 2) + '\n'; }
    function controls() {
      let invalid = loadError;
      if (!invalid && map) { try { mapText(); } catch (error) { invalid = error.message; } }
      validation.textContent = invalid || (dirty ? 'Map has unsaved changes.' : 'Map is ready.');
      save.disabled = busy || !directory || !dirty || !!invalid;
      download.disabled = busy || !map || !!invalid;
      toggle.disabled = busy || !map?.overview.image || !map.regions.length || !!loadError;
      toggle.textContent = previewing ? 'Back to editing' : 'Preview map';
      toggle.setAttribute('aria-pressed', String(previewing));
      panel.inert = busy;
      fields.disabled = !!loadError;
      for (const field of [overview, alt, screenshot, label]) field.disabled = busy || previewing || !!loadError;
      add.disabled = busy || previewing || !map?.overview.image || !screenshot.value;
      if (map) list.querySelectorAll('button').forEach(button => { button.disabled = busy || previewing; });
    }
    function changed(text) {
      dirty = true; controls(); onStateChange();
      if (text) message(text + ' Save gallery-map.json to keep the changes.');
    }
    function select(index) {
      selected = index;
      renderer?.cards.forEach((card, i) => { card.classList.toggle('is-selected', i === selected && !previewing); });
      list.querySelectorAll('[data-select]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.select) === selected)));
      const region = map?.regions[selected]; selectedFields.hidden = !region;
      if (region) { label.value = region.label; selectedFile.textContent = region.image; position.textContent = 'Position: ' + region.x + '% across, ' + region.y + '% down'; }
    }
    function renderList() {
      list.replaceChildren(...map.regions.map((region, index) => {
        const item = document.createElement('li'), choose = document.createElement('button'), remove = document.createElement('button');
        choose.type = remove.type = 'button'; choose.textContent = region.label || region.image;
        choose.dataset.select = index; choose.setAttribute('aria-pressed', String(index === selected));
        choose.addEventListener('click', () => select(index));
        remove.textContent = 'Remove'; remove.setAttribute('aria-label', 'Remove ' + (region.label || region.image));
        remove.addEventListener('click', () => {
          map.regions.splice(index, 1); selected = Math.min(selected, map.regions.length - 1);
          render(); changed('Screenshot removed.');
        });
        item.append(choose, remove); return item;
      }));
      const available = names.filter(name => !map.regions.some(region => region.image === name));
      const previous = screenshot.value;
      screenshot.replaceChildren(...available.map(name => new Option(name, name)));
      if (available.includes(previous)) screenshot.value = previous;
      updateSample();
    }
    function updateSample() {
      const sample = find('#map-sample'); sample.hidden = !screenshot.value;
      if (screenshot.value) sample.src = preview(screenshot.value); else sample.removeAttribute('src');
      controls();
    }
    function updatePosition(index, next) {
      Object.assign(map.regions[index], next);
      const card = renderer.cards[index];
      card.style.setProperty('--x', next.x + '%'); card.style.setProperty('--y', next.y + '%');
      card.dataset.x = next.x; card.dataset.y = next.y;
      if (selected === index) position.textContent = 'Position: ' + next.x + '% across, ' + next.y + '% down';
    }
    function pointerPosition(event) {
      const rect = stage.getBoundingClientRect();
      return { x: (event.clientX - rect.left - stage.clientLeft) / stage.clientWidth * 100,
        y: (event.clientY - rect.top - stage.clientTop) / stage.clientHeight * 100 };
    }
    function wireDragging() {
      renderer.cards.forEach((card, index) => {
        card.addEventListener('click', () => select(index));
        card.addEventListener('pointerdown', event => {
          if (busy || event.button !== 0 || !event.isPrimary) return;
          event.preventDefault(); select(index); card.focus({ preventScroll: true });
          const point = pointerPosition(event), region = map.regions[index];
          drag = { id: event.pointerId, index, x: region.x, y: region.y, dirtyBefore: dirty, offsetX: point.x - region.x, offsetY: point.y - region.y };
          card.setPointerCapture(event.pointerId);
        });
        card.addEventListener('pointermove', event => {
          if (!drag || event.pointerId !== drag.id || drag.index !== index) return;
          const point = pointerPosition(event);
          updatePosition(index, GalleryMapData.position(point.x - drag.offsetX, point.y - drag.offsetY));
          dirty = true; controls();
        });
        card.addEventListener('pointerup', event => {
          if (!drag || event.pointerId !== drag.id) return;
          const before = drag; drag = null;
          if (map.regions[index].x !== before.x || map.regions[index].y !== before.y) changed('Screenshot positioned.');
          else { dirty = before.dirtyBefore; controls(); }
        });
        card.addEventListener('pointercancel', () => {
          if (!drag || drag.index !== index) return;
          updatePosition(index, { x: drag.x, y: drag.y }); dirty = drag.dirtyBefore; drag = null; controls();
        });
        card.addEventListener('keydown', event => {
          const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
          if (!delta || busy) return;
          event.preventDefault(); select(index); const region = map.regions[index], step = event.shiftKey ? 5 : 1;
          updatePosition(index, GalleryMapData.position(region.x + delta[0] * step, region.y + delta[1] * step));
          changed('Screenshot positioned.');
        });
      });
    }
    function render() {
      renderer?.destroy();
      renderer = GalleryMap.mount(stage, map, name => ({ src: preview(name) }), { interactive: previewing, caption, help });
      stage.classList.toggle('is-editing', !previewing);
      caption.textContent = 'Whole-level overview';
      if (!previewing) { help.textContent = 'Drag screenshots into position. Use arrow keys for small adjustments; hold Shift for larger steps.'; wireDragging(); }
      renderList(); select(selected); controls();
    }

    overview.addEventListener('change', () => {
      map.overview.image = overview.value;
      if (!map.overview.alt) { map.overview.alt = defaultLabel(overview.value); alt.value = map.overview.alt; }
      render(); changed('Overview selected.');
    });
    alt.addEventListener('input', () => { map.overview.alt = alt.value; changed(); });
    screenshot.addEventListener('change', updateSample);
    add.addEventListener('click', () => {
      if (!screenshot.value || !map.overview.image) return;
      const offset = map.regions.length % 4;
      map.regions.push({ image: screenshot.value, label: defaultLabel(screenshot.value), x: 30 + offset * 12, y: 35 + offset * 10 });
      selected = map.regions.length - 1; render(); changed('Screenshot added.');
    });
    label.addEventListener('input', () => {
      const region = map.regions[selected]; if (!region) return;
      region.label = label.value;
      renderer.cards[selected].setAttribute('aria-label', 'Move ' + region.label + ' screenshot');
      renderList(); changed();
    });
    toggle.addEventListener('click', () => { previewing = !previewing; render(); });
    reset.addEventListener('click', () => {
      if (!window.confirm('Start a new map? The existing map file will only be replaced when you save.')) return;
      map = empty(); loadError = ''; selected = -1; errorBox.hidden = true;
      overview.value = ''; alt.value = ''; render(); changed('New map started.');
    });
    save.addEventListener('click', () => { void run(async () => {
      const text = mapText();
      await GalleryEditorFiles.writeText(directory, GalleryMapData.filename, text, sourceText);
      sourceText = text; dirty = false; controls();
      message('Saved gallery-map.json. Commit and push it in Fork to publish the map.');
    }); });
    download.addEventListener('click', () => { void run(() => {
      const url = URL.createObjectURL(new Blob([mapText()], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = GalleryMapData.filename; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      message('Downloaded gallery-map.json. Copy it into ' + folderName + ' before committing in Fork.');
    }); });

    return {
      get dirty() { return dirty; },
      setBusy(value) { busy = value; controls(); },
      load({ names: imageNames, directory: handle, text, name }) {
        renderer?.destroy(); names = imageNames; allowed = new Set(names); directory = handle; sourceText = text;
        folderName = name; dirty = false; previewing = false; selected = -1; loadError = '';
        map = empty();
        if (text !== null) {
          try { map = GalleryMapData.parse(text, allowed); }
          catch (error) { loadError = error.message; }
        }
        errorBox.hidden = !loadError; errorText.textContent = loadError;
        overview.replaceChildren(new Option('Choose an overview image', ''), ...names.map(image => new Option(image, image)));
        overview.value = map.overview.image; alt.value = map.overview.alt;
        published.href = 'https://digitalshamans.co.uk/experiments/gallery-map/?gallery=' + encodeURIComponent(name);
        published.hidden = !/^hb-[a-z0-9-]+$/.test(name) || name === 'hb-rzstart';
        render();
      }
    };
  }
  return { create };
})();

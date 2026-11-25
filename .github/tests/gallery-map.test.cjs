'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { tmpdir } = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');
const { runInNewContext } = require('node:vm');
const data = require('../../galleries/gallery-map-data.js');
const root = resolve(__dirname, '../..');
const editorFiles = runInNewContext(readFileSync(join(root, 'galleries/gallery-data.js'), 'utf8') + '\n' + readFileSync(join(root, '_tools/gallery-editor-files.js'), 'utf8') + '\nGalleryEditorFiles', { JSON, Map, Set });
const allowed = new Set(['Overview.jpg', 'Office.jpg', 'Office_Checker.jpg']);
const sample = () => ({ version: 1, overview: { image: 'Overview.jpg', alt: 'Level overview' }, regions: [{ image: 'Office.jpg', label: 'Offices', x: 27.35, y: 64.25 }] });

test('saved maps round-trip positions, labels and exact original filenames', () => {
  assert.deepEqual(data.parse(JSON.stringify(sample()), allowed), sample());
  const map = sample(); map.regions.push({ image: 'Office_Checker.jpg', label: '<b>Checker</b>', x: 90, y: 10 });
  assert.deepEqual(data.parse(JSON.stringify(map), allowed), map);
});

test('malformed, empty and unsupported maps are rejected before saving', () => {
  for (const text of ['{', 'null', '[]', '{}', JSON.stringify({ ...sample(), version: 2 }), JSON.stringify({ ...sample(), regions: [] })]) {
    assert.throws(() => data.parse(text, allowed));
  }
});

test('maps reject missing, wrong-case and unsafe filenames and duplicate screenshots', () => {
  for (const image of ['office.jpg', 'Missing.jpg', '../Office.jpg', 'sub/Office.jpg', 'x\\Office.jpg']) {
    const map = sample(); map.regions[0].image = image;
    assert.throws(() => data.parse(JSON.stringify(map), allowed));
  }
  const map = sample(); map.regions.push({ ...map.regions[0] });
  assert.throws(() => data.parse(JSON.stringify(map), allowed), /more than once/);
});

test('invalid positions and blank descriptions are rejected with the offending screenshot', () => {
  for (const value of [-1, 101, '40', null]) {
    const map = sample(); map.regions[0].x = value;
    assert.throws(() => data.parse(JSON.stringify(map), allowed), /Screenshot 1.*Office.jpg.*x/);
  }
  const map = sample(); map.overview.alt = '  ';
  assert.throws(() => data.parse(JSON.stringify(map), allowed), /Overview needs a description/);
  map.overview.alt = 'Overview'; map.regions[0].label = '';
  assert.throws(() => data.parse(JSON.stringify(map), allowed), /Screenshot 1 needs a description/);
});

test('drag positions keep the whole 20-percent thumbnail within the overview', () => {
  assert.deepEqual(data.position(-40, 120), { x: 10, y: 90 });
  assert.deepEqual(data.position(35.12345, 62.98765), { x: 35.12, y: 62.99 });
});

test('WebP-only public folders preserve manifest order and comparison filenames', () => {
  const manifest = JSON.stringify([{ image: 'Office.jpg', compare: 'Office_Checker.jpg' }, { image: 'Overview.jpg' }]);
  const previews = [...allowed].map(name => ({ name: name.replace('.jpg', '.webp') }));
  const result = editorFiles.collect([], previews, manifest);
  assert.equal(JSON.stringify(result.entries), manifest);
  assert.equal(result.files.get('Office.jpg'), previews[1]);
  assert.deepEqual([...result.files.keys()], ['Office.jpg', 'Office_Checker.jpg', 'Overview.jpg']);
  assert.throws(() => editorFiles.collect([], [{ name: 'office.webp' }], manifest), /Missing gallery image/);
});

test('originals are preferred locally and intentionally omitted images stay omitted', () => {
  const original = { name: 'Office.jpg' }, extra = { name: 'Omitted.jpg' };
  const result = editorFiles.collect([original, extra], [{ name: 'Office.webp' }], '[{"image":"Office.jpg"}]');
  assert.equal(result.files.get('Office.jpg'), original);
  assert.equal(JSON.stringify(result.entries), '[{"image":"Office.jpg"}]');
});

function directory(initial = {}) {
  const state = { files: { ...initial }, writes: [], aborts: 0, fail: false };
  const handle = {
    async getFileHandle(name, options) {
      if (!(name in state.files) && !options?.create) throw Object.assign(new Error('missing'), { name: 'NotFoundError' });
      return {
        async getFile() { return { async text() { return state.files[name]; } }; },
        async createWritable() {
          let pending;
          return {
            async write(text) { state.writes.push(name); if (state.fail) throw new Error('Disk full'); pending = text; },
            async close() { state.files[name] = pending; }, async abort() { state.aborts++; }
          };
        }
      };
    }
  };
  return { state, handle };
}

test('saving a map does not write or modify the image-order manifest', async () => {
  const d = directory({ 'gallery.json': 'ordered images', 'gallery-map.json': 'old map' });
  await editorFiles.writeText(d.handle, 'gallery-map.json', 'new map', 'old map');
  assert.equal(d.state.files['gallery.json'], 'ordered images');
  assert.equal(d.state.files['gallery-map.json'], 'new map');
  assert.deepEqual(d.state.writes, ['gallery-map.json']);
});

test('external changes and a newly created map prevent stale writes', async () => {
  for (const expected of ['old map', null]) {
    const d = directory({ 'gallery-map.json': 'someone else edited this' });
    await assert.rejects(editorFiles.writeText(d.handle, 'gallery-map.json', 'new map', expected), /changed outside the editor/);
    assert.equal(d.state.writes.length, 0);
  }
});

test('a missing map can be created and failed writes abort without replacing saved data', async () => {
  const d = directory();
  await editorFiles.writeText(d.handle, 'gallery-map.json', 'first map', null);
  d.state.fail = true;
  await assert.rejects(editorFiles.writeText(d.handle, 'gallery-map.json', 'lost map', 'first map'), /Disk full/);
  assert.equal(d.state.aborts, 1); assert.equal(d.state.files['gallery-map.json'], 'first map');
});

test('pre-publish CLI accepts the valid fixture and blocks invalid or protected map files', () => {
  const temp = mkdtempSync(join(tmpdir(), 'gallery-map-'));
  try {
    const folder = join(temp, 'galleries/hb-demo'); mkdirSync(join(folder, '1440p'), { recursive: true });
    writeFileSync(join(folder, 'index.html'), '---\nlayout: gallery\n---\n');
    writeFileSync(join(folder, 'gallery.json'), JSON.stringify([...allowed].map(image => ({ image }))));
    for (const image of allowed) writeFileSync(join(folder, '1440p', image.replace('.jpg', '.webp')), 'fixture');
    const file = join(folder, 'gallery-map.json'); writeFileSync(file, JSON.stringify(sample()));
    execFileSync('git', ['init', '-q'], { cwd: temp }); execFileSync('git', ['add', '.'], { cwd: temp });
    const check = () => spawnSync(process.execPath, [join(root, '.github/scripts/validate-gallery-maps.cjs'), temp], { encoding: 'utf8' });
    assert.equal(check().status, 0);
    const badCase = sample(); badCase.regions[0].image = 'office.jpg';
    for (const text of ['{', JSON.stringify({ ...sample(), regions: [] }), JSON.stringify(badCase)]) {
      writeFileSync(file, text); const result = check();
      assert.notEqual(result.status, 0); assert.match(result.stderr, /galleries\/hb-demo\/gallery-map.json/);
    }
    writeFileSync(file, JSON.stringify(sample()));
    execFileSync('git', ['rm', '--cached', 'galleries/hb-demo/1440p/Office.webp'], { cwd: temp });
    assert.match(check().stderr, /exact-case matching WebP/);
    execFileSync('git', ['add', '.'], { cwd: temp });
    const protectedFolder = join(temp, 'galleries/hb-rzstart'); mkdirSync(protectedFolder);
    writeFileSync(join(protectedFolder, 'gallery-map.json'), JSON.stringify(sample()));
    execFileSync('git', ['add', '.'], { cwd: temp }); const blocked = check();
    assert.notEqual(blocked.status, 0); assert.match(blocked.stderr, /protected galleries/);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

function mapRenderer(hoverEnabled = true, position = { x: 25, y: 29 }) {
  class Element {
    constructor(tag = 'div') {
      this.tag = tag; this.children = []; this.dataset = {}; this.attributes = new Map(); this.listeners = new Map();
      this.clientWidth = 1000; this.clientHeight = 562.5; this.clientLeft = 0; this.clientTop = 0;
      this.left = 0; this.top = 0; this.renderScale = 1;
      const values = new Map(), classes = new Set();
      this.style = { setProperty: (name, value) => values.set(name, value), getPropertyValue: name => values.get(name), removeProperty: name => values.delete(name) };
      this.classList = { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name), toggle: (name, on) => on ? classes.add(name) : classes.delete(name) };
    }
    addEventListener(name, handler) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(handler); }
    removeEventListener(name, handler) { this.listeners.get(name)?.delete(handler); }
    fire(name, event = {}) { event.stopPropagation ||= () => {}; for (const handler of this.listeners.get(name) || []) handler(event); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    getAttribute(name) { return this.attributes.get(name); }
    get offsetWidth() { return this.clientWidth + this.clientLeft * 2; }
    get offsetHeight() { return this.clientHeight + this.clientTop * 2; }
    getBoundingClientRect() { return { left: this.left, top: this.top, width: this.offsetWidth * this.renderScale, height: this.offsetHeight * this.renderScale }; }
    matches() { return false; }
    contains(element) { return this === element || this.children.some(child => child.contains(element)); }
  }
  const document = new Element(), hover = new Element(); hover.matches = hoverEnabled;
  document.createElement = tag => new Element(tag);
  let now = 0, nextTimer = 0;
  const timers = new Map();
  function advance(ms) {
    const end = now + ms;
    while (true) {
      const due = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]); now = due[1].at; due[1].run();
    }
    now = end;
  }
  let onResize;
  const renderer = runInNewContext(readFileSync(join(root, 'galleries/gallery-map.js'), 'utf8') + '\nGalleryMap', {
    document, window: {}, matchMedia: () => hover, ResizeObserver: class { constructor(callback) { onResize = callback; } observe() {} disconnect() {} },
    setTimeout(run, delay) { const id = ++nextTimer; timers.set(id, { run, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); }
  });
  const stage = new Element();
  const map = { overview: { image: 'Overview.jpg', alt: 'Overview' }, regions: [{ image: 'Office.jpg', label: 'Offices', ...position }] };
  return { mount: options => renderer.mount(stage, map, name => ({ src: name }), options), stage, advance, document, resize: () => onResize() };
}

function mapPointer(stage, { x, y }) {
  return {
    pointerType: 'mouse',
    clientX: stage.left + (stage.clientLeft + stage.clientWidth * x / 100) * stage.renderScale,
    clientY: stage.top + (stage.clientTop + stage.clientHeight * y / 100) * stage.renderScale
  };
}

test('hover requires a continuous 400ms stay without restarting on small cursor movements', () => {
  const { mount, stage, advance } = mapRenderer();
  const view = mount({}), card = view.cards[0];
  card.fire('pointerenter', { pointerType: 'mouse', clientX: 250, clientY: 163 });
  advance(200);
  stage.fire('pointermove', { pointerType: 'mouse', clientX: 260, clientY: 165 });
  advance(199);
  assert.equal(card.getAttribute('aria-expanded'), 'false');
  advance(1);
  assert.equal(card.getAttribute('aria-expanded'), 'true');
  view.destroy();
});

test('leaving a thumbnail cancels the dwell and re-entry starts a fresh delay', () => {
  const { mount, stage, advance } = mapRenderer();
  const view = mount({}), card = view.cards[0];
  card.fire('pointerenter', { pointerType: 'mouse', clientX: 250, clientY: 163 });
  advance(300);
  stage.fire('pointermove', { pointerType: 'mouse', clientX: 500, clientY: 281 });
  advance(400);
  assert.equal(card.getAttribute('aria-expanded'), 'false');
  card.fire('pointerenter', { pointerType: 'mouse', clientX: 250, clientY: 163 });
  advance(399);
  assert.equal(card.getAttribute('aria-expanded'), 'false');
  advance(1);
  assert.equal(card.getAttribute('aria-expanded'), 'true');
  view.close();
  card.fire('pointerenter', { pointerType: 'mouse', clientX: 250, clientY: 163 });
  advance(200);
  view.destroy();
  advance(200);
  assert.equal(card.getAttribute('aria-expanded'), 'false');
});

test('hover preview fills 100 percent of the overview and stays inside its edges', () => {
  const { mount, stage, advance } = mapRenderer();
  const view = mount({});
  const card = view.cards[0];
  card.fire('pointerenter', { pointerType: 'mouse', clientX: 250, clientY: 163 });
  advance(400);
  const scale = Number(card.style.getPropertyValue('--scale'));
  const width = stage.clientWidth * .2 * scale, height = stage.clientHeight * .2 * scale;
  assert.equal(width, stage.clientWidth);
  assert.equal(height, stage.clientHeight);
  const x = stage.clientWidth * .25 + Number.parseFloat(card.style.getPropertyValue('--shift-x'));
  const y = stage.clientHeight * .29 + Number.parseFloat(card.style.getPropertyValue('--shift-y'));
  assert.ok(x - width / 2 >= 0 && x + width / 2 <= stage.clientWidth);
  assert.ok(y - height / 2 >= 0 && y + height / 2 <= stage.clientHeight);
  view.destroy();
});

test('desktop clicks navigate to the exact screenshot and close its preview', () => {
  const { mount } = mapRenderer();
  const destinations = [];
  const view = mount({ onNavigate: region => destinations.push(region.image) });
  const card = view.cards[0];
  card.fire('pointerenter', { pointerType: 'mouse', clientX: 250, clientY: 163 });
  card.fire('click', { detail: 1 });
  assert.deepEqual(destinations, ['Office.jpg']);
  assert.equal(card.getAttribute('aria-expanded'), 'false');
  view.destroy();
});

test('collapsed thumbnails navigate while enlarged previews stay in place', () => {
  const { mount, advance } = mapRenderer();
  const destinations = [], help = {};
  let consumed = 0;
  const view = mount({ navigateExpandedPreview: false, previewSize: .8, help,
    onNavigate: region => destinations.push(region.image) });
  const card = view.cards[0];
  card.fire('click', { detail: 1, stopPropagation() { consumed++; } });
  assert.deepEqual(destinations, ['Office.jpg']);
  assert.equal(consumed, 1, 'the navigation click cannot also zoom the selected image');
  card.fire('pointerenter', { pointerType: 'mouse', clientX: 250, clientY: 163 });
  advance(400);
  assert.equal(card.getAttribute('aria-expanded'), 'true');
  assert.equal(card.style.getPropertyValue('--scale'), 4);
  card.fire('click', { detail: 1, stopPropagation() { consumed++; } });
  assert.deepEqual(destinations, ['Office.jpg']);
  assert.equal(consumed, 1, 'a preview click remains available to the existing viewer controls');
  assert.equal(card.getAttribute('aria-expanded'), 'true');
  assert.match(help.textContent, /Enlarged previews do not navigate/);
  view.destroy();
});

test('preview-only expansion keeps touch toggles and collapsed keyboard navigation', () => {
  const { mount } = mapRenderer(false);
  const destinations = [], help = {};
  const view = mount({ navigateExpandedPreview: false, help,
    onNavigate: region => destinations.push(region.image) });
  const card = view.cards[0];
  card.matches = () => true;
  card.fire('focus');
  assert.equal(card.getAttribute('aria-expanded'), 'false', 'keyboard focus leaves a thumbnail available to navigate');
  card.fire('click', { detail: 0 });
  assert.deepEqual(destinations, ['Office.jpg']);
  card.fire('click', { detail: 1 });
  assert.equal(card.getAttribute('aria-expanded'), 'true');
  card.fire('click', { detail: 1 });
  assert.equal(card.getAttribute('aria-expanded'), 'false');
  card.fire('click', { detail: 1 });
  card.fire('click', { detail: 0 });
  assert.equal(card.getAttribute('aria-expanded'), 'false');
  assert.deepEqual(destinations, ['Office.jpg'], 'activating an enlarged preview never navigates');
  assert.match(help.textContent, /Tap again or outside it to return/);
  view.destroy();
});

test('touch previews first, then navigates on a second tap; keyboard activates directly', () => {
  const { mount } = mapRenderer(false);
  const destinations = [];
  const view = mount({ onNavigate: region => destinations.push(region.image) });
  const card = view.cards[0];
  card.fire('click', { detail: 1 });
  assert.equal(card.getAttribute('aria-expanded'), 'true');
  assert.equal(destinations.length, 0);
  card.fire('click', { detail: 1 });
  assert.deepEqual(destinations, ['Office.jpg']);
  card.fire('click', { detail: 0 });
  assert.deepEqual(destinations, ['Office.jpg', 'Office.jpg']);
  view.destroy();
});

test('standalone editor preview keeps its existing toggle behavior without a navigation target', () => {
  const { mount, stage } = mapRenderer(false);
  const view = mount({});
  const card = view.cards[0];
  card.fire('click', { detail: 1 });
  assert.equal(card.getAttribute('aria-expanded'), 'true');
  card.fire('click', { detail: 1 });
  assert.equal(card.getAttribute('aria-expanded'), 'false');
  assert.equal(stage.classList.contains('has-gallery-links'), false);
  view.destroy();
});

test('each thumbnail anchors its own keep-open rectangle on all four sides', () => {
  for (const position of [{ x: 25, y: 29 }, { x: 66, y: 25 }, { x: 37, y: 70 }, { x: 77, y: 68 }]) {
    for (const edge of ['left', 'right', 'top', 'bottom']) {
      const { mount, stage, advance } = mapRenderer(true, position);
      const view = mount({}), card = view.cards[0];
      const x = stage.clientWidth * position.x / 100, y = stage.clientHeight * position.y / 100;
      card.fire('pointerenter', { pointerType: 'mouse', clientX: x, clientY: y });
      advance(400);
      const bounds = {
        left: Math.max(0, x - stage.clientWidth * .225), right: Math.min(stage.clientWidth, x + stage.clientWidth * .225),
        top: Math.max(0, y - stage.clientHeight * .27), bottom: Math.min(stage.clientHeight, y + stage.clientHeight * .27)
      };
      const point = inset => ({
        pointerType: 'mouse',
        clientX: edge === 'left' ? bounds.left + inset : edge === 'right' ? bounds.right - inset : x,
        clientY: edge === 'top' ? bounds.top + inset : edge === 'bottom' ? bounds.bottom - inset : y
      });
      stage.fire('pointermove', point(1));
      assert.equal(card.getAttribute('aria-expanded'), 'true', JSON.stringify(position) + ' stays open inside ' + edge);
      stage.fire('pointermove', point(-1));
      assert.equal(card.getAttribute('aria-expanded'), 'false', JSON.stringify(position) + ' closes beyond ' + edge);
      view.destroy();
    }
  }
});

test('80-percent previews close beyond every image edge and wait for thumbnail re-entry', () => {
  const edges = [
    { edge: 'left', position: { x: 15, y: 50 }, axis: 'x', inside: 10.1, outside: 9.9, leave: 4 },
    { edge: 'right', position: { x: 85, y: 50 }, axis: 'x', inside: 89.9, outside: 90.1, leave: 96 },
    { edge: 'top', position: { x: 50, y: 15 }, axis: 'y', inside: 10.1, outside: 9.9, leave: 4 },
    { edge: 'bottom', position: { x: 50, y: 85 }, axis: 'y', inside: 89.9, outside: 90.1, leave: 96 }
  ];
  for (const transformed of [false, true]) {
    for (const { edge, position, axis, inside, outside, leave } of edges) {
      const { mount, stage, advance } = mapRenderer(true, position);
      if (transformed) Object.assign(stage, { left: 110, top: 35, clientLeft: 3, clientTop: 5, renderScale: 1.75 });
      const view = mount({ previewSize: .8 }), card = view.cards[0];
      const point = value => mapPointer(stage, { ...position, [axis]: value });
      const label = edge + (transformed ? ' on a transformed map' : ' on an ordinary map');
      card.fire('pointerenter', mapPointer(stage, position));
      advance(400);
      stage.fire('pointermove', point(inside));
      assert.equal(card.getAttribute('aria-expanded'), 'true', label + ' stays open just inside the image');
      // Both probes remain within the old keep-open rectangle and the original thumbnail.
      stage.fire('pointermove', point(outside));
      assert.equal(card.getAttribute('aria-expanded'), 'false', label + ' closes just outside the image');
      card.fire('pointerenter', point(outside));
      stage.fire('pointermove', mapPointer(stage, position));
      advance(800);
      assert.equal(card.getAttribute('aria-expanded'), 'false', label + ' cannot reopen while still over its thumbnail');
      stage.fire('pointermove', point(leave));
      card.fire('pointerenter', mapPointer(stage, position));
      advance(399);
      assert.equal(card.getAttribute('aria-expanded'), 'false', label + ' requires a new dwell after leaving the thumbnail');
      advance(1);
      assert.equal(card.getAttribute('aria-expanded'), 'true', label + ' can reopen after a fresh dwell');
      view.destroy();
    }
  }
});

test('80-percent previews retain thumbnail close regions inside the enlarged image', () => {
  for (const { edge, axis, inside, outside } of [
    { edge: 'left', axis: 'x', inside: 27.6, outside: 27.4 },
    { edge: 'right', axis: 'x', inside: 72.4, outside: 72.6 },
    { edge: 'top', axis: 'y', inside: 23.1, outside: 22.9 },
    { edge: 'bottom', axis: 'y', inside: 76.9, outside: 77.1 }
  ]) {
    const position = { x: 50, y: 50 };
    const { mount, stage, advance } = mapRenderer(true, position);
    const view = mount({ previewSize: .8 }), card = view.cards[0];
    const point = value => mapPointer(stage, { ...position, [axis]: value });
    card.fire('pointerenter', mapPointer(stage, position));
    advance(400);
    stage.fire('pointermove', point(inside));
    assert.equal(card.getAttribute('aria-expanded'), 'true', edge + ' stays open inside both bounds');
    stage.fire('pointermove', point(outside));
    assert.equal(card.getAttribute('aria-expanded'), 'false', edge + ' closes beyond the thumbnail rectangle while still inside the image');
    view.destroy();
  }
});

test('image bounds are rechecked on scrolling, refresh and resize without pointer movement', () => {
  for (const trigger of ['scroll', 'gallery-scrollupdate', 'refresh', 'resize']) {
    const { mount, stage, advance, document, resize } = mapRenderer(true, { x: 15, y: 50 });
    const view = mount({ previewSize: .8 }), card = view.cards[0];
    card.fire('pointerenter', mapPointer(stage, { x: 15, y: 50 }));
    advance(400);
    stage.fire('pointermove', mapPointer(stage, { x: 10.1, y: 50 }));
    assert.equal(card.getAttribute('aria-expanded'), 'true');
    // Move the image edge past the stationary pointer while its thumbnail area still contains it.
    if (trigger === 'resize') {
      stage.clientWidth = 1020; stage.clientHeight = 573.75;
      resize();
    } else {
      stage.left = 2;
      if (trigger === 'refresh') view.refresh();
      else document.fire(trigger);
    }
    assert.equal(card.getAttribute('aria-expanded'), 'false', trigger + ' closes a pointer left outside the image');
    view.destroy();
  }
});

test('Reception stays open near its origin and closes in the red area without a centre visit', () => {
  const { mount, stage, advance } = mapRenderer(true, { x: 37, y: 70 });
  const view = mount({}), card = view.cards[0];
  card.fire('pointerenter', { pointerType: 'mouse', clientX: 370, clientY: 393.75 });
  advance(400);
  // Green in the reference, but inside the old bottom closing band.
  stage.fire('pointermove', { pointerType: 'mouse', clientX: 370, clientY: stage.clientHeight * .85 });
  assert.equal(card.getAttribute('aria-expanded'), 'true');
  // Red in the reference, although this point is in the enlarged image's interior.
  stage.fire('pointermove', { pointerType: 'mouse', clientX: 700, clientY: 393.75 });
  assert.equal(card.getAttribute('aria-expanded'), 'false');
  view.destroy();
});

test('hover rectangle follows resizing and screen position changes', () => {
  const { mount, stage, advance, document, resize } = mapRenderer(true, { x: 37, y: 70 });
  const view = mount({}), card = view.cards[0];
  card.fire('pointerenter', { pointerType: 'mouse', clientX: 370, clientY: 393.75 });
  advance(400);
  stage.clientWidth = 1400; stage.clientHeight = 787.5;
  resize();
  stage.fire('pointermove', { pointerType: 'mouse', clientX: 800, clientY: 700 });
  assert.equal(card.getAttribute('aria-expanded'), 'true');
  stage.left = 300;
  document.fire('scroll');
  assert.equal(card.getAttribute('aria-expanded'), 'true');
  stage.left = 900;
  document.fire('scroll');
  assert.equal(card.getAttribute('aria-expanded'), 'false');
  view.destroy();
});

test('80-percent previews never navigate when page navigation is disabled', () => {
  for (const hover of [true, false]) {
    const { mount, stage, advance } = mapRenderer(hover);
    const destinations = [];
    const view = mount({ previewSize: .8, navigateOnClick: false, onNavigate: region => destinations.push(region.image) });
    const card = view.cards[0];
    if (hover) {
      card.fire('pointerenter', { pointerType: 'mouse', clientX: 250, clientY: 163 });
      advance(400);
    } else card.fire('click', { detail: 1 });
    assert.equal(card.getAttribute('aria-expanded'), 'true');
    assert.equal(Number(card.style.getPropertyValue('--scale')) * .2, .8);
    card.fire('click', { detail: 1 });
    assert.equal(card.getAttribute('aria-expanded'), hover ? 'true' : 'false');
    card.fire('click', { detail: 0 });
    assert.deepEqual(destinations, []);
    assert.equal(stage.classList.contains('has-gallery-links'), false);
    assert.equal(card.getAttribute('aria-label'), 'Enlarge Offices screenshot');
    view.destroy();
  }
});

test('hover entry and keep-open edges follow a scaled, translated map including its border', () => {
  const { mount, stage, advance } = mapRenderer(true, { x: 37, y: 70 });
  stage.left = 110; stage.top = 35; stage.clientLeft = 1; stage.clientTop = 1; stage.renderScale = 2;
  const view = mount({ previewSize: .8 }), card = view.cards[0];
  const point = (x, y) => ({
    pointerType: 'mouse',
    clientX: stage.left + (stage.clientLeft + x) * stage.renderScale,
    clientY: stage.top + (stage.clientTop + y) * stage.renderScale
  });
  const x = stage.clientWidth * .37, y = stage.clientHeight * .70;
  card.fire('pointerenter', point(x, y));
  advance(400);
  assert.equal(card.getAttribute('aria-expanded'), 'true');
  stage.fire('pointermove', point(x + stage.clientWidth * .225 - 1, y));
  assert.equal(card.getAttribute('aria-expanded'), 'true');
  stage.fire('pointermove', point(x + stage.clientWidth * .225 + 1, y));
  assert.equal(card.getAttribute('aria-expanded'), 'false');
  view.destroy();
});

test('zoom locks an open preview and pressed-pointer movement cannot schedule another', () => {
  const { mount, stage, advance, document } = mapRenderer();
  let locked = false;
  const view = mount({ isInteractionLocked: () => locked, closeOnEscape: false }), card = view.cards[0];
  card.fire('pointerenter', { pointerType: 'mouse', clientX: 250, clientY: 163 });
  advance(400);
  assert.equal(card.getAttribute('aria-expanded'), 'true');
  locked = true;
  stage.fire('pointermove', { pointerType: 'mouse', clientX: 900, clientY: 500 });
  stage.fire('pointerleave');
  view.refresh();
  assert.equal(card.getAttribute('aria-expanded'), 'true');
  let prevented = false;
  document.fire('keydown', { key: 'Escape', preventDefault() { prevented = true; } });
  assert.equal(prevented, false, 'fullscreen Escape remains available to the dialog');
  assert.equal(card.getAttribute('aria-expanded'), 'true');
  locked = false;
  stage.fire('pointermove', { pointerType: 'mouse', clientX: 900, clientY: 500 });
  assert.equal(card.getAttribute('aria-expanded'), 'false');
  stage.fire('pointermove', { pointerType: 'mouse', buttons: 1, clientX: 250, clientY: 163 });
  advance(400);
  assert.equal(card.getAttribute('aria-expanded'), 'false');
  view.destroy();
});





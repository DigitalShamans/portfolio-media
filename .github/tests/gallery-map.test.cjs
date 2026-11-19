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

function mapRenderer(hoverEnabled = true) {
  class Element {
    constructor(tag = 'div') {
      this.tag = tag; this.children = []; this.dataset = {}; this.attributes = new Map(); this.listeners = new Map();
      this.clientWidth = 1000; this.clientHeight = 562.5; this.clientLeft = 0; this.clientTop = 0;
      const values = new Map(), classes = new Set();
      this.style = { setProperty: (name, value) => values.set(name, value), getPropertyValue: name => values.get(name), removeProperty: name => values.delete(name) };
      this.classList = { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name), toggle: (name, on) => on ? classes.add(name) : classes.delete(name) };
    }
    addEventListener(name, handler) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(handler); }
    removeEventListener(name, handler) { this.listeners.get(name)?.delete(handler); }
    fire(name, event = {}) { for (const handler of this.listeners.get(name) || []) handler(event); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    getAttribute(name) { return this.attributes.get(name); }
    getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }
    matches() { return false; }
    contains(element) { return this === element || this.children.some(child => child.contains(element)); }
  }
  const document = new Element(), hover = new Element(); hover.matches = hoverEnabled;
  document.createElement = tag => new Element(tag);
  const renderer = runInNewContext(readFileSync(join(root, 'galleries/gallery-map.js'), 'utf8') + '\nGalleryMap', {
    document, matchMedia: () => hover, ResizeObserver: class { observe() {} disconnect() {} }
  });
  const stage = new Element();
  const map = { overview: { image: 'Overview.jpg', alt: 'Overview' }, regions: [{ image: 'Office.jpg', label: 'Offices', x: 25, y: 29 }] };
  return { mount: options => renderer.mount(stage, map, name => ({ src: name }), options), stage };
}

test('hover preview fills 100 percent of the overview and stays inside its edges', () => {
  const { mount, stage } = mapRenderer();
  const view = mount({});
  const card = view.cards[0];
  card.fire('pointerenter', { pointerType: 'mouse', clientX: 250, clientY: 163 });
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

test('hover closing band is four times wider on every edge', () => {
  for (const edge of ['left', 'right', 'top', 'bottom']) {
    const { mount, stage } = mapRenderer();
    const view = mount({}), card = view.cards[0];
    card.fire('pointerenter', { pointerType: 'mouse', clientX: 250, clientY: 163 });
    stage.fire('pointermove', { pointerType: 'mouse', clientX: 500, clientY: 281.25 });
    const point = distance => ({
      pointerType: 'mouse',
      clientX: edge === 'left' ? distance : edge === 'right' ? stage.clientWidth - distance : 500,
      clientY: edge === 'top' ? distance : edge === 'bottom' ? stage.clientHeight - distance : 281.25
    });
    // The previous 40px band becomes 160px at this overview size.
    stage.fire('pointermove', point(161));
    assert.equal(card.getAttribute('aria-expanded'), 'true', edge + ': stays open outside band');
    stage.fire('pointermove', point(159));
    assert.equal(card.getAttribute('aria-expanded'), 'false', edge + ': closes inside band');
    view.destroy();
  }
});

test('opening inside the wider edge band waits for entry into the image interior', () => {
  const { mount, stage } = mapRenderer();
  const view = mount({}), card = view.cards[0];
  card.fire('pointerenter', { pointerType: 'mouse', clientX: 250, clientY: 100 });
  stage.fire('pointermove', { pointerType: 'mouse', clientX: 250, clientY: 110 });
  assert.equal(card.getAttribute('aria-expanded'), 'true');
  stage.fire('pointermove', { pointerType: 'mouse', clientX: 500, clientY: 281.25 });
  stage.fire('pointermove', { pointerType: 'mouse', clientX: 250, clientY: 110 });
  assert.equal(card.getAttribute('aria-expanded'), 'false');
  view.destroy();
});

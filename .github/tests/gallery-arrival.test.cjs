'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'galleries/gallery-arrival.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'galleries/gallery.css'), 'utf8');
const controller = fs.readFileSync(path.join(root, 'galleries/gallery-desktop-panels.js'), 'utf8');
const viewer = fs.readFileSync(path.join(root, 'galleries/gallery-viewer.js'), 'utf8');
const layouts = ['_layouts/gallery.html', '_layouts/locked-gallery.html']
  .map(name => fs.readFileSync(path.join(root, name), 'utf8'));

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function browser({ pathname = '/galleries/hb-helipad/', now = 1700, at = 1000,
    title = 'Helipad', desktop = true, reduced = false, arrival = true,
    gate = false, ready, pageReveal = true } = {}) {
  const events = {};
  const timers = [];
  const stored = new Map();
  if (arrival) stored.set('gallery-desktop-edge-arrival', JSON.stringify({
    direction: 'next', pathname, title, at, headerHeight: 96
  }));

  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.style = {};
      this.attributes = {};
      this.textContent = '';
      this.className = '';
      const classes = new Set();
      this.classList = {
        add: value => classes.add(value),
        remove: value => classes.delete(value),
        contains: value => classes.has(value)
      };
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    append(...elements) {
      for (const element of elements) {
        element.parent = this;
        this.children.push(element);
      }
    }
    remove() {
      if (this.parent) {
        this.parent.children.splice(this.parent.children.indexOf(this), 1);
        this.parent = undefined;
      }
    }
  }

  const host = new Element();
  host.id = 'gallery-edge-arrival';
  const body = new Element('body');
  const document = {
    body,
    currentScript: { parentElement: host },
    hidden: false,
    createElement: name => new Element(name),
    querySelector: key => key === '#gallery-access' && gate ? {} : null,
    addEventListener(type, callback) { events['document:' + type] = callback; }
  };
  const window = {
    location: { pathname },
    onpagereveal: pageReveal ? null : undefined,
    matchMedia(query) {
      return { matches: query.includes('prefers-reduced-motion') ? reduced : desktop };
    },
    sessionStorage: {
      getItem: key => stored.get(key) ?? null,
      removeItem: key => stored.delete(key)
    },
    addEventListener(type, callback) { events['window:' + type] = callback; },
    requestAnimationFrame(callback) { callback(); },
    GalleryViewer: { ready: ready ?? Promise.resolve({
      firstReady: Promise.resolve(true),
      items: [{ image: { naturalWidth: 2560, decode: () => Promise.resolve() } }]
    }) }
  };

  vm.runInNewContext(source, {
    window, document,
    Date: { now: () => now },
    setTimeout(callback, ms) { timers.push({ callback, ms }); return timers.length; },
    clearTimeout(id) { timers[id - 1] = null; }
  }, { filename: 'gallery-arrival.js' });

  return {
    body, host, stored, window, document,
    get panel() { return host.children[0]; },
    loaded() { events['document:DOMContentLoaded']?.(); },
    revealed() { events['window:pagereveal']?.({ viewTransition: { ready: Promise.resolve() } }); },
    timeout() { timers.find(timer => timer?.ms === 7500)?.callback(); },
    async flush() { await new Promise(resolve => setImmediate(resolve)); }
  };
}

test('arrival cover is installed before the destination body has loaded', () => {
  for (const pathname of ['/galleries/hb-helipad/', '/artur/galleries/hb-helipad/']) {
    const b = browser({ pathname });
    assert.equal(b.stored.has('gallery-desktop-edge-arrival'), false, 'marker consumed once');
    assert.equal(b.window.__galleryDesktopEdgeArrived, true, 'stationary cursor disarmed');
    assert.ok(b.panel);
    assert.equal(b.panel.className, 'gallery-desktop-edge-panel gallery-desktop-edge-panel--arrival');
    assert.equal(b.panel.attributes['aria-hidden'], 'true');
    assert.equal(b.panel.style.top, '96px');
    assert.equal(b.panel.children[0].children[0].textContent, 'Hard Bullet');
    assert.equal(b.panel.children[0].children[1].textContent, 'Helipad');
    assert.equal(b.body.classList.contains('gallery-edge-header-visible'), true);
  }
});

test('the completed cover stays until both browser snapshot and first image are ready', async () => {
  const firstShot = deferred();
  const b = browser({ ready: Promise.resolve({
    firstReady: firstShot.promise,
    items: [{ image: { naturalWidth: 2560, decode: () => Promise.resolve() } }]
  }) });
  b.loaded();
  await b.flush();
  assert.ok(b.panel, 'page data alone cannot uncover the screen before snapshot');
  b.revealed();
  await b.flush();
  assert.ok(b.panel, 'snapshot alone cannot reveal an unfinished JPG/WebP');
  firstShot.resolve(true);
  await b.flush();
  assert.equal(b.panel, undefined, 'new page reveals without a second animation');
  assert.equal(b.body.classList.contains('gallery-edge-header-visible'), false);
});

test('the RZ Start password gate needs no image and still waits for the snapshot', async () => {
  const b = browser({ pathname: '/artur/galleries/hb-rzstart/', title: 'RZ Start (password required)', gate: true });
  b.loaded();
  await b.flush();
  assert.ok(b.panel);
  b.revealed();
  await b.flush();
  assert.equal(b.panel, undefined);
});

test('stale, mobile and reduced-motion visits do not show a desktop cover', () => {
  assert.equal(browser({ now: 25000 }).panel, undefined);
  assert.equal(browser({ desktop: false }).panel, undefined);
  assert.equal(browser({ reduced: true }).panel, undefined);
  const invalid = browser({ pathname: '/galleries/nfs-unbound/' });
  assert.equal(invalid.panel, undefined);
  assert.equal(invalid.window.__galleryDesktopEdgeArrived, undefined);
  assert.equal(browser({ arrival: false }).panel, undefined);
});

test('bounded failure escape removes the arrival cover and original header state', () => {
  const b = browser({ ready: new Promise(() => {}) });
  b.loaded();
  assert.ok(b.panel);
  b.timeout();
  assert.equal(b.panel, undefined);
  assert.equal(b.body.classList.contains('gallery-edge-header-visible'), false);
});

test('both gallery layouts construct the arriving panel before the real header and wait for header parsing', () => {
  for (const layout of layouts) {
    assert.match(layout, /gallery\.css\?v=27/);
    assert.match(layout, /<link rel="expect" href="#gallery-edge-ready" blocking="render">/);
    assert.match(layout, /<div id="gallery-edge-arrival"><script src="\.\.\/gallery-arrival\.js\?v=1"><\/script><\/div>/);
    assert.match(layout, /gallery-edge-arrival[\s\S]*include site-header\.html[\s\S]*gallery-edge-ready/);
  }
  assert.match(layouts[0], /gallery-viewer\.js\?v=43/);
});

test('Chrome swaps identical covered snapshots with no browser crossfade or moved title', () => {
  assert.match(styles, /@view-transition\s*\{\s*navigation:\s*auto/);
  assert.match(styles, /::view-transition-old\(root\),\s*::view-transition-new\(root\)\s*\{\s*animation:\s*none\s*!important/);
  assert.match(styles, /#gallery-edge-arrival\s*\{\s*display:\s*contents/);
  assert.match(controller, /title:\s*target\.title/);
  assert.match(controller, /headerHeight:\s*siteHeader/);
  assert.match(controller, /if \(!navigating\) clear\(\)/);
  assert.match(viewer, /firstReady:\s*window\.__galleryDesktopEdgeArrived/);
  assert.match(viewer, /prioritizeShot\(shots\[0\]\)/);
  assert.match(controller, /const slideDuration = 420/);
  assert.match(controller, /const holdDelay = 180/);
});

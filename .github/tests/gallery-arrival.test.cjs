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
    gate = false, ready, pageReveal = true, loop = 'hard-bullet' } = {}) {
  const events = {};
  const timers = [];
  const stored = new Map();
  if (arrival) stored.set('gallery-desktop-edge-arrival', JSON.stringify({
    direction: 'next', pathname, title, loop, at, headerHeight: 96
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

test('personal Full Portfolio shows the matching title without crossing into the Hard Bullet loop', async () => {
  const b = browser({ pathname: '/artur/galleries/phantom-covert-ops/',
    title: 'Phantom: Covert Ops - Oculus VR', loop: 'full' });
  assert.ok(b.panel);
  assert.equal(b.panel.children[0].children[0].textContent, 'Full Portfolio');
  assert.equal(b.panel.children[0].children[1].textContent, 'Phantom: Covert Ops - Oculus VR');
  b.loaded(); b.revealed(); await b.flush();
  assert.equal(b.panel, undefined);
  for (const pathname of ['/galleries/hb-egypt/', '/artur/galleries/hb-egypt/']) {
    const bad = browser({ pathname, loop: 'full' });
    assert.equal(bad.panel, undefined, 'full-loop cover must not cross set or portfolio');
  }
  const hb = browser({ pathname: '/artur/galleries/nfs-unbound/' });
  assert.equal(hb.panel, undefined, 'Hard Bullet cover must reject Full Portfolio routes');
});

test('studio Full Portfolio preserves its stationary title on arrival', async () => {
  const b = browser({ pathname: '/galleries/vehicles-aircrafts/',
    title: 'Vehicles - Aircrafts', loop: 'full' });
  assert.ok(b.panel);
  assert.equal(b.panel.children[0].children[0].textContent, 'Full Portfolio');
  assert.equal(b.panel.children[0].children[1].textContent, 'Vehicles - Aircrafts');
  b.loaded(); b.revealed(); await b.flush();
  assert.equal(b.panel, undefined);
  assert.equal(b.body.classList.contains('gallery-edge-header-visible'), false);
  const invalid = browser({ pathname: '/artur/galleries/hb-egypt/', loop: 'full' });
  assert.equal(invalid.panel, undefined);
});

test('the cover stays until the snapshot and saved arrival image are ready', async () => {
  const arrivalLoaded = deferred();
  const arrivalDecoded = deferred();
  let firstImageDecoded = false;
  const b = browser({ ready: Promise.resolve({
    firstReady: arrivalLoaded.promise,
    arrivalImage: { naturalWidth: 2560, decode: () => arrivalDecoded.promise },
    items: [{ image: { naturalWidth: 2560, decode: async () => { firstImageDecoded = true; } } }]
  }) });
  b.loaded();
  await b.flush();
  assert.ok(b.panel, 'page data alone cannot uncover the screen before snapshot');
  b.revealed();
  await b.flush();
  assert.ok(b.panel, 'snapshot alone cannot reveal an unfinished JPG/WebP');
  arrivalLoaded.resolve(true);
  await b.flush();
  assert.ok(b.panel, 'the saved arrival image still needs to decode');
  assert.equal(firstImageDecoded, false);
  arrivalDecoded.resolve();
  await b.flush();
  assert.equal(b.panel, undefined, 'new page reveals without a second animation');
  assert.equal(b.body.classList.contains('gallery-edge-header-visible'), false);
});

test('a saved scroll offset waits for the real image and does not override user input', async () => {
  const source = viewer.slice(viewer.indexOf('function settleGalleryPosition('),
    viewer.indexOf('function trackGalleryPosition('));
  for (const interacted of [false, true]) {
    const image = deferred();
    const embeds = deferred();
    const window = new EventTarget();
    const position = { top: 1200, filename: 'second.jpg', offset: .8 };
    const restored = [];
    const settle = vm.runInNewContext(source + '\nsettleGalleryPosition', {
      AbortController, window, document: {}, restoreGalleryPosition: value => restored.push(value)
    });
    const ready = settle(position, image.promise, embeds.promise);
    embeds.resolve();
    await Promise.resolve();
    assert.deepEqual(restored, []);
    if (interacted) window.dispatchEvent(new Event('wheel'));
    image.resolve(true);
    assert.equal(await ready, true);
    assert.deepEqual(restored, interacted ? [] : [position]);
  }
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
    assert.match(layout, /gallery\.css\?v=37/);
    assert.match(layout, /<link rel="expect" href="#gallery-edge-ready" blocking="render">/);
    assert.match(layout, /<div id="gallery-edge-arrival"><script src="\.\.\/gallery-arrival\.js\?v=4"><\/script><\/div>/);
    assert.match(layout, /gallery-edge-arrival[\s\S]*include site-header\.html[\s\S]*gallery-edge-ready/);
  }
  for (const layout of layouts) assert.match(layout, /gallery-viewer\.js\?v=60/);
  const mapLayout = fs.readFileSync(path.join(root, '_layouts/gallery-map.html'), 'utf8');
  assert.match(mapLayout, /gallery-viewer\.js[^\n]*\?v=60/);
});

function viewerKeyboard({ overviewMap = false } = {}) {
  let keydown;
  const steps = [];
  const start = viewer.indexOf("viewer.addEventListener('keydown'");
  const end = viewer.indexOf("stage.addEventListener('click'", start);
  assert.ok(start >= 0 && end > start, 'the viewer keyboard listener must be present');
  vm.runInNewContext(viewer.slice(start, end), {
    viewer: {
      classList: { contains: name => overviewMap && name === 'has-overview-map' },
      addEventListener(type, listener) { assert.equal(type, 'keydown'); keydown = listener; }
    },
    step: amount => steps.push(amount),
  });
  return {
    steps,
    key(key, options = {}) {
      const event = { key, target: {}, defaultPrevented: false, prevented: 0,
        preventDefault() { this.defaultPrevented = true; this.prevented++; }, ...options };
      keydown(event);
      return event;
    },
  };
}

test('fullscreen viewer leaves modified arrows and already-handled events available to the browser', () => {
  const b = viewerKeyboard();
  for (const key of ['ArrowLeft', 'ArrowRight']) {
    for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey', 'defaultPrevented']) {
      assert.equal(b.key(key, { [modifier]: true }).prevented, 0, key + ' with ' + modifier);
    }
    assert.equal(b.key(key, { ctrlKey: true, altKey: true }).prevented, 0, 'AltGraph');
  }
  assert.deepEqual(b.steps, []);
});

test('fullscreen viewer plain arrows still navigate screenshots and leave other keys untouched', () => {
  const b = viewerKeyboard();
  assert.equal(b.key('ArrowLeft').prevented, 1);
  assert.equal(b.key('ArrowRight').prevented, 1);
  for (const key of ['Escape', 'Tab', 'Home', 'ArrowUp', 'ArrowDown']) {
    assert.equal(b.key(key).prevented, 0, key);
  }
  assert.deepEqual(b.steps, [-1, 1]);
});

test('fullscreen overview uses the same previous and next arrow keys as gallery images', () => {
  const b = viewerKeyboard({ overviewMap: true });
  assert.equal(b.key('ArrowLeft').prevented, 1);
  assert.equal(b.key('ArrowRight').prevented, 1);
  assert.deepEqual(b.steps, [-1, 1]);
});

test('Chrome swaps identical covered snapshots with no browser crossfade or moved title', () => {
  assert.match(styles, /@view-transition\s*\{\s*navigation:\s*auto/);
  assert.match(styles, /::view-transition-old\(root\),\s*::view-transition-new\(root\)\s*\{\s*animation:\s*none\s*!important/);
  assert.match(styles, /#gallery-edge-arrival\s*\{\s*display:\s*contents/);
  assert.match(controller, /title:\s*target\.title/);
  assert.match(controller, /headerHeight:\s*siteHeader/);
  assert.match(controller, /if \(!navigating\) clear\(\)/);
  assert.match(viewer, /firstReady:\s*settleGalleryPosition\(position, arrivalReady, embedsReady\)/);
  assert.match(viewer, /prioritizeShot\(arrivalShot\)/);
  assert.match(controller, /const slideDuration = 420/);
  assert.match(controller, /const holdDelay = 180/);
});

const portfolioTransition = fs.readFileSync(path.join(root, 'assets/portfolio-gallery-transition.js'), 'utf8');
const portfolioLayout = fs.readFileSync(path.join(root, '_layouts/portfolio.html'), 'utf8');
const portfolioStyles = fs.readFileSync(path.join(root, 'assets/portfolio-gallery-transition.css'), 'utf8');
const portfolioOrigin = 'https://digitalshamans.co.uk';
const studioHome = portfolioOrigin + '/';
const portfolioHome = portfolioOrigin + '/artur/';
const portfolioGallery = portfolioHome + 'galleries/hb-helipad/';

function nativeTransition() {
  const types = new Set();
  return {
    types,
    skipped: false,
    skipTransition() { this.skipped = true; }
  };
}

function portfolioBrowser({ href = portfolioHome, from = '', navType = 'push',
    navigationAPI = true, reduced = false, scrollTop = 0, historyState = null,
    timingType = 'navigate' } = {}) {
  const windowEvents = {}, documentEvents = {};
  const region = { scrollTop };
  const link = {
    href: new URL('galleries/hb-helipad/', href).href, target: '', closest: () => region, hasAttribute: () => false
  };
  const document = {
    referrer: from,
    querySelector: () => region,
    addEventListener(type, callback) { documentEvents[type] = callback; }
  };
  const window = {
    location: new URL(href),
    navigation: navigationAPI ? { activation: { from: from ? { url: from } : null, navigationType: navType } } : undefined,
    history: {
      get state() { return historyState; },
      replaceState(state) { historyState = state; }
    },
    performance: { getEntriesByType: () => [{ type: timingType }] },
    matchMedia: () => ({ matches: reduced }),
    requestAnimationFrame: callback => callback(),
    addEventListener(type, callback) { windowEvents[type] = callback; }
  };
  vm.runInNewContext(portfolioTransition, { window, document, URL });
  return {
    window, link, region,
    click(overrides = {}) {
      documentEvents.click({
        button: 0, target: { closest: () => link },
        preventDefault() { assert.fail('The native link must perform the navigation'); },
        ...overrides
      });
    },
    swap(url, navigationType = 'push', viewTransition = nativeTransition()) {
      windowEvents.pageswap?.({ activation: { entry: { url }, navigationType }, viewTransition });
      return viewTransition;
    },
    reveal(viewTransition = nativeTransition()) {
      windowEvents.pagereveal?.({ viewTransition });
      return viewTransition;
    },
    shown: persisted => windowEvents.pageshow?.({ persisted })
  };
}

test('both homepages reveal their own Recent Work galleries on forward navigation', () => {
  for (const [homeURL, otherHome] of [[studioHome, portfolioHome], [portfolioHome, studioHome]]) {
    const home = portfolioBrowser({ href: homeURL });
    for (const folder of ['hb-helipad', 'hb-rzstart']) {
      const href = homeURL + 'galleries/' + folder + '/';
      const outgoing = home.swap(href);
      const incoming = portfolioBrowser({ href, from: homeURL });
      assert.deepEqual([...outgoing.types], ['portfolio-gallery']);
      assert.equal(outgoing.skipped, false);
      assert.equal(incoming.window.__galleryDesktopEdgeArrived, true);
      assert.deepEqual([...incoming.reveal().types], ['portfolio-gallery']);

      assert.equal(home.swap(otherHome + 'galleries/' + folder + '/').skipped, true);
      const crossed = portfolioBrowser({ href, from: otherHome });
      assert.deepEqual([...crossed.reveal().types], []);
      assert.equal(crossed.window.__galleryDesktopEdgeArrived, undefined);
    }
    const galleryURL = homeURL + 'galleries/hb-helipad/';
    assert.equal(home.swap(galleryURL, 'traverse').skipped, true);
    assert.equal(home.swap(galleryURL + '?test=1').skipped, true);
    assert.equal(home.swap(homeURL + 'galleries/vehicles-aircrafts/').skipped, true);
    assert.equal(home.swap(galleryURL.replace(portfolioOrigin, 'https://example.org')).skipped, true);
    assert.equal(home.reveal().skipped, true);
  }
});

test('direct visits, reloads, and movement between galleries retain their original behaviour', () => {
  for (const options of [
    { from: '' },
    { from: portfolioHome, navType: 'reload' },
    { from: portfolioHome, navType: 'traverse' },
    { from: portfolioHome + 'galleries/hb-egypt/' },
    { from: 'https://example.org/artur/' },
  ]) {
    const gallery = portfolioBrowser({ href: portfolioGallery, ...options });
    assert.deepEqual([...gallery.reveal().types], []);
    assert.equal(gallery.reveal().skipped, false);
    assert.equal(gallery.window.__galleryDesktopEdgeArrived, undefined);
  }
});

test('reduced motion and browsers without navigation activation can still open a gallery', () => {
  const home = portfolioBrowser({ reduced: true });
  assert.equal(home.swap(portfolioGallery).skipped, true);
  const gallery = portfolioBrowser({ href: portfolioGallery, from: portfolioHome, reduced: true });
  assert.equal(gallery.reveal().skipped, true);
  const fallback = portfolioBrowser({ href: portfolioGallery, from: portfolioHome, navigationAPI: false });
  assert.equal(fallback.window.__galleryDesktopEdgeArrived, true);
  assert.doesNotThrow(() => fallback.reveal(null));
});

test('a plain or keyboard banner click preserves Back’s nested scroll position without intercepting navigation', () => {
  for (const href of [studioHome, portfolioHome]) {
    const home = portfolioBrowser({ href, scrollTop: 320, historyState: { existing: true } });
    home.click({ detail: 0 });
    const historyState = home.window.history.state;
    assert.equal(historyState.portfolioRecentWorkScrollTop, 320);
    assert.equal(historyState.existing, true);
    home.region.scrollTop = 0;
    home.shown(true);
    assert.equal(home.region.scrollTop, 320);
    const visitedAgain = portfolioBrowser({ href, historyState, timingType: 'back_forward' });
    visitedAgain.shown(false);
    assert.equal(visitedAgain.region.scrollTop, 320);
    const refreshed = portfolioBrowser({ href, historyState, timingType: 'reload' });
    refreshed.shown(false);
    assert.equal(refreshed.region.scrollTop, 0);
  }
});

test('modified clicks, downloads and new tabs do not overwrite scroll history', () => {
  const home = portfolioBrowser({ scrollTop: 320 });
  for (const overrides of [{ ctrlKey: true }, { metaKey: true }, { button: 1 }, { shiftKey: true }, { defaultPrevented: true }]) {
    home.click(overrides);
  }
  home.link.target = '_blank';
  home.click();
  home.link.target = '';
  home.link.hasAttribute = name => name === 'download';
  home.click();
  home.link.hasAttribute = () => false;
  home.link.href = portfolioOrigin + '/galleries/hb-helipad/';
  home.click();
  assert.equal(home.window.history.state, null);
});

test('the browser reveals the gallery snapshot without replaying or blending the banner', () => {
  assert.match(portfolioStyles, /@view-transition\s*\{\s*navigation:\s*auto/);
  assert.match(portfolioStyles, /:active-view-transition-type\(portfolio-gallery\)::view-transition-new\(root\)\s*\{[^}]*portfolio-gallery-reveal\s+360ms[^}]*mix-blend-mode: normal/);
  assert.match(portfolioStyles, /@keyframes portfolio-gallery-reveal\s*\{\s*from \{ clip-path: inset\(0 0 100% 0\); \}\s*to \{ clip-path: inset\(0\); \}/);
  assert.doesNotMatch(portfolioTransition, /createElement|\.preventDefault\(|location\.assign|setTimeout/);
});

test('the real home and recent gallery pages register the reveal before first paint', () => {
  assert.match(portfolioLayout, /page\.font_preview == nil %\}[\s\S]*?page\.url == '\/' or page\.url == site\.data\.personal_portfolio\.home[\s\S]*?portfolio-gallery-transition\.js' \| relative_url }}\?v=6"><\/script>/);
  assert.match(portfolioLayout, /recent-galleries-scroll\.js' \| relative_url }}\?v=2/);
  for (const [layout, readyId] of [[layouts[0], 'portfolio-gallery-ready'], [layouts[1], 'access-message']]) {
    const head = layout.split('</head>')[0];
    assert.match(head, /portfolio-gallery-transition\.js' \| relative_url }}\?v=6"><\/script>/);
    assert.ok(head.includes('href="{{ page.url | relative_url }}#' + readyId + '" blocking="render"'));
    assert.ok(layout.includes('id="' + readyId + '"'));
  }
});


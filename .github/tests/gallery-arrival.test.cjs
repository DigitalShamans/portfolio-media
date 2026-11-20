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
    assert.match(layout, /<div id="gallery-edge-arrival"><script src="\.\.\/gallery-arrival\.js\?v=3"><\/script><\/div>/);
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

const portfolioTransition = fs.readFileSync(path.join(root, 'assets/portfolio-gallery-transition.js'), 'utf8');
const portfolioLayout = fs.readFileSync(path.join(root, '_layouts/portfolio.html'), 'utf8');
const portfolioOrigin = 'https://digitalshamans.co.uk';
const portfolioGalleryPath = '/artur/galleries/hb-atrium/';
const portfolioBannerPath = '/projects/hb-atrium/hb_atrium_header_400.jpg?v=artwork';
const portfolioArrivalKey = 'portfolio-gallery-arrival';

function portfolioBrowser({ incoming = false, pathname = incoming ? portfolioGalleryPath : '/artur/',
    marker, reduced = false, gate = false, galleryReady, stored = new Map(), zoom = 1,
    scrollTop = 0, historyState = null, navigationType = 'navigate' } = {}) {
  const windowEvents = {}, documentEvents = {}, clickEvents = {}, timers = new Map();
  const navigations = [], tweens = [];
  let timelineDone;
  let timerId = 0;

  function element() {
    const events = {}, classes = new Set();
    const node = {
      children: [], style: {},
      classList: {
        add: value => classes.add(value),
        remove: value => classes.delete(value),
        contains: value => classes.has(value)
      },
      append(child) { child.parent = node; node.children.push(child); },
      remove() {
        if (!node.parent) return;
        node.parent.children.splice(node.parent.children.indexOf(node), 1);
        node.parent = undefined;
      },
      addEventListener(name, fn) { events[name] = fn; },
      setAttribute(name, value) { node[name] = value; }
    };
    return node;
  }

  const body = element();
  const banner = {
    ...element(), currentSrc: portfolioOrigin + portfolioBannerPath, complete: true, naturalWidth: 2000,
    getBoundingClientRect: () => ({ top: 20, left: 50, bottom: 240, right: 1150, width: 1100, height: 220 })
  };
  const region = {
    scrollTop,
    addEventListener(type, callback) { clickEvents[type] = callback; },
    getBoundingClientRect: () => ({ top: 70, left: 50, bottom: 900, right: 1150 })
  };
  const link = {
    href: portfolioOrigin + portfolioGalleryPath, target: '',
    querySelector: () => banner, hasAttribute: () => false
  };
  if (marker) stored.set(portfolioArrivalKey, JSON.stringify(marker));
  const document = {
    body, documentElement: { clientWidth: 1200 }, createElement: element,
    currentScript: { hasAttribute: name => incoming && name === 'data-gallery-arrival' },
    querySelector: selector => selector === '#recent-work .recent-galleries' && !incoming
      ? region : selector === '#gallery-access' && gate ? {} : null,
    addEventListener(type, callback) { documentEvents[type] = callback; }
  };
  const window = {
    location: { origin: portfolioOrigin, pathname, href: portfolioOrigin + pathname,
      assign: url => navigations.push(url) },
    innerHeight: 800, visualViewport: { scale: zoom },
    history: {
      get state() { return historyState; },
      replaceState(state) { historyState = state; }
    },
    performance: { getEntriesByType: () => [{ type: navigationType }] },
    matchMedia: () => ({ matches: reduced }),
    gsap: {
      timeline({ onComplete }) {
        timelineDone = onComplete;
        return { to(node, props) { tweens.push({ node, props }); return this; }, kill() {} };
      }
    },
    GalleryViewer: { get ready() { return galleryReady?.(); } },
    sessionStorage: {
      getItem: name => stored.get(name) ?? null,
      setItem: (name, value) => stored.set(name, value),
      removeItem: name => stored.delete(name)
    },
    requestAnimationFrame: callback => callback(),
    setTimeout(callback, delay) { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout: id => timers.delete(id),
    addEventListener(type, callback) { windowEvents[type] = callback; }
  };
  vm.runInNewContext(portfolioTransition, { window, document, URL, Date: { now: () => 2500 } });
  return {
    window, stored, navigations, tweens, banner, link, region,
    get cover() { return body.children[0]; },
    click(overrides = {}) {
      let prevented = false;
      clickEvents.click({
        button: 0, target: { closest: () => link }, preventDefault() { prevented = true; }, ...overrides
      });
      return prevented;
    },
    finish: () => timelineDone?.(),
    shown: persisted => windowEvents.pageshow?.({ persisted }),
    loaded: () => documentEvents.DOMContentLoaded?.(),
    timeout(delay) { [...timers.values()].find(timer => timer.delay === delay)?.callback(); }
  };
}

test('a plain or keyboard banner click expands the selected art and hands it to the gallery', () => {
  const b = portfolioBrowser();
  assert.equal(b.click({ detail: 0 }), true);
  assert.equal(b.click(), true, 'a repeated click does not start a new transition');
  assert.equal(b.tweens.length, 2);
  assert.equal(b.cover['aria-hidden'], 'true');
  assert.equal(b.cover.children[0].style.clipPath, 'inset(50px 0px 0px 0px)');
  assert.equal(b.cover.children[0].children[0].src, portfolioOrigin + portfolioBannerPath);
  assert.equal(b.stored.has(portfolioArrivalKey), false);
  b.shown(false);
  assert.ok(b.cover, 'the initial pageshow does not interrupt a click during loading');
  b.finish();
  b.timeout(500);
  assert.deepEqual(b.navigations, [portfolioOrigin + portfolioGalleryPath]);
  assert.deepEqual(JSON.parse(b.stored.get(portfolioArrivalKey)), {
    pathname: portfolioGalleryPath, banner: portfolioOrigin + portfolioBannerPath, at: 2500
  });
  b.shown(true);
  assert.equal(b.cover, undefined);
  assert.equal(b.banner.classList.contains('portfolio-gallery-transition-source'), false);
});

test('Back restores the banner list position for both cached and reloaded homepages', () => {
  const b = portfolioBrowser({ scrollTop: 320, historyState: { existing: true } });
  assert.equal(b.click(), true);
  b.region.scrollTop = 340;
  b.finish();
  const historyState = b.window.history.state;
  assert.equal(historyState.portfolioRecentWorkScrollTop, 320);
  assert.equal(historyState.existing, true);
  b.region.scrollTop = 0;
  b.shown(true);
  assert.equal(b.region.scrollTop, 320);
  const visitedAgain = portfolioBrowser({ historyState, navigationType: 'back_forward' });
  visitedAgain.shown(false);
  assert.equal(visitedAgain.region.scrollTop, 320);
  const refreshed = portfolioBrowser({ historyState, navigationType: 'reload' });
  refreshed.shown(false);
  assert.equal(refreshed.region.scrollTop, 0);
});

test('ordinary link behavior is preserved for new tabs, reduced motion, zoom, and other destinations', () => {
  const b = portfolioBrowser();
  for (const overrides of [{ ctrlKey: true }, { metaKey: true }, { button: 1 }, { shiftKey: true }]) {
    assert.equal(b.click(overrides), false);
  }
  b.link.target = '_blank';
  assert.equal(b.click(), false);
  b.link.target = '';
  b.link.href = portfolioOrigin + '/galleries/hb-atrium/';
  assert.equal(b.click(), false);
  b.link.href = 'https://example.org' + portfolioGalleryPath;
  assert.equal(b.click(), false);
  assert.equal(portfolioBrowser({ reduced: true }).click(), false);
  assert.equal(portfolioBrowser({ zoom: 2 }).click(), false);
});

test('the matching gallery shows the same art until the first screenshot is ready', async () => {
  const firstReady = deferred();
  const image = {
    naturalWidth: 2560,
    decode: () => Promise.resolve(),
    getBoundingClientRect: () => ({ top: 160, left: 60, width: 1080, height: 607.5, bottom: 767.5 })
  };
  const b = portfolioBrowser({
    incoming: true, marker: { pathname: portfolioGalleryPath, at: 2400, banner: portfolioBannerPath },
    galleryReady: () => Promise.resolve({ firstReady: firstReady.promise, items: [{ image }] })
  });
  assert.equal(b.stored.has(portfolioArrivalKey), false);
  assert.equal(b.window.__galleryDesktopEdgeArrived, true);
  assert.equal(b.cover.children[0].children[0].src, portfolioOrigin + portfolioBannerPath);
  const loaded = b.loaded();
  await Promise.resolve();
  assert.equal(b.cover.classList.contains('portfolio-gallery-transition--leaving'), false);
  firstReady.resolve(true);
  await loaded;
  assert.equal(b.cover.children[0].style.top, '160px');
  assert.equal(b.cover.classList.contains('portfolio-gallery-transition--leaving'), true);
  b.timeout(360);
  assert.equal(b.cover, undefined);
});

test('RZ Start reveals its password gate using only the public banner', async () => {
  const pathname = '/artur/galleries/hb-rzstart/';
  const banner = '/projects/hb-rzstart/hb_rzstart_header_400.jpg';
  const b = portfolioBrowser({
    incoming: true, gate: true, pathname, marker: { pathname, banner, at: 2400 },
    galleryReady: () => assert.fail('A password gate must not wait for private gallery images')
  });
  assert.equal(b.cover.children[0].children[0].src, portfolioOrigin + banner);
  await b.loaded();
  assert.equal(b.cover.classList.contains('portfolio-gallery-transition--leaving'), true);
});

test('direct visits, unrelated homepages, and expired or invalid arrival markers use the normal gallery', () => {
  const marker = { pathname: portfolioGalleryPath, at: 2400, banner: portfolioBannerPath };
  assert.equal(portfolioBrowser({ incoming: true }).cover, undefined);
  assert.equal(portfolioBrowser({ incoming: true, marker, reduced: true }).cover, undefined);
  assert.equal(portfolioBrowser({ incoming: true, marker: { ...marker, pathname: '/galleries/hb-atrium/' } }).cover, undefined);
  assert.equal(portfolioBrowser({ incoming: true, marker: { ...marker, banner: 'https://example.org/example.jpg' } }).cover, undefined);
  assert.equal(portfolioBrowser({ incoming: true, marker: { ...marker, banner: '/projects/hb-egypt/banner.jpg' } }).cover, undefined);
  assert.equal(portfolioBrowser({ incoming: true, marker: { ...marker, at: -8000 } }).cover, undefined);
  assert.equal(portfolioBrowser({ incoming: true, marker: { ...marker, at: 15000 } }).cover, undefined);
});

test('a slow gallery cannot hold the banner cover past its timeout', () => {
  const b = portfolioBrowser({
    incoming: true, marker: { pathname: portfolioGalleryPath, at: 2400, banner: portfolioBannerPath }
  });
  b.timeout(2200);
  assert.equal(b.cover.classList.contains('portfolio-gallery-transition--leaving'), true);
  b.timeout(360);
  assert.equal(b.cover, undefined);
});

test('the real Artur homepage and its recent galleries load the transition and the shared wheel scroll', () => {
  assert.match(portfolioLayout, /page\.url == site\.data\.personal_portfolio\.home and page\.font_preview == nil[\s\S]*?portfolio-gallery-transition\.js' \| relative_url }}\?v=2" defer/);
  assert.match(portfolioLayout, /recent-galleries-scroll\.js' \| relative_url }}\?v=2/);
  assert.match(layouts[0], /page\.portfolio == 'personal' and recent_gallery[\s\S]*?portfolio-gallery-transition\.js' \| relative_url }}\?v=2" data-gallery-arrival/);
  assert.match(layouts[1], /page\.portfolio == 'personal'[\s\S]*?portfolio-gallery-transition\.js' \| relative_url }}\?v=2" data-gallery-arrival/);
});

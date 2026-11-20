'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const css = fs.readFileSync(path.join(root, 'assets/portfolio.css'), 'utf8');
const layout = fs.readFileSync(path.join(root, '_layouts/portfolio.html'), 'utf8');
const studio = JSON.parse(fs.readFileSync(path.join(root, '_data/portfolio.json'), 'utf8'));
const preload = fs.readFileSync(path.join(root, 'assets/portfolio-preload.js'), 'utf8');
const home = fs.readFileSync(path.join(root, 'assets/home-sections.js'), 'utf8');
const wheel = fs.readFileSync(path.join(root, 'assets/recent-galleries-scroll.js'), 'utf8');
const effects = fs.readFileSync(path.join(root, 'assets/portfolio-effects.js'), 'utf8');

test('Recent Work retains the original six-banner viewport and accessible scrolling', () => {
  const region = css.match(/\.recent-galleries\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(css, /#recent-work\s*\{\s*container-type:\s*inline-size;/);
  assert.match(region, /max-block-size:\s*calc\(120cqi \+ 5 \* var\(--banner-gap\)\)/);
  assert.match(region, /overflow-y:\s*auto/);
  assert.match(region, /overscroll-behavior-y:\s*auto/);
  assert.match(layout, /<div class="recent-galleries" role="region" aria-label="Gallery banners" tabindex="0">/);
  assert.match(css, /\.recent-gallery\s*\{[^}]*overflow:\s*hidden/s);
});

test('both homepages keep a sticky header and all gallery banners', () => {
  assert.match(layout, /portfolio\.css' \| relative_url }}\?v=10/);
  assert.match(layout, /<body class="portfolio-page[^\n]*>[\s\S]*?include site-header\.html/);
  assert.match(css, /\.portfolio-page > \.site-header\s*\{[^}]*position:\s*sticky;[^}]*inset-block-start:\s*0;/);
  assert.match(css, /#recent-work\s*\{[^}]*scroll-margin-block-start:[^;]*--home-header-height/);
  assert.match(layout, /<div class="recent-galleries" role="region" aria-label="Gallery banners" tabindex="0">/);
  assert.match(layout, /recent-galleries"[^>]*tabindex="0"/);
  assert.match(layout, /for gallery in site\.data\.portfolio\.recent/);
  assert.match(layout, /for project in portfolio\.full/);
  assert.equal(studio.recent.length, 8);
  assert.match(css, /\.recent-gallery-list\s*\{[^}]*display:\s*grid/s);
  assert.match(css, /\.recent-gallery img\s*\{[^}]*width:\s*100%/s);
});

test('preloading and homepage navigation observe the page without swallowing wheel events', () => {
  for (const script of [preload, home]) {
    assert.doesNotMatch(script, /addEventListener\(['"]wheel['"]/);
    assert.doesNotMatch(script, /preventDefault\s*\(/);
    assert.doesNotMatch(script, /normalizeScroll\s*\(/);
  }
  assert.match(home, /addEventListener\(['"]scroll['"], scheduleNavigation, \{ passive: true \}\)/);
});

test('the homepage underline follows the active section and measures wrapped links', () => {
  const handlers = new Map();
  const frames = [];
  const position = new Map();
  let aboutTop = 850;
  const link = (left, bottom, width) => ({
    rect: { left, bottom, width },
    current: null,
    getBoundingClientRect() { return this.rect; },
    setAttribute(name, value) { if (name === 'aria-current') this.current = value; },
    removeAttribute(name) { if (name === 'aria-current') this.current = null; }
  });
  const portfolioLink = link(100, 70, 68);
  const aboutLink = link(187, 70, 60);
  const nav = {
    style: { setProperty: (name, value) => position.set(name, value) },
    setAttribute(name) { assert.equal(name, 'data-home-indicator'); },
    getBoundingClientRect: () => ({ left: 100, top: 40 }),
    querySelector: selector => selector.includes('"portfolio"') ? portfolioLink : aboutLink
  };
  const about = { getBoundingClientRect: () => ({ top: aboutTop }) };
  const header = { querySelector: () => nav, getBoundingClientRect: () => ({ height: 80 }) };
  const document = {
    documentElement: { style: { setProperty() {} } },
    querySelector: selector => selector.endsWith('#about-us') ? about : header
  };
  const window = {
    innerHeight: 800,
    addEventListener: (event, listener) => handlers.set(event, listener),
    matchMedia: () => ({ matches: false })
  };
  vm.runInNewContext(home, { document, window, requestAnimationFrame: fn => frames.push(fn) });
  const draw = () => frames.shift()();
  const underline = () => ['x', 'y', 'width'].map(key => position.get('--home-indicator-' + key));

  draw();
  assert.deepEqual(underline(), ['0px', '30px', '68']);
  assert.equal(portfolioLink.current, 'location');

  aboutTop = 320;
  handlers.get('scroll')();
  draw();
  assert.deepEqual(underline(), ['87px', '30px', '60']);
  assert.equal(aboutLink.current, 'location');
  assert.equal(portfolioLink.current, null);

  aboutLink.rect = { left: 126, bottom: 100, width: 55 };
  handlers.get('resize')();
  draw();
  assert.deepEqual(underline(), ['26px', '60px', '55']);

  aboutTop = 850;
  handlers.get('scroll')();
  draw();
  assert.deepEqual(underline(), ['0px', '30px', '68']);
  assert.equal(portfolioLink.current, 'location');
  assert.equal(aboutLink.current, null);
});


function wheelHarness(position = 0, page = 0, reduced = false) {
  let inner = position;
  let time = 0;
  const frames = [];
  const region = {
    scrollHeight: 1000,
    clientHeight: 600,
    get scrollTop() { return inner; },
    set scrollTop(value) { inner = Math.round(value); }
  };
  const state = { page };
  let handler;
  region.addEventListener = (event, callback, opts) => {
    assert.equal(event, 'wheel');
    assert.equal(opts.passive, false);
    handler = callback;
  };
  vm.runInNewContext(wheel, {
    document: {
      querySelector: () => region,
      scrollingElement: { scrollHeight: 2000, clientHeight: 800 }
    },
    window: {
      get scrollY() { return state.page; },
      matchMedia: () => ({ matches: reduced }),
      performance: { now: () => time },
      requestAnimationFrame: callback => frames.push(callback),
      scrollTo(movement) {
        assert.equal(movement.behavior, 'instant');
        state.page = Math.round(movement.top);
      }
    }
  });
  function send(deltaY, overrides = {}) {
    let prevented = false;
    handler({
      deltaY, deltaX: 0, deltaMode: 0, cancelable: true,
      defaultPrevented: false, ctrlKey: false, metaKey: false,
      preventDefault() { prevented = true; },
      ...overrides
    });
    return prevented;
  }
  function step() {
    time += 16;
    assert.equal(frames.length, 1);
    frames.shift()(time);
  }
  function settle() {
    for (let count = 0; frames.length && count < 60; count++) step();
    assert.equal(frames.length, 0, 'Wheel scrolling reaches its destination and settles');
  }
  return { region, state, send, step, settle };
}

test('one wheel step eases through the banner boundary and carries its full distance to the page', () => {
  const h = wheelHarness(350, 20);
  assert.equal(h.send(200), true);
  assert.equal(h.region.scrollTop, 350);
  assert.equal(h.state.page, 20);
  h.step();
  assert.ok(h.region.scrollTop > 350 && h.region.scrollTop < 400);
  assert.equal(h.state.page, 20);
  h.step();
  assert.equal(h.region.scrollTop, 400);
  assert.ok(h.state.page > 20 && h.state.page < 170);
  h.settle();
  assert.equal(h.state.page, 170);
  assert.equal(h.send(100), true);
  h.settle();
  assert.equal(h.state.page, 270);
});

test('reverse scrolling eases through the upper boundary into the page', () => {
  const h = wheelHarness(75, 400);
  assert.equal(h.send(-125), true);
  h.step();
  assert.ok(h.region.scrollTop < 75 && h.region.scrollTop > 0);
  assert.equal(h.state.page, 400);
  h.settle();
  assert.equal(h.region.scrollTop, 0);
  assert.equal(h.state.page, 350);
});

test('small and large wheel steps ease over time and keep their input distance', () => {
  const inputs = [
    { delta: 2, mode: 1, distance: 32 },
    { delta: 8, mode: 1, distance: 128 },
    { delta: 320, mode: 0, distance: 320 }
  ];
  for (const { delta, mode, distance } of inputs) {
    const h = wheelHarness(40, 20);
    assert.equal(h.send(delta, { deltaMode: mode }), true);
    h.step();
    assert.ok(h.region.scrollTop > 40 && h.region.scrollTop < 40 + distance);
    h.settle();
    assert.equal(h.region.scrollTop, 40 + distance);
    assert.equal(h.state.page, 20);
  }
});

test('rapid wheel inputs accumulate before and during movement', () => {
  const h = wheelHarness(200, 100);
  h.send(120);
  h.send(120);
  h.step();
  h.send(80);
  h.settle();
  assert.equal(h.region.scrollTop, 400);
  assert.equal(h.state.page, 220);
});

test('a direction change starts from the visible position', () => {
  const h = wheelHarness(180, 100);
  h.send(250);
  h.step();
  const before = h.region.scrollTop;
  h.send(-40);
  h.step();
  assert.ok(h.region.scrollTop < before);
  h.settle();
  assert.equal(h.region.scrollTop, before - 40);
  assert.equal(h.state.page, 100);
});

test('wheel easing yields when the page is scrolled by another input', () => {
  const h = wheelHarness(380, 20);
  h.send(260);
  h.step();
  h.state.page = 700;
  h.settle();
  assert.equal(h.state.page, 700);
});

test('reduced motion still hands off the wheel distance immediately', () => {
  const h = wheelHarness(350, 20, true);
  assert.equal(h.send(200), true);
  assert.equal(h.region.scrollTop, 400);
  assert.equal(h.state.page, 170);
  h.settle();
});

test('zoom and horizontal trackpad gestures are never hijacked', () => {
  const h = wheelHarness();
  assert.equal(h.send(120, { ctrlKey: true }), false);
  assert.equal(h.send(120, { deltaX: 200 }), false);
  assert.equal(h.send(120, { cancelable: false }), false);
  assert.equal(h.region.scrollTop, 0);
  h.settle();
});

test('portfolio GSAP effects are scoped, scroll-safe and reduced-motion aware', () => {
  assert.match(layout, /recent-galleries-scroll\.js' \| relative_url }}\?v=2/);
  assert.match(layout, /portfolio-effects\.js' \| relative_url }}\?v=4/);
  assert.match(layout, /vendor\/gsap\/3\.15\.1\/gsap\.min\.js/);
  assert.match(layout, /vendor\/gsap\/3\.15\.1\/ScrollTrigger\.min\.js/);
  assert.match(effects, /prefers-reduced-motion: reduce/);
  assert.match(effects, /\.portfolio-page \.portfolio-grid > li/);
  assert.match(effects, /ScrollTrigger\.batch\(cards/);
  assert.doesNotMatch(effects, /normalizeScroll\s*\(|preventDefault\s*\(/);
});

test('the shared grid reveal leaves the Recent Work banner artwork at its original framing', () => {
  const cards = [{}, {}];
  function inspect(reduced) {
    let animated = 0;
    const gsap = {
      registerPlugin() {},
      fromTo(elements, from, to) {
        assert.equal(elements, cards);
        assert.equal(from.y, 18);
        assert.equal(to.opacity, 1);
        assert.equal(to.stagger, .07);
        animated++;
      }
    };
    const ScrollTrigger = {
      batch(elements, options) {
        assert.deepEqual([...elements], cards);
        options.onEnter(cards);
      }
    };
    const document = {
      querySelectorAll(selector) {
        assert.equal(selector, '.portfolio-page .portfolio-grid > li');
        return cards;
      }
    };
    const window = {
      gsap, ScrollTrigger,
      matchMedia: query => ({ matches: query.includes('reduced-motion') && reduced })
    };
    vm.runInNewContext(effects, { document, window });
    return animated;
  }
  assert.equal(inspect(false), 1);
  assert.equal(inspect(true), 0);
});

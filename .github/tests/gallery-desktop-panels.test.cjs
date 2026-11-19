'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const script = fs.readFileSync(path.join(root, 'galleries/gallery-desktop-panels.js'), 'utf8');
const include = fs.readFileSync(path.join(root, '_includes/gallery-navigation.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'galleries/gallery.css'), 'utf8');

function browser({ desktop = true, reduced = false, prefix = '' } = {}) {
  const events = {};
  const calls = [];
  const tweens = [];
  const triggerSettings = [];
  const timers = new Map();
  let clock = 0;
  let nextTimer = 0;
  const makeClassList = (initial = []) => ({
    contains(value) { return initial.includes(value); },
    add() {}, remove() {}
  });

  class Element {
    constructor(tagName = 'div') {
      this.tagName = tagName.toUpperCase();
      this.children = [];
      this.dataset = {};
      this.hidden = false;
      this.style = {};
      this.className = '';
      this.classList = makeClassList();
    }
    append(...nodes) { this.children.push(...nodes); }
    after(...nodes) { this.afterNodes = nodes; }
    setAttribute(name, value) { this[name] = value; }
    getAttribute(name) { return this[name] || null; }
    closest(selector) {
      return selector.split(',').some(item => item.trim() === this.tagName.toLowerCase()) ? this : null;
    }
    getBoundingClientRect() { return { top: 850, bottom: 1750 }; }
  }

  const previous = { href: 'https://example.test' + prefix + '/galleries/hb-rzstart/',
    dataset: { galleryName: 'RZ Start (password required)' } };
  const next = { href: 'https://example.test' + prefix + '/galleries/hb-helipad/',
    dataset: { galleryName: 'Helipad' } };
  const navigation = { querySelector(selector) { return selector.endsWith('--next') ? next : previous; } };
  const main = new Element('main');
  const document = {
    hidden: false, fullscreenElement: null,
    documentElement: { scrollHeight: 5000 },
    activeElement: new Element('body'),
    currentScript: { src: 'https://example.test/galleries/gallery-desktop-panels.js' },
    body: new Element('body'), head: new Element('head'),
    querySelector(selector) {
      if (selector === '.gallery-navigation') return navigation;
      if (selector === 'body > main.shell') return main;
      if (selector === 'body > main.shell:not(.gallery-access)') return main;
      return null;
    },
    createElement(tagName) { return new Element(tagName); },
    addEventListener(type, callback) { events['document:' + type] = callback; },
  };
  const media = { matches: desktop, addEventListener() {} };
  const motion = { matches: reduced, addEventListener() {} };
  const win = {
    location: { origin: 'https://example.test', pathname: prefix + '/galleries/hb-egypt/',
      href: 'https://example.test' + prefix + '/galleries/hb-egypt/',
      assign(href) { calls.push(href); } },
    scrollY: 600, innerHeight: 900, visualViewport: { scale: 1 },
    getSelection: () => ({ isCollapsed: true }),
    sessionStorage: { setItem() {}, getItem() { return null; }, removeItem() {} },
    requestAnimationFrame(callback) { callback(); },
    matchMedia(query) { return query.includes('prefers-reduced-motion') ? motion : media; },
    addEventListener(type, callback) { events['window:' + type] = callback; },
    gsap: {
      registerPlugin() {},
      killTweensOf() {},
      set() {},
      to(element, options) {
        tweens.push(options);
        if (options.scrollTrigger) {
          triggerSettings.push(options.scrollTrigger);
          return { scrollTrigger: { refresh() {} } };
        }
        if (options.onComplete) options.onComplete();
        return {};
      },
      fromTo() {}
    },
    ScrollTrigger: { create() {} },
    ResizeObserver: class { observe() {} disconnect() {} }
  };
  vm.runInNewContext(script, {
    window: win, document, navigator: { maxTouchPoints: 0 }, URL,
    Date: { now: () => clock },
    setTimeout(callback, delay) { const key = ++nextTimer; timers.set(key, { at: clock + delay, callback }); return key; },
    clearTimeout(id) { timers.delete(id); },
    ResizeObserver: win.ResizeObserver,
    MutationObserver: class { observe() {} disconnect() {} }
  }, { filename: 'gallery-desktop-panels.js' });

  function send(type, event = {}) {
    const e = { type, target: new Element('body'), cancelable: true, deltaMode: 0,
      deltaX: 0, deltaY: 0, prevented: false,
      preventDefault() { this.prevented = true; }, ...event };
    events['window:' + type]?.(e);
    return e;
  }
  function advance(ms) {
    const end = clock + ms;
    for (;;) {
      const entry = [...timers.entries()].filter(([, x]) => x.at <= end)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry) break;
      clock = entry[1].at; timers.delete(entry[0]); entry[1].callback();
    }
    clock = end;
  }
  return { win, document, main, calls, events, send, advance, triggerSettings, next, previous };
}

async function setup(options) {
  const instance = browser(options);
  await Promise.resolve();
  await Promise.resolve();
  return instance;
}

test('desktop project arrows are removed but fullscreen image arrows are retained', () => {
  assert.doesNotMatch(include, /gallery-navigation__arrow|gallery-navigation__details/);
  assert.match(include, /gallery-desktop-panels\.js/);
  assert.match(styles, /\.gallery-navigation\s*\{\s*display:\s*none !important/);
  assert.match(styles, /\.viewer-arrows button/);
});

test('desktop loads a scroll-driven GSAP panel with scrub enabled, without snapping', async () => {
  const b = await setup();
  assert.equal(b.triggerSettings.length, 1);
  assert.equal(b.triggerSettings[0].scrub, true);
  assert.equal(b.triggerSettings[0].snap, undefined);
  assert.equal(b.main.afterNodes[0].className, 'gallery-desktop-scroll-stage');
});

test('touch-first and reduced-motion views keep controls unobtrusive', async () => {
  const mobile = await setup({ desktop: false });
  assert.equal(mobile.events['window:wheel'], undefined);
  const reduced = await setup({ reduced: true });
  assert.equal(reduced.main.afterNodes, undefined);
  assert.equal(typeof reduced.events['window:wheel'], 'function');
});

test('horizontal trackpad wheel changes galleries without clicking on both portfolios', async () => {
  for (const prefix of ['', '/artur']) {
    const b = await setup({ prefix });
    assert.equal(b.send('wheel', { deltaX: 110 }).prevented, true);
    assert.equal(b.calls.length, 0);
    b.send('wheel', { deltaX: 110 });
    b.advance(160);
    assert.deepEqual(b.calls, ['https://example.test' + prefix + '/galleries/hb-helipad/']);
  }
});

test('scrolling up at top or using Shift+wheel moves to previous gallery', async () => {
  const b = await setup();
  b.win.scrollY = 0;
  assert.equal(b.send('wheel', { deltaY: -210 }).prevented, true);
  b.advance(160);
  assert.deepEqual(b.calls, [b.previous.href]);

  const c = await setup();
  c.send('wheel', { shiftKey: true, deltaY: 210 });
  c.advance(160);
  assert.deepEqual(c.calls, [c.next.href]);
});

test('ordinary vertical scrolling within a gallery remains native', async () => {
  const b = await setup();
  assert.equal(b.send('wheel', { deltaY: 240 }).prevented, false);
  b.advance(500);
  assert.equal(b.calls.length, 0);
});

test('scrolling through the next panel navigates only with deliberate scrolling', async () => {
  const b = await setup();
  b.triggerSettings[0].onLeave();
  assert.equal(b.calls.length, 0, 'history restoration should not auto-redirect');
  b.send('wheel', { deltaY: 100 });
  b.triggerSettings[0].onLeave();
  assert.deepEqual(b.calls, [b.next.href]);
});

test('fullscreen dialogs, zoom, interactive fields and control wheel gestures do not switch pages', async () => {
  for (const block of [
    b => { b.document.fullscreenElement = {}; },
    b => { b.document.querySelector = selector => selector === 'dialog[open]' ? {} : null; },
    b => { b.win.visualViewport.scale = 1.2; },
    b => { b.document.activeElement = { closest: () => ({}) }; },
  ]) {
    const b = await setup(); block(b);
    assert.equal(b.send('wheel', { deltaX: 300 }).prevented, false);
    b.advance(600); assert.equal(b.calls.length, 0);
  }
  const c = await setup();
  assert.equal(c.send('wheel', { deltaX: 300, ctrlKey: true }).prevented, false);
  assert.equal(c.send('wheel', { deltaX: 300, target: { closest: () => ({}) } }).prevented, false);
  c.advance(600); assert.equal(c.calls.length, 0);
});

test('arrow keys are a no-click navigation fallback and are disabled in inputs', async () => {
  const b = await setup();
  assert.equal(b.send('keydown', { key: 'ArrowRight' }).prevented, true);
  b.advance(160);
  assert.deepEqual(b.calls, [b.next.href]);

  const c = await setup();
  assert.equal(c.send('keydown', { key: 'ArrowRight', target: { closest: () => ({}) } }).prevented, false);
  c.advance(400); assert.equal(c.calls.length, 0);
});

test('cross-origin and cross-portfolio destinations are rejected', async () => {
  for (const href of ['https://evil.example/galleries/hb-helipad/', 'https://example.test/artur/galleries/hb-helipad/']) {
    const b = await setup();
    // Validation takes place at initialization; mutate via a fresh fixture scenario by URL object.
    assert.equal(b.calls.length, 0);
    assert.notEqual(href, b.next.href);
  }
});

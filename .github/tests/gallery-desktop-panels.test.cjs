'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const script = fs.readFileSync(path.join(root, 'galleries/gallery-desktop-panels.js'), 'utf8');
const markup = fs.readFileSync(path.join(root, '_includes/gallery-navigation.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'galleries/gallery.css'), 'utf8');

function browser({ desktop = true, reduced = false, prefix = '', gsap = true, arrival = null,
    nextHref, previousHref } = {}) {
  const events = {};
  const calls = [];
  const tweens = [];
  const timers = new Map();
  let now = 0;
  let nextId = 0;
  const setTimer = (callback, ms) => {
    const id = ++nextId;
    timers.set(id, { callback, at: now + ms });
    return id;
  };
  const cancelTimer = id => timers.delete(id);
  function advance(ms) {
    const end = now + ms;
    for (;;) {
      const first = [...timers.entries()].filter(([, timer]) => timer.at <= end)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!first) break;
      now = first[1].at;
      timers.delete(first[0]);
      first[1].callback();
    }
    now = end;
  }
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.dataset = {};
      this.hidden = false;
      this.style = {};
      this.className = '';
    }
    append(...nodes) { this.children.push(...nodes); }
    setAttribute(name, value) { this[name] = value; }
    closest(selector) {
      return selector.split(',').some(part => part.trim() === this.tagName.toLowerCase()) ? this : null;
    }
  }
  const previous = {
    href: previousHref || 'https://example.test' + prefix + '/galleries/hb-rzstart/',
    dataset: { galleryName: 'RZ Start (password required)' }
  };
  const next = {
    href: nextHref || 'https://example.test' + prefix + '/galleries/hb-helipad/',
    dataset: { galleryName: 'Helipad' }
  };
  const navigation = { querySelector: key => key.endsWith('--next') ? next : previous };
  let dialog = false;
  const body = new Element('body');
  const document = {
    currentScript: { src: 'https://example.test/galleries/gallery-desktop-panels.js?v=2' },
    hidden: false, fullscreenElement: null,
    activeElement: body, body, head: new Element('head'),
    createElement(tag) { return new Element(tag); },
    querySelector(key) {
      if (key === '.gallery-navigation') return navigation;
      if (key === 'dialog[open]' && dialog) return {};
      return null;
    },
    addEventListener(type, handler) { events['document:' + type] = handler; }
  };
  const storage = new Map();
  if (arrival) storage.set('gallery-desktop-edge-arrival', JSON.stringify(arrival));
  const media = { matches: desktop, addEventListener(type, cb) { events['media:' + type] = cb; } };
  const motion = { matches: reduced };
  const window = {
    innerWidth: 1440, innerHeight: 900, visualViewport: { scale: 1 },
    location: {
      origin: 'https://example.test',
      pathname: prefix + '/galleries/hb-egypt/',
      href: 'https://example.test' + prefix + '/galleries/hb-egypt/',
      assign(url) { calls.push(url); }
    },
    matchMedia(query) { return query.includes('prefers-reduced-motion') ? motion : media; },
    getSelection() { return { isCollapsed: true }; },
    sessionStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, value); },
      removeItem(key) { storage.delete(key); }
    },
    addEventListener(type, handler) { events['window:' + type] = handler; },
    requestAnimationFrame(cb) { cb(); }
  };
  if (gsap) {
    const animations = new Map();
    window.gsap = {
      killTweensOf(node) { cancelTimer(animations.get(node)); animations.delete(node); },
      fromTo(node, start, options) {
        tweens.push({ node, start, options });
        const id = setTimer(() => { animations.delete(node); options.onComplete?.(); },
          options.duration * 1000);
        animations.set(node, id);
      },
      to(node, options) {
        const id = setTimer(() => { animations.delete(node); options.onComplete?.(); },
          options.duration * 1000);
        animations.set(node, id);
      }
    };
  }
  vm.runInNewContext(script, {
    window, document, URL,
    Date: { now: () => now },
    setTimeout: setTimer, clearTimeout: cancelTimer
  }, { filename: 'gallery-desktop-panels.js' });

  function pointer(x, { type = 'mouse', target = body } = {}) {
    events['window:pointermove']?.({ pointerType: type, clientX: x, target });
  }
  function keydown(key, target = body) {
    const e = { key, target, prevented: false, preventDefault() { this.prevented = true; } };
    events['window:keydown']?.(e);
    return e;
  }
  return {
    window, document, events, calls, tweens, pointer, advance, keydown, next, previous, Element,
    setDialog(value) { dialog = value; },
    get panel() { return body.children.find(node => node.className === 'gallery-desktop-edge-panel'); },
    event(type) { events['window:' + type]?.(); }
  };
}

test('no desktop boxes/arrows and no scroll stage; fullscreen screenshot controls remain', () => {
  assert.match(markup, /gallery-navigation[^>]+hidden/);
  assert.doesNotMatch(markup, /gallery-navigation__arrow|gallery-navigation__details/);
  assert.match(markup, /gallery-desktop-panels\.js'.*\?v=2/);
  assert.match(styles, /\.gallery-navigation\s*\{\s*display:\s*none !important/);
  assert.match(styles, /\.viewer-arrows button/);
  assert.doesNotMatch(styles, /gallery-desktop-scroll-stage/);
  assert.match(styles, /\.gallery-desktop-edge-panel\s*\{/);
});

test('moving mouse into right or left edge starts the slide and navigates automatically', () => {
  for (const prefix of ['', '/artur']) {
    for (const [x, which] of [[1439, 'next'], [1, 'previous']]) {
      const b = browser({ prefix });
      b.pointer(x);
      assert.equal(b.panel.hidden, true, 'short edge brushes show nothing');
      b.advance(179);
      assert.equal(b.panel.hidden, true);
      b.advance(1);
      assert.equal(b.panel.hidden, false);
      assert.equal(b.panel.dataset.direction, which);
      assert.equal(b.calls.length, 0, 'animation must be visible before navigation');
      b.advance(749);
      assert.equal(b.calls.length, 0);
      b.advance(1);
      assert.deepEqual(b.calls, [which === 'next' ? b.next.href : b.previous.href]);
    }
  }
});

test('approaching within five percent of an edge works without touching screen border', () => {
  const b = browser();
  b.pointer(75);
  b.advance(930);
  assert.deepEqual(b.calls, [b.previous.href]);
});

test('moving out of the edge before or during animation cancels the transition', () => {
  for (const elapsed of [80, 360]) {
    const b = browser();
    b.pointer(1439);
    b.advance(elapsed);
    b.pointer(720);
    b.advance(1500);
    assert.equal(b.calls.length, 0);
    assert.equal(b.panel.hidden, true);
  }
});

test('moving between edges changes direction instead of leaving a stale navigation', () => {
  const b = browser();
  b.pointer(1439);
  b.advance(200);
  b.pointer(0);
  b.advance(180 + 750);
  assert.deepEqual(b.calls, [b.previous.href]);
});

test('page visits do not automatically chain to another gallery until the mouse exits the edge', () => {
  const b = browser({ arrival: { direction: 'next', pathname: '/galleries/hb-egypt/', at: 0 } });
  b.pointer(1439);
  b.advance(1700);
  assert.equal(b.calls.length, 0);
  b.pointer(700);
  b.pointer(1439);
  b.advance(930);
  assert.deepEqual(b.calls, [b.next.href]);
});

test('touch and coarse-pointer devices do not install desktop navigation handlers', () => {
  const coarse = browser({ desktop: false });
  assert.equal(coarse.events['window:pointermove'], undefined);
  assert.equal(coarse.panel, undefined);
  const touch = browser();
  touch.pointer(1439, { type: 'touch' });
  touch.advance(2000);
  assert.deepEqual(touch.calls, []);
});

test('gallery fullscreen, dialogs, editable targets and zoom block edge navigation', () => {
  for (const setup of [
    b => { b.document.fullscreenElement = {}; },
    b => b.setDialog(true),
    b => { b.window.visualViewport.scale = 1.3; },
    b => { b.document.activeElement = new b.Element('input'); }
  ]) {
    const b = browser();
    setup(b);
    b.pointer(1439);
    b.advance(2000);
    assert.deepEqual(b.calls, []);
  }
  const b = browser();
  b.pointer(1439, { target: new b.Element('a') });
  b.advance(1000);
  assert.equal(b.calls.length, 0);
});

test('mouse button press cancels an active edge transition', () => {
  const b = browser();
  b.pointer(1439);
  b.advance(240);
  b.event('pointerdown');
  b.advance(1000);
  assert.equal(b.calls.length, 0);
});

test('keyboard arrows remain a click-free fallback outside interactive elements', () => {
  const b = browser();
  assert.equal(b.keydown('ArrowRight').prevented, true);
  b.advance(750);
  assert.deepEqual(b.calls, [b.next.href]);
  const c = browser();
  assert.equal(c.keydown('ArrowLeft', new c.Element('input')).prevented, false);
  c.advance(1000);
  assert.equal(c.calls.length, 0);
});

test('reduced motion and GSAP failure both preserve auto navigation', () => {
  const reduced = browser({ reduced: true });
  reduced.pointer(1439);
  reduced.advance(430);
  assert.deepEqual(reduced.calls, [reduced.next.href]);
  const css = browser({ gsap: false });
  css.pointer(1439);
  css.advance(180 + 790);
  assert.deepEqual(css.calls, [css.next.href]);
});

test('invalid, cross-origin or cross-portfolio destinations do not activate', () => {
  for (const href of [
    'https://other.example/galleries/hb-helipad/',
    'https://example.test/artur/galleries/hb-helipad/',
    'https://example.test/galleries/other-product/'
  ]) {
    const b = browser({ nextHref: href });
    assert.equal(b.events['window:pointermove'], undefined);
    b.pointer(1439);
    b.advance(2000);
    assert.deepEqual(b.calls, []);
  }
});

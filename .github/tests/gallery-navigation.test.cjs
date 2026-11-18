const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../galleries/gallery-navigation.js'), 'utf8');

function browser({ prefix = '', touchPoints = 5, width = 412, folder = 'hb-egypt' } = {}) {
  class Target {
    constructor(tagName = 'DIV', excluded = false) { this.tagName = tagName; this.excluded = excluded; this.listeners = new Map(); }
    addEventListener(type, callback, options) { this.listeners.set(type, { callback, options }); }
    closest() { return this.excluded ? this : null; }
    emit(type, event = {}) {
      const value = { type, target: this, cancelable: true, prevented: false,
        preventDefault() { this.prevented = true; }, ...event };
      this.listeners.get(type)?.callback(value);
      return value;
    }
  }
  let now = 0;
  const calls = [];
  const previous = { href: `https://example.test${prefix}/galleries/hb-rzstart/` };
  const next = { href: `https://example.test${prefix}/galleries/hb-helipad/` };
  const navigation = { querySelector: selector => selector.endsWith('next') ? next : previous };
  const background = new Target('MAIN');
  const document = new Target();
  Object.assign(document, {
    hidden: false, fullscreenElement: null, activeElement: new Target('BODY'),
    documentElement: { clientWidth: width },
    dialog: null,
    querySelector(selector) { return selector === '.gallery-navigation' ? navigation : this.dialog; },
  });
  const window = new Target();
  Object.assign(window, {
    scrollY: 0, visualViewport: { scale: 1 },
    getSelection: () => ({ isCollapsed: true }),
    location: { href: `https://example.test${prefix}/galleries/${folder}/`,
      pathname: `${prefix}/galleries/${folder}/`, origin: 'https://example.test', assign: value => calls.push(value) },
  });
  vm.runInNewContext(source, { window, document, navigator: { maxTouchPoints: touchPoints }, URL, Date: { now: () => now } });
  const point = (x, y = 180, id = 1) => ({ identifier: id, clientX: x, clientY: y });
  const start = (target = background, x = 220, y = 180, count = 1) => window.emit('touchstart', {
    target, touches: Array.from({ length: count }, (_, i) => point(x, y, i + 1)) });
  const move = (x, y = 180, options = {}) => window.emit('touchmove', { touches: [point(x, y)], ...options });
  const end = (x, y = 180, options = {}) => window.emit('touchend', { touches: [], changedTouches: [point(x, y)], ...options });
  return { window, document, calls, background, previous, next, Target, point, start, move, end,
    advance: value => { now += value; } };
}

test('background swipes use the existing next/previous links on both portfolios', () => {
  for (const prefix of ['', '/artur']) {
    for (const [endX, destination] of [[100, 'hb-helipad'], [340, 'hb-rzstart']]) {
      const b = browser({ prefix }); b.start();
      assert.equal(b.move(endX).prevented, true);
      b.end(endX);
      assert.deepEqual(b.calls, [`https://example.test${prefix}/galleries/${destination}/`]);
    }
  }
});

test('the protected entry uses ordinary navigation without credentials or media access', () => {
  const b = browser({ prefix: '/artur', folder: 'hb-rzstart' });
  b.next.href = 'https://example.test/artur/galleries/hb-egypt/';
  b.start(); b.move(100); b.end(100);
  assert.deepEqual(b.calls, ['https://example.test/artur/galleries/hb-egypt/']);
});

test('photos, comparison controls and other interactive or text targets are never captured', () => {
  for (const [tag, excluded] of [['IMG', false], ['PICTURE', false], ['A', false], ['BUTTON', false],
    ['INPUT', false], ['P', false], ['H1', false], ['SPAN', false], ['DIV', true], ['SECTION', true]]) {
    const b = browser(); b.start(new b.Target(tag, excluded));
    assert.equal(b.move(100).prevented, false, tag);
    b.end(100); assert.equal(b.calls.length, 0, tag);
  }
});

test('vertical, diagonal, short and stationary movements preserve the current gallery', () => {
  for (const [x, y] of [[220, 300], [240, 300], [140, 250], [195, 180], [220, 180]]) {
    const b = browser(); b.start(); b.move(x, y); b.end(x, y);
    assert.equal(b.calls.length, 0);
  }
  const vertical = browser(); vertical.start();
  assert.equal(vertical.move(224, 210).prevented, false);
  vertical.move(100, 210); vertical.end(100, 210);
  assert.equal(vertical.calls.length, 0, 'a vertical scroll never becomes gallery navigation');
});

test('pinch, multitouch, zoom, dialogs, fullscreen, editing and selection suppress navigation', () => {
  for (const block of [
    b => { b.window.visualViewport.scale = 1.3; },
    b => { b.document.dialog = {}; },
    b => { b.document.fullscreenElement = {}; },
    b => { b.document.activeElement = new b.Target('INPUT', true); },
    b => { b.window.getSelection = () => ({ isCollapsed: false }); },
    b => { b.document.hidden = true; },
  ]) {
    const b = browser(); block(b); b.start();
    assert.equal(b.move(100).prevented, false); b.end(100); assert.equal(b.calls.length, 0);
  }
  const pinch = browser(); pinch.start(); pinch.start(pinch.background, 220, 180, 2);
  pinch.move(100); pinch.end(100); assert.equal(pinch.calls.length, 0);
  const laterDialog = browser(); laterDialog.start(); laterDialog.move(100);
  laterDialog.document.dialog = {}; laterDialog.end(100); assert.equal(laterDialog.calls.length, 0);
});

test('browser edge gestures, native gesture takeover, scrolling and cancellation do not navigate', () => {
  for (const x of [0, 12, 20, 392, 411]) {
    const b = browser(); b.start(b.background, x); b.move(x < 100 ? 180 : 230); b.end(x < 100 ? 180 : 230);
    assert.equal(b.calls.length, 0, 'native edge at ' + x);
  }
  for (const cancel of [
    b => b.window.emit('touchcancel'), b => b.window.emit('orientationchange'),
    b => b.window.emit('pagehide'), b => b.document.emit('visibilitychange'),
    b => { b.window.scrollY = 30; }, b => b.advance(1300),
    b => b.move(100, 180, { cancelable: false }),
  ]) {
    const b = browser(); b.start(); b.move(100); cancel(b); b.end(100); assert.equal(b.calls.length, 0);
  }
});

test('one completed gesture causes one navigation; restoring from history allows another', () => {
  const b = browser(); b.start(); b.move(100); b.end(100); b.end(100);
  b.start(); b.move(100); b.end(100); assert.equal(b.calls.length, 1);
  b.window.emit('pageshow'); b.start(); b.move(100); b.end(100); assert.equal(b.calls.length, 2);
});

test('desktop mouse-only devices do not install touch handlers', () => {
  const b = browser({ touchPoints: 0 });
  assert.equal(b.window.listeners.size, 0);
  b.start(); b.move(100); b.end(100); assert.equal(b.calls.length, 0);
});

test('navigation stays on the same origin and portfolio', () => {
  for (const href of ['https://other.test/galleries/hb-helipad/', 'https://example.test/galleries/hb-helipad/']) {
    const b = browser({ prefix: '/artur' }); b.next.href = href;
    b.start(); b.move(100); b.end(100); assert.equal(b.calls.length, 0);
  }
});

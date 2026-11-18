const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../galleries/gallery-navigation.js'), 'utf8');

function browser({ prefix = '', touchPoints = 5, width = 412, folder = 'hb-egypt' } = {}) {
  class Target {
    constructor(tagName = 'DIV', excluded = false) {
      this.tagName = tagName; this.excluded = excluded; this.listeners = new Map();
      this.children = []; this.dataset = {}; this.classes = new Set(); this.hidden = false;
      this.classList = {
        add: (...names) => names.forEach(name => this.classes.add(name)),
        remove: (...names) => names.forEach(name => this.classes.delete(name)),
        toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name),
      };
    }
    addEventListener(type, callback, options) { this.listeners.set(type, { callback, options }); }
    closest(selector) {
      return this.excluded || selector.split(',').some(item => item.trim() === this.tagName.toLowerCase()) ? this : null;
    }
    append(child) { this.children.push(child); }
    setAttribute() {}
    emit(type, event = {}) {
      const value = { type, target: this, cancelable: true, prevented: false,
        preventDefault() { this.prevented = true; }, ...event };
      this.listeners.get(type)?.callback(value);
      return value;
    }
  }
  let now = 0;
  let nextTimer = 0;
  const timers = new Map();
  const calls = [];
  const previous = { href: 'https://example.test' + prefix + '/galleries/hb-rzstart/' };
  const next = { href: 'https://example.test' + prefix + '/galleries/hb-helipad/' };
  const navigation = { querySelector: selector => selector.endsWith('next') ? next : previous };
  const background = new Target('MAIN');
  const document = new Target();
  Object.assign(document, {
    hidden: false, fullscreenElement: null, activeElement: new Target('BODY'), body: new Target('BODY'),
    documentElement: { clientWidth: width }, dialog: null,
    querySelector(selector) { return selector === '.gallery-navigation' ? navigation : this.dialog; },
    createElement: tag => new Target(tag.toUpperCase()),
  });
  const window = new Target();
  Object.assign(window, {
    scrollY: 0, visualViewport: { scale: 1 },
    getSelection: () => ({ isCollapsed: true }),
    location: { href: 'https://example.test' + prefix + '/galleries/' + folder + '/',
      pathname: prefix + '/galleries/' + folder + '/', origin: 'https://example.test', assign: value => calls.push(value) },
  });
  vm.runInNewContext(source, {
    window, document, navigator: { maxTouchPoints: touchPoints }, URL, Date: { now: () => now },
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  function advance(milliseconds) {
    const until = now + milliseconds;
    for (;;) {
      const next = [...timers.entries()].filter(([, item]) => item.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at; timers.delete(next[0]); next[1].callback();
    }
    now = until;
  }
  const point = (x, y = 180, id = 1) => ({ identifier: id, clientX: x, clientY: y });
  const start = (target = background, x = 220, y = 180, count = 1) => window.emit('touchstart', {
    target, touches: Array.from({ length: count }, (_, i) => point(x, y, i + 1)) });
  const move = (x, y = 180, options = {}) => window.emit('touchmove', { touches: [point(x, y)], ...options });
  const end = (x, y = 180, options = {}) => window.emit('touchend', { touches: [], changedTouches: [point(x, y)], ...options });
  return { window, document, calls, background, previous, next, Target, point, start, move, end, advance,
    get feedback() { return document.body.children.find(item => item.className === 'gallery-swipe-feedback'); } };
}

test('short swipes work in both directions from the middle on both portfolios', () => {
  for (const prefix of ['', '/artur']) {
    for (const [endX, direction, folder] of [[160, 'next', 'hb-helipad'], [280, 'previous', 'hb-rzstart']]) {
      const b = browser({ prefix }); b.start();
      assert.equal(b.move(endX).prevented, true); b.end(endX);
      assert.equal(b.feedback.hidden, false);
      assert.equal(b.feedback.dataset.direction, direction);
      assert.equal(b.calls.length, 0, 'the arrow must appear before navigation');
      b.advance(180);
      assert.deepEqual(b.calls, ['https://example.test' + prefix + '/galleries/' + folder + '/']);
    }
  }
});

test('the same modest swipe distance works in landscape and narrow background gutters', () => {
  for (const width of [360, 412, 915]) {
    for (const startX of [24, width / 2, width - 24]) {
      const b = browser({ width }); const endX = startX > width / 2 ? startX - 60 : startX + 60;
      b.start(b.background, startX); b.move(endX); b.end(endX); b.advance(180);
      assert.equal(b.calls.length, 1, width + 'px at ' + startX);
    }
  }
});

test('heading and description containers do not turn their empty background into a dead area', () => {
  for (const tag of ['P', 'H1', 'SPAN', 'HEADER', 'DIV', 'BODY']) {
    const b = browser(); b.start(new b.Target(tag)); b.move(160); b.end(160); b.advance(180);
    assert.equal(b.calls.length, 1, tag);
  }
});

test('feedback appears during dragging and is guaranteed before every completed navigation', () => {
  const b = browser(); b.start(); b.move(205);
  assert.equal(b.feedback.hidden, false);
  assert.equal(b.feedback.classes.has('is-ready'), false);
  b.move(160); assert.equal(b.feedback.classes.has('is-ready'), true);
  b.end(160); b.advance(179);
  assert.equal(b.calls.length, 0); assert.equal(b.feedback.hidden, false);
  b.advance(1); assert.equal(b.calls.length, 1);
});

test('fast flicks with no intermediate move also show feedback and navigate once', () => {
  for (const x of [160, 280]) {
    const b = browser(); b.start(); b.end(x); b.end(x);
    assert.equal(b.feedback.hidden, false); assert.equal(b.calls.length, 0);
    b.advance(180); assert.equal(b.calls.length, 1);
  }
});

test('non-cancelable Chrome events and small scroll drift do not discard horizontal intent', () => {
  for (const drift of [0, 12, 40]) {
    const b = browser(); b.start(); b.move(200);
    b.window.scrollY = drift;
    assert.equal(b.move(160, 185, { cancelable: false }).prevented, false);
    b.end(160, 190); b.advance(180); assert.equal(b.calls.length, 1);
  }
});

test('photos, comparison controls, form fields and interactive descendants are untouched', () => {
  for (const [tag, excluded] of [['IMG', false], ['PICTURE', false], ['A', false], ['BUTTON', false],
    ['INPUT', false], ['VIDEO', false], ['SVG', false], ['DIV', true], ['SPAN', true], ['SECTION', true]]) {
    const b = browser(); b.start(new b.Target(tag, excluded));
    assert.equal(b.move(100).prevented, false, tag);
    b.end(100); b.advance(300); assert.equal(b.calls.length, 0, tag); assert.equal(b.feedback.hidden, true);
  }
});

test('vertical, diagonal, short and stationary movements do not switch galleries', () => {
  for (const [x, y] of [[220, 300], [240, 300], [170, 240], [195, 180], [220, 180]]) {
    const b = browser(); b.start(); b.move(x, y); b.end(x, y); b.advance(300);
    assert.equal(b.calls.length, 0); assert.equal(b.feedback.hidden, true);
  }
  const b = browser(); b.start(); assert.equal(b.move(224, 210).prevented, false);
  b.move(100, 210); b.end(100, 210); b.advance(300);
  assert.equal(b.calls.length, 0, 'vertical scrolling cannot turn into navigation');
});

test('pinch, zoom, dialogs, fullscreen, editing and selected text suppress swipes', () => {
  for (const block of [
    b => { b.window.visualViewport.scale = 1.3; },
    b => { b.document.dialog = {}; }, b => { b.document.fullscreenElement = {}; },
    b => { b.document.activeElement = new b.Target('INPUT'); },
    b => { b.window.getSelection = () => ({ isCollapsed: false }); }, b => { b.document.hidden = true; },
  ]) {
    const b = browser(); block(b); b.start();
    assert.equal(b.move(100).prevented, false); b.end(100); b.advance(300);
    assert.equal(b.calls.length, 0); assert.equal(b.feedback.hidden, true);
  }
  const b = browser(); b.start(); b.move(200); b.start(b.background, 220, 180, 2);
  b.move(100); b.end(100); b.advance(300); assert.equal(b.calls.length, 0); assert.equal(b.feedback.hidden, true);
});

test('native cancellation and lifecycle changes clear the arrow and any pending navigation', () => {
  for (const cancel of [
    b => b.window.emit('touchcancel'), b => b.window.emit('orientationchange'),
    b => b.window.emit('pagehide'), b => b.document.emit('visibilitychange'),
  ]) {
    const b = browser(); b.start(); b.move(160); b.end(160); cancel(b); b.advance(300);
    assert.equal(b.calls.length, 0); assert.equal(b.feedback.hidden, true);
  }
  const slow = browser(); slow.start(); slow.move(160); slow.advance(1700); slow.end(160); slow.advance(300);
  assert.equal(slow.calls.length, 0); assert.equal(slow.feedback.hidden, true);
});

test('a dialog or zoom opened during arrow feedback prevents the delayed navigation', () => {
  for (const block of [b => { b.document.dialog = {}; }, b => { b.window.visualViewport.scale = 1.5; }]) {
    const b = browser(); b.start(); b.move(160); b.end(160); block(b); b.advance(180);
    assert.equal(b.calls.length, 0); assert.equal(b.feedback.hidden, true);
  }
});

test('one swipe navigates once and browser history restoration rearms the gesture', () => {
  const b = browser(); b.start(); b.move(160); b.end(160); b.end(160);
  b.start(); b.move(160); b.end(160); b.advance(300); assert.equal(b.calls.length, 1);
  b.window.emit('pageshow'); assert.equal(b.feedback.hidden, true);
  b.start(); b.move(160); b.end(160); b.advance(180); assert.equal(b.calls.length, 2);
});

test('protected-gallery links and both portfolio prefixes use the existing routes', () => {
  const b = browser({ prefix: '/artur', folder: 'hb-rzstart' });
  b.next.href = 'https://example.test/artur/galleries/hb-egypt/';
  b.start(); b.move(160); b.end(160); b.advance(180);
  assert.deepEqual(b.calls, ['https://example.test/artur/galleries/hb-egypt/']);
});

test('navigation cannot leave the current origin or portfolio', () => {
  for (const href of ['https://other.test/galleries/hb-helipad/', 'https://example.test/galleries/hb-helipad/']) {
    const b = browser({ prefix: '/artur' }); b.next.href = href;
    b.start(); b.move(160); b.end(160); b.advance(300); assert.equal(b.calls.length, 0);
  }
});

test('mouse-only desktop devices do not install handlers or add feedback elements', () => {
  const b = browser({ touchPoints: 0 });
  assert.equal(b.window.listeners.size, 0); assert.equal(b.feedback, undefined);
  b.start(); b.move(100); b.end(100); b.advance(300); assert.equal(b.calls.length, 0);
});


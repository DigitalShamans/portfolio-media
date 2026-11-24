const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../galleries/gallery-mobile-scroll.js'), 'utf8');

function browser({ dependencies = true, supportsUnits = true, initializationFails = false } = {}) {
  const timers = new Map();
  const mutations = [];
  const scripts = [];
  const created = [];
  const operations = [];
  const unrelatedObserver = { kill() { throw new Error('Unrelated observer must be preserved'); } };
  const registered = new Set([unrelatedObserver]);
  let time = 0;
  let nextTimer = 0;
  let current;
  let large = 400;
  let small = 340;

  class Target {
    constructor() { this.listeners = new Map(); }
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(listener);
    }
    removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
    emit(type, event = {}) {
      for (const listener of [...(this.listeners.get(type) || [])]) {
        listener({ type, target: this, ...event });
      }
    }
  }

  class Element extends Target {
    constructor(tagName = 'DIV') {
      super();
      this.tagName = tagName;
      const properties = new Map();
      this.style = {
        getPropertyValue: key => properties.get(key)?.value || '',
        getPropertyPriority: key => properties.get(key)?.priority || '',
        setProperty: (key, value, priority = '') => properties.set(key, { value, priority }),
        removeProperty: key => properties.delete(key),
      };
      this.children = [];
    }
    append(child) { this.children.push(child); child.parent = this; }
    contains(child) { return child === this || this.children.some(item => item.contains(child)); }
    closest(selector) {
      return selector.split(',').some(part => part.trim() === this.tagName.toLowerCase()) ? this : null;
    }
    setAttribute() {}
    remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
    getBoundingClientRect() { return { height: this.style.height === '100lvh' ? large : small }; }
  }

  const coarse = Object.assign(new Target(), { matches: true });
  const portrait = Object.assign(new Target(), { matches: false });
  const viewport = Object.assign(new Target(), { height: small, scale: 1 });
  const window = Object.assign(new Target(), {
    visualViewport: viewport,
    scrollY: 0,
    CSS: { supports: () => supportsUnits },
    matchMedia: query => query.includes('orientation') ? portrait : coarse,
  });
  const document = Object.assign(new Target(), {
    currentScript: { src: 'https://example.test/portfolio/galleries/gallery-mobile-scroll.js?v=1' },
    documentElement: Object.assign(new Element('HTML'), { clientWidth: 900 }),
    hidden: false,
    fullscreenElement: null,
    body: new Element('BODY'),
    head: { append(script) { scripts.push(script); } },
    createElement: tag => new Element(tag.toUpperCase()),
  });
  document.activeElement = document.body;
  const gallery = new Element();
  const shot = new Element('A');
  const viewer = Object.assign(new Element('DIALOG'), { open: false });
  gallery.append(shot);

  const gsap = {
    registerPlugin() {},
    killTweensOf(owner) { operations.push(['stop momentum', owner]); owner.momentumActive = false; },
    core: { globals: () => ({ Observer: { getAll: () => [...registered] } }) },
  };
  const ScrollTrigger = {
    normalizeScroll(options) {
      if (options === undefined) return current;
      if (options === false) { current?.kill(); current = undefined; return; }
      const owner = {
        options,
        momentumActive: true,
        isEnabled: true,
        kill() {
          operations.push(['kill', owner]); owner.isEnabled = false; registered.delete(owner);
          document.documentElement.style.removeProperty('touch-action');
          document.body.style.removeProperty('touch-action');
        },
      };
      created.push(owner);
      registered.add(owner);
      document.documentElement.style.setProperty('touch-action', 'pan-x pinch-zoom');
      document.body.style.setProperty('touch-action', 'pan-x pinch-zoom');
      document.documentElement.style.setProperty('scroll-behavior', 'auto');
      if (initializationFails) {
        const inputObserver = { kill() { registered.delete(inputObserver); } };
        registered.add(inputObserver);
        throw new Error('Initialization failed after registering observers');
      }
      current = owner;
      return owner;
    },
  };
  if (dependencies) Object.assign(window, { gsap, ScrollTrigger });

  vm.runInNewContext(source, {
    window, document, navigator: { maxTouchPoints: 5 }, URL,
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, at: time + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    queueMicrotask,
    MutationObserver: class {
      constructor(callback) { this.callback = callback; }
      observe() { mutations.push(this); }
      disconnect() { mutations.splice(mutations.indexOf(this), 1); }
    },
  });

  const controller = window.GalleryMobileScroll.start({ gallery, viewer });

  async function advance(milliseconds) {
    const until = time + milliseconds;
    for (;;) {
      // Flush promises from optional dependency loading before advancing time.
      for (let i = 0; i < 5; i++) await Promise.resolve();
      const next = [...timers.entries()].filter(([, item]) => item.at <= until)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      timers.delete(next[0]);
      time = next[1].at;
      next[1].callback();
    }
    time = until;
  }

  function touchStart(count = 1) {
    window.emit('touchstart', { target: shot, touches: Array.from({ length: count }, () => ({ clientX: 20, clientY: 200 })) });
  }

  function touchEnd() {
    window.emit('touchend', { target: shot, touches: [], changedTouches: [{ clientX: 20, clientY: 100 }] });
  }

  function setHeight(height) { viewport.height = height; viewport.emit('resize'); }

  function nativeScroll({ hidden = true } = {}) {
    touchStart();
    window.scrollY += 100;
    if (hidden) setHeight(large);
    window.emit('scroll');
    touchEnd();
  }

  return {
    window, document, viewport, controller, viewer, created, operations, scripts, gsap, ScrollTrigger,
    registered, unrelatedObserver,
    advance, touchStart, touchEnd, setHeight, nativeScroll,
    get active() { return current; },
    openViewer(open) { viewer.open = open; mutations.forEach(observer => observer.callback()); },
    rotate() {
      large = 915; small = 855; viewport.height = small;
      document.documentElement.clientWidth = 412;
      portrait.matches = true;
      portrait.emit('change');
      viewport.emit('resize');
    },
    focusControl(tagName = 'INPUT') { document.activeElement = new Element(tagName); document.emit('focusin'); },
    installDependency() {
      const script = scripts.at(-1);
      if (script.src.endsWith('/gsap.min.js')) window.gsap = gsap;
      else window.ScrollTrigger = ScrollTrigger;
      script.onload();
    },
  };
}

test('an initially visible toolbar is never locked, even after a native scroll', async () => {
  const b = browser({ dependencies: false });
  await b.advance(2000);
  b.nativeScroll({ hidden: false });
  await b.advance(2000);
  assert.equal(b.active, undefined);
  assert.equal(b.scripts.length, 0);
});

test('activation waits for the first native gesture and its scrolling to finish', async () => {
  const b = browser();
  b.setHeight(400);
  await b.advance(1000);
  assert.equal(b.active, undefined, 'already hidden alone is insufficient');
  b.touchStart();
  b.window.scrollY = 100;
  b.window.emit('scroll');
  await b.advance(1000);
  assert.equal(b.active, undefined, 'never intercept an ongoing native touch');
  b.touchEnd();
  for (let i = 0; i < 5; i++) {
    await b.advance(100);
    b.window.scrollY += 10;
    b.window.emit('scroll');
  }
  assert.equal(b.active, undefined, 'native momentum must finish first');
  await b.advance(500);
  assert.equal(b.created.length, 1);
  assert.equal(b.active.options.normalizeScrollX, false);
  assert.equal(b.active.options.lockAxis, true);
  assert.equal(b.active.options.dragMinimum, 12);
  assert.equal(b.active.options.allowNestedScroll, false, 'horizontal comparison events must reach their handlers');
});

test('zoom, multitouch, dialog, fullscreen and form focus all release scrolling and momentum', async t => {
  for (const [name, block] of [
    ['zoom', b => { b.viewport.scale = 1.2; b.viewport.emit('resize'); }],
    ['multitouch', b => b.touchStart(2)],
    ['dialog', b => b.openViewer(true)],
    ['fullscreen', b => { b.document.fullscreenElement = b.viewer; b.document.emit('fullscreenchange'); }],
    ['form focus', b => b.focusControl()],
  ]) {
    await t.test(name, async () => {
      const b = browser();
      b.nativeScroll();
      await b.advance(500);
      const owner = b.active;
      assert.ok(owner);
      block(b);
      assert.equal(b.active, undefined);
      assert.equal(owner.momentumActive, false);
      assert.equal(owner.isEnabled, false);
      assert.equal(b.operations[0][0], 'stop momentum');
      assert.equal(b.operations[1][0], 'kill');
      await b.advance(1000);
      assert.equal(b.created.length, 1);
    });
  }
});

test('closing the viewer requires another safe native gesture before rearming', async () => {
  const b = browser();
  b.nativeScroll();
  await b.advance(500);
  b.openViewer(true);
  b.openViewer(false);
  await b.advance(1000);
  assert.equal(b.active, undefined);
  b.nativeScroll();
  await b.advance(500);
  assert.equal(b.created.length, 2);
});

test('comparison button tap focus keeps scrolling enabled and ordinary controls are not ignored', async () => {
  const b = browser();
  b.nativeScroll();
  await b.advance(500);
  const owner = b.active;
  b.focusControl('BUTTON');
  await b.advance(500);
  assert.equal(b.active, owner, 'a focused comparison button must not disable normalization');
  const ignored = owner.options.ignore.split(',').map(part => part.trim());
  for (const selector of ['button', 'label', 'a', 'a:not(.shot)']) {
    assert.equal(ignored.includes(selector), false, 'vertical drags across ' + selector + ' must be normalized');
  }
  for (const selector of ['input', 'textarea', 'select']) assert.ok(ignored.includes(selector));
  assert.equal(owner.options.dragMinimum, 12, 'taps retain the existing drag threshold');
});

test('rotation measures the new viewport and requires a new collapsed native gesture', async () => {
  const b = browser();
  b.nativeScroll();
  await b.advance(500);
  b.rotate();
  await b.advance(1000);
  assert.equal(b.active, undefined);
  b.setHeight(915);
  await b.advance(1000);
  assert.equal(b.active, undefined, 'old orientation must not remain armed');
  b.nativeScroll();
  await b.advance(500);
  assert.equal(b.created.length, 2);
});

test('a toolbar that returns despite normalization falls back permanently to native scrolling', async () => {
  const b = browser();
  b.nativeScroll();
  await b.advance(500);
  b.setHeight(340);
  assert.equal(b.active, undefined);
  b.nativeScroll();
  await b.advance(1000);
  assert.equal(b.created.length, 1);
});

test('local dependencies preserve a site subpath and load in order', async () => {
  const b = browser({ dependencies: false });
  b.nativeScroll();
  await b.advance(500);
  assert.equal(b.scripts[0].src, 'https://example.test/portfolio/assets/vendor/gsap/3.15.1/gsap.min.js');
  b.installDependency();
  await b.advance(0);
  assert.equal(b.scripts[1].src, 'https://example.test/portfolio/assets/vendor/gsap/3.15.1/ScrollTrigger.min.js');
  b.installDependency();
  await b.advance(500);
  assert.equal(b.created.length, 1);
});

test('script failure and unsupported viewport units leave native scrolling available', async () => {
  const b = browser({ dependencies: false });
  b.nativeScroll();
  await b.advance(500);
  b.scripts[0].onerror(new Error('offline'));
  await b.advance(500);
  b.nativeScroll();
  await b.advance(500);
  assert.equal(b.active, undefined);
  assert.equal(b.scripts.length, 1);
  const unsupported = browser({ supportsUnits: false });
  unsupported.nativeScroll();
  await unsupported.advance(500);
  assert.equal(unsupported.active, undefined);
  assert.equal(unsupported.document.body.children.length, 0);
});

test('a partial normalization failure removes only newly registered observers and restores native styles', async () => {
  const b = browser({ initializationFails: true });
  b.document.documentElement.style.setProperty('touch-action', 'pan-y', 'important');
  b.document.body.style.setProperty('touch-action', 'manipulation');
  b.document.documentElement.style.setProperty('scroll-behavior', 'smooth');
  b.nativeScroll();
  await b.advance(500);
  assert.equal(b.active, undefined);
  assert.equal(b.registered.size, 1);
  assert.ok(b.registered.has(b.unrelatedObserver));
  assert.equal(b.created[0].isEnabled, false);
  assert.equal(b.created[0].momentumActive, false);
  assert.equal(b.document.documentElement.style.getPropertyValue('touch-action'), 'pan-y');
  assert.equal(b.document.documentElement.style.getPropertyPriority('touch-action'), 'important');
  assert.equal(b.document.body.style.getPropertyValue('touch-action'), 'manipulation');
  assert.equal(b.document.documentElement.style.getPropertyValue('scroll-behavior'), 'smooth');
  b.nativeScroll();
  await b.advance(500);
  assert.equal(b.created.length, 1, 'failed initialization must not be retried');
});

test('destroy during dependency loading prevents late activation and removes probes', async () => {
  const b = browser({ dependencies: false });
  b.nativeScroll();
  await b.advance(500);
  b.controller.destroy();
  b.installDependency();
  await b.advance(0);
  b.installDependency();
  await b.advance(1000);
  assert.equal(b.active, undefined);
  assert.equal(b.document.body.children.length, 0);
});

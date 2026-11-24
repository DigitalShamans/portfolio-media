'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { gsap: gsapEases } = require('../../assets/vendor/gsap/3.15.1/gsap.min.js');

const root = path.resolve(__dirname, '../..');
const viewerSource = fs.readFileSync(path.join(root, 'galleries/gallery-viewer.js'), 'utf8');
const start = viewerSource.indexOf('function setupClassicGalleryScroll()');
const end = viewerSource.indexOf('\nsetupClassicGalleryScroll();', start);
assert.ok(start >= 0 && end > start, 'the shared page-wheel controller must be present');
const controller = viewerSource.slice(start, end) + '\nsetupClassicGalleryScroll();';

// This fixture separates native scroll from rendered scroll. A smooth-scrolling
// page can have different values; DOM rectangles follow the rendered position.
function wheelPage({ map = false, smootherReady = false, ownsGallery = true,
    position = 300, nativePosition = position, reduced = false,
    nativeOnly = false, scrollEase, height = 1000, scrollHeight = 3700 } = {}) {
  let now = 0, native = nativePosition, rendered = position, ready = smootherReady;
  let frameId = 0, timerId = 0, getCalls = 0, paused = false;
  const frames = new Map(), timers = new Map(), tweens = [];
  const nativeWrites = [], smootherWrites = [], freezes = [], reports = [];
  const clamp = value => Math.max(0, Math.min(scrollHeight - height, value));

  function eventTarget(extra = {}) {
    const listeners = new Map();
    return Object.assign({
      addEventListener(type, listener) {
        const entries = listeners.get(type) || [];
        entries.push(listener); listeners.set(type, entries);
      },
      removeEventListener(type, listener) {
        listeners.set(type, (listeners.get(type) || []).filter(entry => entry !== listener));
      },
      emit(type, values = {}) {
        const event = Object.assign({ type, timeStamp: now, cancelable: true, defaultPrevented: false,
          preventDefault() { if (this.cancelable) this.defaultPrevented = true; } }, values);
        for (const listener of [...(listeners.get(type) || [])]) listener.call(this, event);
        return event;
      },
      dispatchEvent(event) { this.emit(event.type, event); return !event.defaultPrevented; },
      listenerCount(type) { return (listeners.get(type) || []).length; },
    }, extra);
  }

  const scroller = { clientWidth: 1440, clientHeight: height, scrollHeight };
  Object.defineProperty(scroller, 'scrollTop', {
    get: () => native,
    set: value => { native = clamp(value); },
  });
  const viewer = eventTarget({ open: false });
  const desktopScrolling = eventTarget({ matches: true });
  const reducedMotion = eventTarget({ matches: reduced });
  const attributes = new Set(['data-grouped-image-scroll']);
  if (map) attributes.add('data-gsap-gallery-scroll');
  if (nativeOnly) attributes.add('data-native-gallery-scroll');
  const visiblePosition = () => ready && ownsGallery && map ? rendered : native;
  const entries = [500, 1300, 2100, 2900].map((top, index) => ({
    id: 'shot-' + index,
    getBoundingClientRect: () => ({ top: top - visiblePosition(), bottom: top + 600 - visiblePosition(), height: 600 }),
  }));
  const gallery = {
    children: entries, dataset: { galleryScrollEase: scrollEase }, hasAttribute: name => attributes.has(name),
  };
  const content = { contains: element => ownsGallery && element === gallery };
  const smoother = {
    content: () => content,
    paused(value) { if (arguments.length) paused = value; return paused; },
    scrollTop(value) {
      if (!arguments.length) return rendered;
      native = rendered = clamp(value);
      smootherWrites.push(rendered);
      return this;
    },
    scrollTo(value, smooth) {
      assert.equal(smooth, false, 'step cancellation must freeze, not start another smoothing path');
      freezes.push(value);
      native = rendered = clamp(value);
      return this;
    },
  };

  // Model the public GSAP function-property tween contract, including kill and
  // onComplete. Interpolation belongs to the mock; destinations come from the
  // production controller, rather than being reconstructed in the tests.
  const gsap = { to(target, vars) {
    if (vars.overwrite === 'auto') {
      for (const prior of tweens) if (prior.active && prior.target === target) prior.kill();
    }
    const tween = {
      target, vars, from: target.scrollTop(), started: now, active: true, killed: false,
      kill() {
        const interrupted = this.active;
        this.active = false; this.killed = true;
        if (interrupted) this.vars.onInterrupt?.call(this);
      },
      progress() { return Math.min(1, (now - this.started) / (this.vars.duration * 1000)); },
    };
    tweens.push(tween);
    return tween;
  } };
  const document = eventTarget({ scrollingElement: scroller, documentElement: scroller,
    hidden: false, fullscreenElement: null, onscrollend: null, querySelector: () => null });
  const window = eventTarget({
    gsap, ScrollSmoother: { get() { getCalls++; return ready ? smoother : undefined; } },
    scrollTo(options) { native = clamp(options.top); nativeWrites.push({ ...options, relative: false }); },
    scrollBy(options) { native = clamp(native + options.top); nativeWrites.push({ ...options, relative: true }); },
  });
  Object.defineProperty(window, 'scrollY', { get: () => native });

  vm.runInNewContext(controller, {
    gallery, viewer, document, window, desktopScrolling, reducedMotion,
    imageResolution: '1440p',
    galleryDiagnostics: {
      state: (...args) => reports.push(args), count() {}, sample() {},
    },
    performance: { now: () => now },
    requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(callback, delay) { timers.set(++timerId, { callback, at: now + delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  }, { filename: 'shared-gallery-page-scroll.js' });

  function advance(milliseconds) {
    const finish = now + milliseconds;
    while (now < finish) {
      now = Math.min(finish, now + 16);
      for (const tween of [...tweens]) {
        if (!tween.active) continue;
        const progress = tween.progress();
        const eased = 1 - (1 - progress) ** 3;
        tween.target.scrollTop(tween.from + (tween.vars.scrollTop - tween.from) * eased);
        tween.vars.onUpdate?.call(tween);
        if (progress === 1 && tween.active) {
          tween.active = false;
          tween.vars.onComplete?.call(tween);
        }
      }
      const pending = [...frames.values()]; frames.clear();
      for (const callback of pending) callback(now);
      for (const [id, timer] of [...timers]) {
        if (timer.at <= now) { timers.delete(id); timer.callback(); }
      }
    }
  }

  return {
    document, window, viewer, reducedMotion, desktopScrolling, smoother,
    nativeWrites, smootherWrites, freezes, tweens, reports, advance,
    get native() { return native; }, get rendered() { return visiblePosition(); },
    get getCalls() { return getCalls; }, get pendingFrames() { return frames.size; },
    wheel(values = {}) { return document.emit('wheel', { deltaY: 120, deltaX: 0, deltaMode: 0, ...values }); },
    controllerChange() { document.emit('gallery-scrollcontrollerchange'); },
    setReady(value) { const before = visiblePosition(); ready = value; native = rendered = before; },
    externalPosition(value) { native = rendered = clamp(value); },
  };
}

test('listed galleries retain their single native step controller and ignore unrelated GSAP', () => {
  const page = wheelPage({ smootherReady: true, ownsGallery: false });
  assert.equal(page.document.listenerCount('wheel'), 1);
  assert.equal(page.wheel().defaultPrevented, true);
  page.advance(100);
  assert.ok(page.native > 300 && page.native < 1100);
  page.advance(600);
  assert.equal(page.native, 1100);
  assert.ok(page.nativeWrites.length > 1);
  assert.equal(page.tweens.length, 0);
  assert.equal(page.getCalls, 0, 'classic pages do not consult or adopt a smoother');
});

test('configured expo.out wheel steps match GSAP in both directions over double the usual duration', () => {
  const expoOut = gsapEases.parseEase('expo.out');
  const duration = 2 * Math.sqrt(800) * 1000 / 60;
  for (const [start, destination, deltaY] of [[300, 1100, 120], [1100, 300, -120]]) {
    const page = wheelPage({ position: start, scrollEase: 'expo.out' });
    assert.equal(page.wheel({ deltaY }).defaultPrevented, true);
    let elapsed = 0;
    for (const sample of [16, 200, 470, 840]) {
      page.advance(sample - elapsed);
      elapsed = sample;
      const expected = start + (destination - start) * expoOut(elapsed / duration);
      assert.ok(Math.abs(page.native - expected) < 1e-8, 'rendered position follows expo.out at ' + sample + 'ms');
    }
    page.advance(200);
    assert.equal(page.native, destination);
    assert.equal(page.pendingFrames, 0);
    assert.equal(page.getCalls, 0);
    assert.ok(page.reports.some(([, , reason]) => reason.includes('expo.out')));
  }
});

test('a grouped GSAP stroke advances once and absorbs its remaining wheel ticks', () => {
  const page = wheelPage({ map: true, smootherReady: true });
  assert.equal(page.document.listenerCount('wheel'), 1);
  assert.equal(page.wheel().defaultPrevented, true);
  page.advance(50);
  assert.equal(page.wheel().defaultPrevented, true);
  page.advance(50);
  assert.equal(page.wheel({ deltaY: 8 }).defaultPrevented, true);
  assert.equal(page.tweens.length, 1);
  assert.equal(page.tweens[0].target, page.smoother);
  assert.equal(page.tweens[0].vars.scrollTop, 1100);
  page.advance(800);
  assert.equal(page.rendered, 1100);
  assert.equal(page.native, 1100);
  assert.equal(page.nativeWrites.length, 0, 'no competing native RAF writes');
});

test('GSAP targets use rendered geometry while the native target is ahead', () => {
  const page = wheelPage({ map: true, smootherReady: true, position: 300, nativePosition: 900 });
  page.wheel();
  assert.equal(page.tweens.length, 1);
  assert.equal(page.tweens[0].vars.scrollTop, 1100, 'native/rendered lag must not be added to the destination');
  page.advance(800);
  assert.equal(page.rendered, 1100);
  assert.equal(page.native, 1100);
});

test('a new stroke extends the active GSAP step without jumping at the new input', () => {
  const page = wheelPage({ map: true, smootherReady: true });
  page.wheel(); page.advance(200);
  const before = page.rendered;
  page.wheel();
  assert.equal(page.rendered, before);
  assert.equal(page.tweens.at(-1).vars.scrollTop, 1900);
  page.advance(1000);
  assert.equal(page.rendered, 1900);
  assert.equal(page.native, 1900);
});

test('reversing a GSAP step cancels the old writer and targets the preceding image', () => {
  const page = wheelPage({ map: true, smootherReady: true });
  page.wheel(); page.advance(160);
  const original = page.tweens[0];
  assert.equal(page.wheel({ deltaY: -120 }).defaultPrevented, true);
  assert.equal(original.killed, true);
  assert.equal(page.tweens.at(-1).vars.scrollTop, 300);
  page.advance(1000);
  assert.equal(page.rendered, 300);
});

test('an independent small wheel gesture yields to native input and cancels the step', () => {
  const page = wheelPage({ map: true, smootherReady: true });
  page.wheel(); page.advance(180);
  const before = page.rendered;
  assert.equal(page.wheel({ deltaY: 12 }).defaultPrevented, false);
  assert.equal(page.tweens[0].killed, true);
  page.externalPosition(before + 12);
  page.advance(1000);
  assert.equal(page.rendered, before + 12, 'the cancelled step must not overwrite native input');
});

test('input, environment changes and controller handoff cancel GSAP writers', () => {
  const interruptions = {
    pointer: page => page.document.emit('pointerdown'),
    keyboard: page => page.document.emit('keydown', { key: 'PageDown' }),
    resize: page => page.window.emit('resize'),
    hidden: page => { page.document.hidden = true; page.document.emit('visibilitychange'); },
    reducedMotion: page => { page.reducedMotion.matches = true; page.reducedMotion.emit('change'); },
    desktopPointer: page => { page.desktopScrolling.matches = false; page.desktopScrolling.emit('change'); },
    pagehide: page => page.window.emit('pagehide'),
    handoff: page => page.controllerChange(),
  };
  for (const [name, interrupt] of Object.entries(interruptions)) {
    const page = wheelPage({ map: true, smootherReady: true });
    page.wheel(); page.advance(160);
    const before = page.rendered;
    interrupt(page);
    assert.equal(page.tweens[0].killed, true, name);
    page.advance(1000);
    assert.equal(page.rendered, before, name + ' leaves the page at its visible position');
    assert.equal(page.native, before, name + ' synchronizes native and rendered positions');
  }
});

test('an external GSAP overwrite clears the old step before the next wheel gesture', () => {
  const page = wheelPage({ map: true, smootherReady: true });
  page.wheel(); page.advance(160);
  const original = page.tweens[0];
  page.window.gsap.to(page.smoother, { scrollTop: 600, duration: .1, overwrite: 'auto' });
  assert.equal(original.killed, true);
  page.advance(300);
  assert.equal(page.rendered, 600);
  page.wheel();
  assert.equal(page.tweens.at(-1).vars.scrollTop, 1100, 'the new gesture must not extend the overwritten step');
  page.advance(800);
  assert.equal(page.rendered, 1100);
});

test('fullscreen handoff stops the external tween before viewer input takes over', () => {
  const page = wheelPage({ map: true, smootherReady: true });
  page.wheel(); page.advance(160);
  const before = page.rendered;
  page.controllerChange();
  page.smoother.paused(true); page.viewer.open = true;
  assert.equal(page.wheel().defaultPrevented, false);
  page.advance(1000);
  assert.equal(page.rendered, before);
  assert.equal(page.tweens[0].killed, true);
});

test('a late GSAP handoff cancels the native fallback before adopting transformed scrolling', () => {
  const page = wheelPage({ map: true });
  page.wheel(); page.advance(160);
  assert.ok(page.native > 300 && page.native < 1100);
  const before = page.native;
  page.controllerChange();
  page.setReady(true);
  page.externalPosition(before);
  page.advance(1000);
  assert.equal(page.native, before);
  assert.equal(page.pendingFrames, 0);
  page.wheel();
  assert.equal(page.tweens.length, 1);
  assert.equal(page.tweens[0].vars.scrollTop, 1100);
  page.advance(800);
  assert.equal(page.rendered, 1100);
});

test('missing GSAP and reduced motion keep shared native image steps available', () => {
  for (const reduced of [false, true]) {
    const page = wheelPage({ map: true, reduced });
    assert.equal(page.wheel().defaultPrevented, true);
    if (reduced) assert.equal(page.native, 1100, 'reduced motion steps immediately');
    page.advance(800);
    assert.equal(page.native, 1100);
    assert.equal(page.tweens.length, 0);
    assert.ok(page.nativeWrites.length > 0);
  }
});

test('a smoother owned by another component is not adopted by the map controller', () => {
  const page = wheelPage({ map: true, smootherReady: true, ownsGallery: false });
  assert.equal(page.wheel().defaultPrevented, true);
  page.advance(800);
  assert.equal(page.native, 1100);
  assert.equal(page.tweens.length, 0);
  assert.ok(page.nativeWrites.length > 0);
});

test('the map returns above the first screenshot and steps down to that first screenshot', () => {
  const page = wheelPage({ map: true, smootherReady: true });
  assert.equal(page.wheel({ deltaY: -120 }).defaultPrevented, true);
  assert.equal(page.tweens.at(-1).vars.scrollTop, 0);
  page.advance(800);
  assert.equal(page.rendered, 0);
  page.wheel();
  assert.equal(page.tweens.at(-1).vars.scrollTop, 300);
  page.advance(800);
  assert.equal(page.rendered, 300);

  const classic = wheelPage();
  assert.equal(classic.wheel({ deltaY: -120 }).defaultPrevented, false);
  classic.advance(800);
  assert.equal(classic.native, 300, 'the map-only overview return does not affect listed galleries');
});

test('modified and horizontal wheel input is left to the browser', () => {
  const page = wheelPage({ map: true, smootherReady: true });
  for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
    assert.equal(page.wheel({ [modifier]: true }).defaultPrevented, false, modifier);
  }
  assert.equal(page.wheel({ deltaX: 120, deltaY: 10 }).defaultPrevented, false);
  assert.equal(page.tweens.length, 0);
});

test('native-only galleries keep their opt-out', () => {
  const page = wheelPage({ nativeOnly: true });
  assert.equal(page.document.listenerCount('wheel'), 0);
  assert.equal(page.wheel().defaultPrevented, false);
  assert.equal(page.nativeWrites.length, 0);
});

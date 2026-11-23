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
const locked = fs.readFileSync(path.join(root, '_layouts/locked-gallery.html'), 'utf8');
const exitLinks = fs.readFileSync(path.join(root, '_includes/rz-gallery-exit.html'), 'utf8');

function browser({ desktop = true, reduced = false, prefix = '', gsap = true, arrival = null,
    artwork, nextHref, previousHref, folder = 'hb-egypt', activeTag = 'body',
    navigationType = 'navigate', galleryLoop = 'hard-bullet', nextGalleryName, clientWidth = 1440 } = {}) {
  const events = {};
  const calls = [];
  const tweens = [];
  const historyCalls = [];
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
      this.style = { setProperty(name, value) { this[name] = value; } };
      this.className = '';
      this.classes = new Set();
      this.classList = {
        add: name => this.classes.add(name),
        remove: name => this.classes.delete(name),
        contains: name => this.classes.has(name)
      };
    }
    getBoundingClientRect() { return { height: 96 }; }
    append(...nodes) { this.children.push(...nodes); }
    setAttribute(name, value) { this[name] = value; }
    closest(selector) {
      return selector.split(',').some(part => part.trim() === this.tagName.toLowerCase()) ? this : null;
    }
  }
  const previous = {
    href: previousHref || 'https://example.test' + prefix + '/galleries/' +
      (galleryLoop === 'full' ? 'high-poly-models' : 'hb-rzstart') + '/',
    dataset: { galleryName: galleryLoop === 'full' ? 'High-Poly Models' : 'RZ Start (password required)' }
  };
  const next = {
    href: nextHref || 'https://example.test' + prefix + '/galleries/' +
      (galleryLoop === 'full' ? 'phantom-covert-ops' : 'hb-helipad') + '/',
    dataset: { galleryName: nextGalleryName || (galleryLoop === 'full' ? 'Phantom: Covert Ops - Oculus VR' : 'Helipad') }
  };
  const navigation = { dataset: { galleryLoop }, querySelector: key => key.endsWith('--next') ? next : previous };
  let dialog = false;
  const body = new Element('body');
  const siteHeader = new Element('header');
  siteHeader.className = 'site-header';
  body.append(siteHeader);
  const activeElement = activeTag === 'body' ? body : new Element(activeTag);
  const document = {
    currentScript: { src: 'https://example.test/galleries/gallery-desktop-panels.js?v=3' },
    hidden: false, fullscreenElement: null,
    documentElement: { clientWidth },
    activeElement, body, head: new Element('head'),
    createElement(tag) { return new Element(tag); },
    querySelector(key) {
      if (key === '.gallery-navigation') return navigation;
      if (key === 'body > .site-header') return siteHeader;
      if (key === '.gallery-content, .gallery-access' && artwork) return { getBoundingClientRect: () => artwork };
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
      pathname: prefix + '/galleries/' + folder + '/',
      href: 'https://example.test' + prefix + '/galleries/' + folder + '/',
      assign(url) { calls.push(url); }
    },
    history: {
      back() { historyCalls.push('back'); },
      forward() { historyCalls.push('forward'); }
    },
    performance: { getEntriesByType() { return [{ type: navigationType }]; } },
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
  function keydown(key, target = body, modifiers = {}) {
    const e = { key, target, ...modifiers, prevented: false,
      preventDefault() { this.prevented = true; } };
    events['window:keydown']?.(e);
    return e;
  }
  return {
    window, document, siteHeader, events, calls, historyCalls, tweens, pointer, advance, keydown, next, previous, Element,
    storedArrival() { return JSON.parse(storage.get('gallery-desktop-edge-arrival') || 'null'); },
    setDialog(value) { dialog = value; },
    get cues() { return body.children.find(node => node.className === 'gallery-edge-cues'); },
    get panel() { return body.children.find(node => node.className === 'gallery-desktop-edge-panel'); },
    event(type, payload = {}) { events['window:' + type]?.(payload); }
  };
}

test('desktop cues use the existing hover zones and leave fullscreen screenshot controls available', () => {
  assert.match(markup, /gallery-navigation[^>]+hidden/);
  assert.doesNotMatch(markup, /gallery-navigation__arrow|gallery-navigation__details/);
  assert.match(markup, /gallery-desktop-panels\.js'.*\?v=11/);
  assert.match(styles, /\.gallery-navigation\s*\{\s*display:\s*none !important/);
  assert.match(styles, /\.viewer-arrows button/);
  assert.doesNotMatch(styles, /gallery-desktop-scroll-stage/);
  assert.match(styles, /\.gallery-desktop-edge-panel\s*\{/);
  assert.match(styles, /\.gallery-edge-cues:not\(\[hidden\]\)\s*\{[^}]*position: absolute;[^}]*z-index: -1;[^}]*pointer-events: none/);
  assert.match(styles, /body:has\(dialog\[open\]\) \.gallery-edge-cues\s*\{\s*display: none/);

  const desktop = browser({ artwork: { left: 72, right: 1368 } });
  assert.equal(desktop.cues['aria-hidden'], 'true');
  assert.equal(desktop.cues.style['--gallery-edge-cue-width'], '44px');
  assert.equal(desktop.cues.style['--gallery-edge-scrollbar-inset'], '24px');
  assert.equal(desktop.cues.style['--gallery-edge-header-height'], '96px');
  assert.equal(browser({ desktop: false }).cues, undefined);
  assert.equal(browser({ nextHref: 'https://example.test/artur/galleries/hb-egypt/' }).cues, undefined);
});

test('wide gallery margins expand both hover zones while preserving scrollbar clearance', () => {
  for (const [x, which] of [[125, 'previous'], [1300, 'next']]) {
    const b = browser({ artwork: { left: 210, right: 1230 } });
    assert.equal(b.cues.style['--gallery-edge-cue-width'], '144px');
    b.pointer(x);
    b.advance(600);
    assert.deepEqual(b.calls, [which === 'previous' ? b.previous.href : b.next.href]);
  }
});

test('moving mouse into right or left edge starts the slide and navigates automatically', () => {
  for (const prefix of ['', '/artur']) {
    for (const [x, which] of [[1400, 'next'], [1, 'previous']]) {
      const b = browser({ prefix });
      b.pointer(x);
      assert.equal(b.panel.hidden, true, 'short edge brushes show nothing');
      b.advance(179);
      assert.equal(b.panel.hidden, true);
      b.advance(1);
      assert.equal(b.panel.hidden, false);
      assert.equal(b.panel.dataset.direction, which);
      assert.equal(b.calls.length, 0, 'animation must be visible before navigation');
      b.advance(419);
      assert.equal(b.calls.length, 0);
      b.advance(1);
      assert.deepEqual(b.calls, [which === 'next' ? b.next.href : b.previous.href]);
    }
  }
});

test('Full Portfolio edges loop through personal galleries and never touch Hard Bullet', () => {
  const b = browser({ prefix: '/artur', folder: 'nfs-unbound', galleryLoop: 'full' });
  b.pointer(1400);
  b.advance(180);
  assert.equal(b.panel.children[0].children[0].textContent, 'Full Portfolio');
  assert.equal(b.panel.children[0].children[1].textContent, 'Phantom: Covert Ops - Oculus VR');
  b.advance(420);
  assert.deepEqual(b.calls, [b.next.href]);
  assert.equal(b.storedArrival().loop, 'full');
  const first = browser({ prefix: '/artur', folder: 'nfs-unbound', galleryLoop: 'full' });
  first.pointer(0); first.advance(600);
  assert.deepEqual(first.calls, [first.previous.href]);
  const last = browser({ prefix: '/artur', folder: 'high-poly-models', galleryLoop: 'full',
    nextHref: 'https://example.test/artur/galleries/nfs-unbound/' });
  last.pointer(1400); last.advance(600);
  assert.deepEqual(last.calls, [last.next.href]);
});

test('studio Full Portfolio slides and wraps in its own card order', () => {
  const b = browser({ prefix: '', folder: 'nfs-unbound', galleryLoop: 'full',
    nextHref: 'https://example.test/galleries/vehicles-aircrafts/',
    previousHref: 'https://example.test/galleries/vegetation/',
    nextGalleryName: 'Vehicles - Aircrafts' });
  b.pointer(1400);
  b.advance(180);
  assert.equal(b.panel.children[0].children[0].textContent, 'Full Portfolio');
  assert.equal(b.panel.children[0].children[1].textContent, 'Vehicles - Aircrafts');
  b.advance(420);
  assert.deepEqual(b.calls, [b.next.href]);
  assert.equal(b.storedArrival().loop, 'full');
  const backwards = browser({ prefix: '', folder: 'nfs-unbound', galleryLoop: 'full',
    previousHref: 'https://example.test/galleries/vegetation/' });
  backwards.pointer(1);
  backwards.advance(600);
  assert.deepEqual(backwards.calls, [backwards.previous.href]);
  const last = browser({ prefix: '', folder: 'vegetation', galleryLoop: 'full',
    nextHref: 'https://example.test/galleries/nfs-unbound/' });
  last.pointer(1400);
  last.advance(600);
  assert.deepEqual(last.calls, [last.next.href]);
});

test('studio Full Portfolio rejects Hard Bullet, personal, external and unsafe destinations', () => {
  for (const nextHref of [
    'https://example.test/galleries/hb-egypt/',
    'https://example.test/artur/galleries/nfs-unbound/',
    'https://another.test/galleries/nfs-unbound/',
    'https://example.test/galleries/vegetation/?unsafe=1',
    'https://example.test/galleries/vegetation/#fragment'
  ]) {
    const b = browser({ prefix: '', folder: 'nfs-unbound', galleryLoop: 'full',
      nextHref, previousHref: 'https://example.test/galleries/vegetation/' });
    assert.equal(b.events['window:pointermove'], undefined, nextHref);
  }
});

test('the two loops reject cross-set, cross-portfolio and injected URL destinations', () => {
  for (const nextHref of [
    'https://example.test/artur/galleries/hb-egypt/',
    'https://example.test/galleries/nfs-unbound/',
    'https://elsewhere.test/artur/galleries/phantom-covert-ops/',
    'https://example.test/artur/galleries/props/?redirect=1'
  ]) {
    const b = browser({ prefix: '/artur', folder: 'nfs-unbound', galleryLoop: 'full', nextHref });
    assert.equal(b.events['window:pointermove'], undefined);
  }
  const hb = browser({ prefix: '/artur', nextHref: 'https://example.test/artur/galleries/nfs-unbound/' });
  assert.equal(hb.events['window:pointermove'], undefined);
});

test('approaching within five percent of an edge works without touching screen border', () => {
  const b = browser();
  b.pointer(75);
  b.advance(600);
  assert.deepEqual(b.calls, [b.previous.href]);
});

test('standard, wide and overlay scrollbar gutters never start a gallery slide', () => {
  for (const clientWidth of [1440, 1425, 1392]) {
    const b = browser({ clientWidth });
    const boundary = Math.min(clientWidth, 1416);
    for (const x of [boundary, 1439]) {
      b.pointer(x);
      b.advance(700);
      assert.equal(b.panel.hidden, true);
      assert.deepEqual(b.calls, []);
    }
    b.pointer(boundary - 1);
    b.advance(600);
    assert.deepEqual(b.calls, [b.next.href]);
  }
});

test('moving onto a scrollbar cancels both the hover delay and an in-progress slide', () => {
  for (const elapsed of [100, 250]) {
    const b = browser({ clientWidth: 1425 });
    b.pointer(1400);
    b.advance(elapsed);
    b.pointer(1432);
    b.advance(700);
    assert.equal(b.panel.hidden, true);
    assert.deepEqual(b.calls, []);
  }
});

test('leaving page content for a native scrollbar can cancel without another pointermove', () => {
  const b = browser();
  b.pointer(1400);
  b.advance(250);
  assert.equal(b.panel.hidden, false);
  b.event('pointerout', { pointerType: 'mouse', relatedTarget: null });
  b.advance(700);
  assert.equal(b.panel.hidden, true);
  assert.deepEqual(b.calls, []);
});

test('moving out of the edge before or during animation cancels the transition', () => {
  for (const elapsed of [80, 360]) {
    const b = browser();
    b.pointer(1400);
    b.advance(elapsed);
    b.pointer(720);
    b.advance(1500);
    assert.equal(b.calls.length, 0);
    assert.equal(b.panel.hidden, true);
  }
});

test('moving between edges changes direction instead of leaving a stale navigation', () => {
  const b = browser();
  b.pointer(1400);
  b.advance(200);
  b.pointer(0);
  b.advance(180 + 420);
  assert.deepEqual(b.calls, [b.previous.href]);
});

test('page visits do not automatically chain to another gallery until the mouse exits the edge', () => {
  const b = browser({ arrival: { direction: 'next', pathname: '/galleries/hb-egypt/', at: 0 } });
  b.pointer(1400);
  b.advance(1700);
  assert.equal(b.calls.length, 0);
  b.pointer(700);
  b.pointer(1400);
  b.advance(600);
  assert.deepEqual(b.calls, [b.next.href]);
});

test('touch and coarse-pointer devices do not install desktop navigation handlers', () => {
  const coarse = browser({ desktop: false });
  assert.equal(coarse.events['window:pointermove'], undefined);
  assert.equal(coarse.panel, undefined);
  const touch = browser();
  touch.pointer(1400, { type: 'touch' });
  touch.advance(2000);
  assert.deepEqual(touch.calls, []);
});

test('gallery fullscreen, dialogs, editable targets and zoom block edge navigation', () => {
  for (const setup of [
    b => { b.document.fullscreenElement = {}; },
    b => b.setDialog(true),
    b => { b.window.visualViewport.scale = 1.3; }
  ]) {
    const b = browser();
    setup(b);
    b.pointer(1400);
    b.advance(2000);
    assert.deepEqual(b.calls, []);
  }
  for (const tag of ['a', 'input', 'button', 'label']) {
    const b = browser({ activeTag: 'input' });
    b.pointer(1400, { target: new b.Element(tag) });
    b.advance(1000);
    assert.equal(b.calls.length, 0, 'interactive element: ' + tag);
  }
});

test('mouse button press cancels an active edge transition', () => {
  const b = browser();
  b.pointer(1400);
  b.advance(240);
  b.event('pointerdown');
  b.advance(1000);
  assert.equal(b.calls.length, 0);
});

test('keyboard arrows remain a click-free fallback outside interactive elements', () => {
  const b = browser();
  assert.equal(b.keydown('ArrowRight').prevented, true);
  b.advance(420);
  assert.deepEqual(b.calls, [b.next.href]);
  const c = browser();
  assert.equal(c.keydown('ArrowLeft', new c.Element('input')).prevented, false);
  c.advance(1000);
  assert.equal(c.calls.length, 0);
});

test('reduced motion and GSAP failure both preserve auto navigation', () => {
  const reduced = browser({ reduced: true });
  reduced.pointer(1400);
  reduced.advance(430);
  assert.deepEqual(reduced.calls, [reduced.next.href]);
  const css = browser({ gsap: false });
  css.pointer(1400);
  css.advance(180 + 460);
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
    b.pointer(1400);
    b.advance(2000);
    assert.deepEqual(b.calls, []);
  }
});

test('RZ Start password focus does not trap edge navigation on either portfolio', () => {
  for (const prefix of ['', '/artur']) {
    const options = {
      prefix, folder: 'hb-rzstart', activeTag: 'input',
      previousHref: 'https://example.test' + prefix + '/galleries/hb-spybase/',
      nextHref: 'https://example.test' + prefix + '/galleries/hb-egypt/'
    };
    for (const [x, expected] of [[1, options.previousHref], [1400, options.nextHref]]) {
      const b = browser(options);
      b.pointer(x);
      b.advance(600);
      assert.deepEqual(b.calls, [expected], 'RZ Start escape must work: ' + expected);
    }
  }
});

test('Alt+Left and Alt+Right traverse history even while a password input is focused', () => {
  const b = browser({ folder: 'hb-rzstart', activeTag: 'input' });
  const password = new b.Element('input');
  assert.equal(b.keydown('ArrowLeft', password, { altKey: true }).prevented, true);
  assert.equal(b.keydown('ArrowRight', password, { altKey: true }).prevented, true);
  assert.deepEqual(b.historyCalls, ['back', 'forward']);
  assert.deepEqual(b.calls, [], 'history shortcuts must not create new gallery entries');
});

test('Back/Forward history restoration stays disarmed until mouse leaves edge', () => {
  for (const [options, event] of [
    [{}, { persisted: true }],
    [{ navigationType: 'back_forward' }, { persisted: false }]
  ]) {
    const b = browser(options);
    b.event('pageshow', event);
    b.pointer(1400);
    b.advance(1400);
    assert.deepEqual(b.calls, [], 'history restore must not automatically advance');
    b.pointer(700);
    b.pointer(1400);
    b.advance(600);
    assert.deepEqual(b.calls, [b.next.href]);
  }
});

test('RZ gate provides visible previous and looping-next fallback links before and after unlock', () => {
  assert.match(locked, /<main id="gallery-access"/);
  assert.equal(locked.split('include rz-gallery-exit.html').length - 1, 2);
  assert.match(exitLinks, /rz_previous\.folder/);
  assert.match(exitLinks, /rz_next\.folder/);
  assert.match(exitLinks, /Previous gallery:/);
  assert.match(exitLinks, /Next gallery:/);
  assert.match(exitLinks, /include\.portfolio_url/);
  assert.doesNotMatch(exitLinks, /onclick=|type="button"/);
});

test('transition tint is exactly RGB 21,20,23 without the old brown gradient', () => {
  assert.match(styles, /\.gallery-desktop-edge-panel\s*\{[^}]*background:\s*rgb\(21, 20, 23\)/s);
  assert.doesNotMatch(styles, /linear-gradient\(125deg, #171717/);
});

test('Alt+Back/Forward are not intercepted while the fullscreen image viewer is open', () => {
  const b = browser();
  b.document.fullscreenElement = {};
  const e = b.keydown('ArrowLeft', new b.Element('body'), { altKey: true });
  assert.equal(e.prevented, false);
  assert.deepEqual(b.historyCalls, []);
});

test('loading gallery status overlays without shifting the first image during hydration', () => {
  const content = styles.match(/\.gallery-content\s*\{([^}]*)\}/)?.[1] || '';
  const status = styles.match(/\.gallery-content\s*>\s*#gallery-status:not\(\[hidden\]\)\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(content, /position:\s*relative/);
  assert.match(status, /position:\s*absolute/);
  assert.match(status, /pointer-events:\s*none/);
  assert.doesNotMatch(status, /(?:min-)?height:|top:\s*[-\d]/);
});

test('faster handoff keeps the exact edge initiation, cancellation and easing unchanged', () => {
  assert.match(script, /const holdDelay = 180;/);
  assert.match(script, /const slideDuration = 420;/);
  assert.match(script, /Math\.max\(52, Math\.min\(96, width \* \.06\)\)/);
  assert.match(script, /ease: 'power2\.inOut'/);
  assert.match(script, /clear\(true\)/);
});


test('the original logo/navigation/accent header stays above the panel without cloning or reflow', () => {
  for (const prefix of ['', '/artur']) {
    const b = browser({ prefix });
    const originalHeader = b.siteHeader;
    const childrenBefore = b.document.body.children.length;
    assert.equal(b.document.body.classList.contains('gallery-edge-header-visible'), false);
    b.pointer(1400);
    b.advance(179);
    assert.equal(b.document.body.classList.contains('gallery-edge-header-visible'), false,
      'hover initiation remains unchanged');
    b.advance(1);
    assert.equal(b.panel.hidden, false);
    assert.equal(b.document.body.classList.contains('gallery-edge-header-visible'), true);
    assert.equal(b.panel.style.top, '96px', 'only the slide panel is inset below header');
    assert.strictEqual(b.document.body.children[0], originalHeader);
    assert.equal(b.document.body.children.length, childrenBefore, 'no duplicate header was inserted');
    b.advance(419);
    assert.equal(b.document.body.classList.contains('gallery-edge-header-visible'), true);
    b.advance(1);
    assert.deepEqual(b.calls, [b.next.href], 'baseline 420ms navigation remains unchanged');
  }
});

test('navigation retains an identical cover for document snapshots and records stationary title', () => {
  const b = browser();
  b.pointer(1400);
  b.advance(600);
  assert.deepEqual(b.calls, [b.next.href]);
  const marker = b.storedArrival();
  assert.equal(marker.pathname, '/galleries/hb-helipad/');
  assert.equal(marker.title, 'Helipad');
  assert.equal(marker.headerHeight, 96);
  b.event('pagehide');
  assert.equal(b.panel.hidden, false, 'old cover stays painted for Chrome snapshot');
  assert.equal(b.document.body.classList.contains('gallery-edge-header-visible'), true);
  b.event('pageshow', { persisted: true });
  assert.equal(b.panel.hidden, true, 'restoring BFCache removes the cover');
});

test('cancelled edge slide restores original header and panel geometry after reverse animation', () => {
  for (const gsap of [true, false]) {
    const b = browser({ gsap });
    b.pointer(1400);
    b.advance(200);
    assert.equal(b.document.body.classList.contains('gallery-edge-header-visible'), true);
    b.pointer(700);
    // Header stays visible during the 180ms reverse animation.
    assert.equal(b.document.body.classList.contains('gallery-edge-header-visible'), true);
    b.advance(190);
    assert.equal(b.document.body.classList.contains('gallery-edge-header-visible'), false);
    assert.equal(b.panel.style.top, '');
    assert.equal(b.panel.hidden, true);
    b.advance(800);
    assert.deepEqual(b.calls, [], 'cancelled animation never navigates');
  }
});

test('original header is sticky above panel, with no clones, altered document height or pointer capture', () => {
  const rule = styles.match(/body\.gallery-edge-header-visible > \.site-header\s*\{([^}]*)\}/s)?.[1] || '';
  assert.match(rule, /position:\s*sticky/);
  assert.match(rule, /top:\s*0/);
  assert.match(rule, /z-index:\s*31/);
  assert.match(rule, /pointer-events:\s*none/);
  assert.doesNotMatch(rule, /position:\s*fixed/);
  assert.doesNotMatch(script, /cloneNode|outerHTML|replaceWith/);
  assert.match(script, /const slideDuration = 420;/);
  assert.match(script, /const holdDelay = 180;/);
});

test('mobile and reduced-motion navigation never enable floating original header', () => {
  const mobile = browser({ desktop: false });
  assert.equal(mobile.events['window:pointermove'], undefined);
  assert.equal(mobile.document.body.classList.contains('gallery-edge-header-visible'), false);
  const reduced = browser({ reduced: true });
  reduced.pointer(1400);
  reduced.advance(200);
  assert.equal(reduced.document.body.classList.contains('gallery-edge-header-visible'), false);
  reduced.advance(300);
  assert.deepEqual(reduced.calls, [reduced.next.href]);
});

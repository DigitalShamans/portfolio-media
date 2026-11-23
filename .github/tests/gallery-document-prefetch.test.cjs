'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const script = fs.readFileSync(path.join(root, 'galleries/gallery-document-prefetch.js'), 'utf8');
const navSource = fs.readFileSync(path.join(root, '_includes/gallery-navigation.html'), 'utf8');
const panelSource = fs.readFileSync(path.join(root, 'galleries/gallery-desktop-panels.js'), 'utf8');

function browser({ prefix = '', desktop = true, supported = true, saveData = false,
    effectiveType = '4g', hidden = false, readyState = 'complete',
    previousHref, nextHref, galleryLoop = 'hard-bullet', folder = 'hb-egypt' } = {}) {
  const listeners = new Map();
  const idle = [];
  const appended = [];
  const previous = { href: previousHref || 'https://example.test' + prefix + '/galleries/' +
    (galleryLoop === 'full' ? 'high-poly-models' : 'hb-rzstart') + '/' };
  const next = { href: nextHref || 'https://example.test' + prefix + '/galleries/' +
    (galleryLoop === 'full' ? 'phantom-covert-ops' : 'hb-helipad') + '/' };
  const navigation = { dataset: { galleryLoop }, querySelector(name) {
    return name.endsWith('--previous') ? previous : next;
  } };
  const document = {
    readyState, hidden,
    querySelector: name => name === '.gallery-navigation' ? navigation : null,
    createElement(name) {
      assert.equal(name, 'script');
      return { type: '', textContent: '' };
    },
    head: { append(element) { appended.push(element); } }
  };
  const window = {
    HTMLScriptElement: { supports: name => name === 'speculationrules' && supported },
    navigator: { connection: { saveData, effectiveType } },
    location: {
      origin: 'https://example.test',
      pathname: prefix + '/galleries/' + folder + '/',
      href: 'https://example.test' + prefix + '/galleries/' + folder + '/'
    },
    innerWidth: 1440,
    matchMedia: () => ({ matches: desktop }),
    addEventListener(name, callback) { listeners.set(name, callback); },
    requestIdleCallback(callback, options) { idle.push({ callback, options }); },
    setTimeout(callback) { idle.push({ callback }); }
  };
  vm.runInNewContext(script, { window, document, URL }, { filename: 'gallery-document-prefetch.js' });
  return {
    window, document, listeners, idle, appended, previous, next,
    pointer(x, pointerType = 'mouse') {
      listeners.get('pointermove')?.({ pointerType, clientX: x });
    },
    warm() { idle.splice(0).forEach(item => item.callback()); },
    sources() {
      return appended.flatMap(item => {
        assert.equal(item.type, 'speculationrules');
        const rules = JSON.parse(item.textContent);
        assert.equal(rules.prerender, undefined);
        assert.equal(rules.prefetch.length, 1);
        assert.equal(rules.prefetch[0].source, 'list');
        assert.equal(rules.prefetch[0].eagerness, 'immediate');
        return rules.prefetch[0].urls;
      });
    }
  };
}

test('approaching either edge warms only its adjacent document before actual edge trigger', () => {
  const b = browser();
  b.pointer(140);
  assert.deepEqual(b.sources(), [b.previous.href]);
  b.pointer(1320);
  assert.deepEqual(b.sources(), [b.previous.href, b.next.href]);
  b.pointer(1430); b.pointer(0);
  assert.equal(b.appended.length, 2, 'hover must not add duplicate prefetch rules');
});

test('idle warms both adjacent documents even without hovering', () => {
  const b = browser();
  assert.equal(b.appended.length, 0);
  assert.equal(b.idle.length, 1);
  assert.equal(b.idle[0].options.timeout, 1500);
  b.warm();
  assert.deepEqual(b.sources(), [b.previous.href, b.next.href]);
  assert.equal(b.appended.length, 2);
});

test('a prefetched document is never prerendered and contains no media or protected image requests', () => {
  const b = browser();
  b.warm();
  const sources = b.sources();
  assert(sources.every(url => /^https:\/\/example\.test\/galleries\/hb-[a-z0-9-]+\/$/.test(url)));
  assert(sources.every(url => !/\.(?:jpe?g|webp|png|js|css)/.test(url)));
  assert(!script.includes('galleryAccess'));
});

test('artur portfolio keeps its prefix and the password gate is only a document URL', () => {
  const b = browser({ prefix: '/artur' });
  b.warm();
  assert.deepEqual(b.sources(), [
    'https://example.test/artur/galleries/hb-rzstart/',
    'https://example.test/artur/galleries/hb-helipad/'
  ]);
});

test('personal Full Portfolio prefetch stays within its own loop and never fetches images', () => {
  const b = browser({ prefix: '/artur', galleryLoop: 'full', folder: 'nfs-unbound' });
  b.warm();
  assert.deepEqual(b.sources(), [
    'https://example.test/artur/galleries/high-poly-models/',
    'https://example.test/artur/galleries/phantom-covert-ops/'
  ]);
  assert(b.sources().every(url => !/\.(?:jpg|webp|mp4)/i.test(url)));
  for (const nextHref of [
    'https://example.test/artur/galleries/hb-egypt/',
    'https://example.test/galleries/props/',
    'https://elsewhere.test/artur/galleries/props/'
  ]) {
    const invalid = browser({ prefix: '/artur', galleryLoop: 'full', folder: 'nfs-unbound', nextHref });
    invalid.warm();
    assert.deepEqual(invalid.sources(), [invalid.previous.href]);
  }
});

test('studio Full Portfolio prefetches only the two declared adjacent gallery documents', () => {
  const b = browser({ prefix: '', galleryLoop: 'full', folder: 'nfs-unbound',
    previousHref: 'https://example.test/galleries/vegetation/',
    nextHref: 'https://example.test/galleries/vehicles-aircrafts/' });
  b.warm();
  assert.deepEqual(b.sources(), [b.previous.href, b.next.href]);
  assert(b.sources().every(url => !/\.(?:jpe?g|webp|mp4)/i.test(url)));
  for (const nextHref of [
    'https://example.test/artur/galleries/nfs-unbound/',
    'https://example.test/galleries/hb-egypt/',
    'https://other.test/galleries/props/'
  ]) {
    const invalid = browser({ prefix: '', galleryLoop: 'full', folder: 'nfs-unbound',
      previousHref: 'https://example.test/galleries/vegetation/', nextHref });
    invalid.warm();
    assert.deepEqual(invalid.sources(), [invalid.previous.href]);
  }
});

test('touch browsers, data saver, 2g connections and unsupported browsers do nothing', () => {
  for (const options of [
    { desktop: false }, { supported: false }, { saveData: true },
    { effectiveType: '2g' }, { effectiveType: 'slow-2g' }
  ]) {
    const b = browser(options);
    b.pointer(140);
    b.warm();
    assert.equal(b.appended.length, 0);
    assert.equal(b.listeners.size, 0);
  }
});

test('invalid or cross-portfolio links are not prefetched', () => {
  for (const bad of [
    'https://other.test/galleries/hb-helipad/',
    'https://example.test/artur/galleries/hb-helipad/',
    'https://example.test/galleries/vehicles-aircrafts/',
    'https://example.test/galleries/hb-helipad/?sideEffect=1'
  ]) {
    const b = browser({ nextHref: bad });
    b.pointer(1430);
    b.warm();
    const result = b.sources();
    assert.deepEqual(result, [b.previous.href]);
  }
});

test('hidden tabs delay speculative downloads without breaking edge behavior', () => {
  const b = browser({ hidden: true });
  b.warm(); b.pointer(10);
  assert.deepEqual(b.sources(), []);
  b.document.hidden = false;
  b.pointer(10);
  assert.deepEqual(b.sources(), [b.previous.href]);
});

test('document prefetch is isolated from the original 420ms animation and route navigation', () => {
  assert.match(navSource, /gallery-desktop-panels\.js'.*\?v=11/);
  assert.match(navSource, /gallery-document-prefetch\.js'.*\?v=3/);
  assert.match(panelSource, /const holdDelay = 180;/);
  assert.match(panelSource, /const slideDuration = 420;/);
  assert.doesNotMatch(script, /location\.assign|location\.replace|scrollTrigger|cloneNode/);
});

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '../..');
const bootstrap = fs.readFileSync(path.join(root, '_includes/portfolio-diagnostics.html'), 'utf8')
  .replace(/<\/?script>/g, '')
  .replace(/{{ include\.section \| jsonify }}/, '"gallery"')
  .replace(/{{ '([^']+)' \| relative_url \| jsonify }}/g, (_, asset) => JSON.stringify(asset));
const core = fs.readFileSync(path.join(root, 'assets/portfolio-diagnostics.js'), 'utf8');

function visit(url, timeOrigin, stored = new Map()) {
  const listeners = {};
  const loaded = [];
  const location = new URL(url);
  const window = {
    innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1,
    matchMedia: query => ({ matches: ['(pointer: fine)', '(hover: hover)', '(any-pointer: coarse)'].includes(query) }),
    addEventListener: (name, callback) => { listeners[name] = callback; }
  };
  const document = {
    readyState: 'loading', baseURI: location.href, addEventListener() {},
    head: { append: element => loaded.push(element.src) },
    createElement: tagName => ({ tagName: tagName.toUpperCase(), addEventListener() {} })
  };
  const context = vm.createContext({
    AbortController, URL, URLSearchParams, document, location, window,
    navigator: { userAgent: 'Chrome/145.0.0.0', maxTouchPoints: 10 },
    performance: { timeOrigin, now: () => 17 },
    sessionStorage: {
      getItem: key => stored.get(key),
      setItem: (key, value) => stored.set(key, value),
      removeItem: key => stored.delete(key)
    }
  });
  vm.runInContext(bootstrap, context);
  return { window, loaded, listeners, stored, load: () => vm.runInContext(core, context) };
}

test('ordinary visits do not request diagnostics or install observers', () => {
  const current = visit('https://example.test/galleries/hb-egypt/', 1);
  assert.equal(current.window.PortfolioDiagnostics, undefined);
  assert.deepEqual(current.loaded, []);
  assert.deepEqual(current.listeners, {});
});

test('diagnostics carry early failures and the actual transition engine across gallery pages', () => {
  const first = visit('https://example.test/galleries/hb-egypt/?diagnostics=1&privateQuery=omit', 1);
  const diagnostic = first.window.PortfolioDiagnostics;
  first.listeners.error({
    target: { tagName: 'SCRIPT', src: 'https://example.test/assets/gsap.min.js?secret=omit' }
  });
  diagnostic.state('gallery-edge', 'CSS fallback');
  first.load();
  diagnostic.event('gallery-edge', 'navigation started', { engine: 'CSS fallback', destination: '/galleries/hb-helipad/' });
  first.listeners.pagehide();
  const next = visit('https://example.test/galleries/hb-helipad/', 2, first.stored);
  next.load();
  const report = next.window.PortfolioDiagnostics.report();
  assert.equal(report.pages.length, 2);
  assert.equal(report.pages[0].events[0].details.file, 'gsap.min.js');
  assert.equal(report.pages[0].events[1].details.engine, 'CSS fallback');
  assert.equal(report.pages[1].environment.touchPoints, 10);
  assert.equal(report.pages[1].environment.primaryPointer, 'fine');
  assert.doesNotMatch(JSON.stringify(report), /privateQuery|secret|omit/);
  const closed = visit('https://example.test/?diagnostics=0', 3, first.stored);
  assert.equal(closed.window.PortfolioDiagnostics, undefined);
  assert.equal(first.stored.size, 0);
});

test('callbacks at the same position are separate from motion and trace storage is bounded', () => {
  const current = visit('https://example.test/artur/resume/?diagnostics=1', 1);
  current.load();
  const diagnostic = current.window.PortfolioDiagnostics;
  diagnostic.sample('resume-smoother', 10, 50);
  diagnostic.sample('resume-smoother', 10, 50);
  diagnostic.sample('resume-smoother', 35, 50);
  for (let index = 0; index < 80; index++) diagnostic.event('resume-reveals', 'reveal completed');
  const page = diagnostic.report().pages[0];
  assert.equal(page.motion['resume-smoother'].callbacks, 3);
  assert.equal(page.motion['resume-smoother'].advances, 1);
  assert.equal(page.motion['resume-smoother'].maxNativeDifferencePx, 40);
  assert.equal(page.tallies['resume-reveals']['reveal completed'], 80);
  assert.equal(page.events.length, 64);
});

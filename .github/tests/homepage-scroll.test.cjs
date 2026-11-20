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

test('both homepages retain native page scrolling and all gallery banners', () => {
  assert.match(layout, /portfolio\.css' \| relative_url }}\?v=9/);
  assert.match(layout, /<div class="recent-galleries" role="region" aria-label="Gallery banners" tabindex="0">/);
  assert.match(layout, /recent-galleries"[^>]*tabindex="0"/);
  assert.match(layout, /for gallery in site\.data\.portfolio\.recent/);
  assert.match(layout, /for project in portfolio\.full/);
  assert.match(layout, /include site-header\.html/);
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


function wheelHarness(position = 0, page = 0) {
  const region = { scrollTop: position, scrollHeight: 1000, clientHeight: 600 };
  const state = { page };
  let handler;
  region.addEventListener = (event, callback, opts) => {
    assert.equal(event, 'wheel');
    assert.equal(opts.passive, false);
    handler = callback;
  };
  vm.runInNewContext(wheel, {
    document: { querySelector: () => region },
    window: { scrollBy: movement => {
      assert.equal(movement.behavior, 'instant');
      state.page = Math.max(0, state.page + movement.top);
    } }
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
  return { region, state, send };
}

test('wheel boundary movement is split between gallery and page in the same event', () => {
  const h = wheelHarness(350, 20);
  assert.equal(h.send(200), true);
  assert.equal(h.region.scrollTop, 400);
  assert.equal(h.state.page, 170);
  assert.equal(h.send(100), true);
  assert.equal(h.state.page, 270);
});

test('reverse scrolling hands leftover motion to the page immediately', () => {
  const h = wheelHarness(75, 400);
  assert.equal(h.send(-125), true);
  assert.equal(h.region.scrollTop, 0);
  assert.equal(h.state.page, 350);
});

test('zoom and horizontal trackpad gestures are never hijacked', () => {
  const h = wheelHarness();
  assert.equal(h.send(120, { ctrlKey: true }), false);
  assert.equal(h.send(120, { deltaX: 200 }), false);
  assert.equal(h.send(120, { cancelable: false }), false);
  assert.equal(h.region.scrollTop, 0);
});

test('portfolio GSAP effects are scoped, scroll-safe and reduced-motion aware', () => {
  assert.match(layout, /recent-galleries-scroll\.js' \| relative_url }}\?v=1/);
  assert.match(layout, /portfolio-effects\.js' \| relative_url }}\?v=2/);
  assert.match(layout, /vendor\/gsap\/3\.15\.1\/gsap\.min\.js/);
  assert.match(layout, /vendor\/gsap\/3\.15\.1\/ScrollTrigger\.min\.js/);
  assert.match(effects, /prefers-reduced-motion: reduce/);
  assert.match(effects, /portfolio-home/);
  assert.match(effects, /portfolio-page:not\(\.portfolio-home\) \.portfolio-grid/);
  assert.match(effects, /ScrollTrigger\.batch\(cards/);
  assert.doesNotMatch(effects, /normalizeScroll\s*\(|preventDefault\s*\(/);
});

test('studio parallax registers only on a fine pointer and Artur uses staggered tile batches', () => {
  const images = [{}, {}], cards = [{}, {}];
  function inspect(studio, reduced = false, fine = true) {
    const calls = { set: 0, quick: 0, created: 0, batched: 0, entered: 0 };
    let bannerTop = 100;
    let scale;
    let shift;
    let onBannerScroll;
    const banners = images.map(img => ({
      querySelector: () => img,
      getBoundingClientRect: () => ({ top: bannerTop, height: 200 })
    }));
    const gsap = {
      registerPlugin() {},
      set(elements, options) {
        calls.set++;
        scale = options.scale;
      },
      quickSetter() {
        return value => {
          calls.quick++;
          shift = value;
        };
      },
      fromTo() { calls.entered++; }
    };
    const ScrollTrigger = {
      create() { calls.created++; },
      batch(entries, opts) { calls.batched++; assert.equal(entries.length, 2); opts.onEnter(cards); }
    };
    const region = {
      querySelectorAll: () => banners,
      getBoundingClientRect: () => ({ top: 0, bottom: 800 }),
      addEventListener(event, handler) {
        if (event === 'scroll') onBannerScroll = handler;
      }
    };
    const win = {
      gsap, ScrollTrigger, innerHeight: 1000,
      requestAnimationFrame: fn => fn(),
      addEventListener() {},
      matchMedia: q => ({ matches: q.includes('reduced-motion') ? reduced : fine })
    };
    const doc = {
      body: { classList: { contains: c => studio ? c === 'portfolio-home' : c === 'portfolio-page' } },
      querySelector: q => q.includes('recent-galleries') ? region : { querySelectorAll: () => cards }
    };
    vm.runInNewContext(effects, { document: doc, window: win });
    return {
      ...calls, scale, shift,
      moveBanner(top) {
        bannerTop = top;
        onBannerScroll();
        return shift;
      }
    };
  }
  const studio = inspect(true);
  assert.equal(studio.set, 1);
  assert.equal(studio.quick, 2);
  assert.equal(studio.created, 1);
  assert.equal(studio.batched, 0);
  assert.ok(studio.moveBanner(-50) - studio.shift >= 5,
    'A 150px scroll should pan the artwork at least 5% of the banner height');
  assert.equal(studio.moveBanner(100), studio.shift, 'Reverse scrolling restores the original position');
  const maxShift = Math.max(Math.abs(studio.moveBanner(-200)), Math.abs(studio.moveBanner(850)));
  assert.ok((studio.scale - 1) * 50 > maxShift, 'The artwork covers the frame throughout the pan');
  const personal = inspect(false);
  assert.equal(personal.set, 0);
  assert.equal(personal.batched, 1);
  assert.equal(personal.entered, 1);
  assert.equal(inspect(true, true).created, 0);
  assert.equal(inspect(true, false, false).set, 0);
});

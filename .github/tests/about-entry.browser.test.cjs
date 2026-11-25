'use strict';

const assert = require('node:assert/strict');
const { existsSync, mkdirSync, statSync } = require('node:fs');
const { join, resolve, sep } = require('node:path');
const { after, before, test } = require('node:test');
const { chromium } = require('playwright');

const site = join(resolve(__dirname, '../..'), '_site');
const evidence = join(resolve(__dirname, '../..'), 'test-results/about-entry');
const origin = 'http://localhost:3000';
const destination = origin + '/resume/';
const markerKey = 'portfolio-about-entry-v1';
const linkSelector = '.site-nav [data-about-entry-link]';
const temporarySelector = '.about-entry-sheet, .about-entry-mask, .about-entry-label, .about-entry-copy';
const image = Buffer.from('UklGRjAAAABXRUJQVlA4ICQAAABQAQCdASoQAAkAAUAmJQBOgCgAAP7nMP6+8odiZDdJ+p/KAAA=', 'base64');
let browser;

before(async () => {
  assert.ok(existsSync(join(site, 'resume/index.html')), 'Run the shared validation action to build _site before browser checks.');
  mkdirSync(evidence, { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
});
after(() => browser?.close());

function signal() {
  let release;
  return { reached: new Promise(resolve => { release = resolve; }), release: () => release() };
}

async function withinFiveSeconds(promise, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label + ' was not observed within 5000ms')), 5000);
    })]);
  } finally { clearTimeout(timer); }
}

async function session(t, { width = 1440, height = 900, touch = false, reducedMotion = 'no-preference',
  javaScriptEnabled = true, storageDenied = false, arrival, observe = false, intercept } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch,
    isMobile: touch, reducedMotion, javaScriptEnabled });
  context.setDefaultTimeout(5000);
  context.setDefaultNavigationTimeout(5000);
  t.after(() => context.close());
  const requests = [], errors = [], platformNotices = [];
  context.on('page', page => page.on('pageerror', error => {
    // Chrome also emits this with JavaScript disabled when only the outgoing document
    // opted into cross-document View Transitions. The About entry deliberately uses GSAP.
    if (error.message === 'Transition was aborted because of invalid state. ViewTransition opt-in disabled') {
      platformNotices.push(error.message);
    } else errors.push(error.message);
  }));
  t.after(() => {
    if (platformNotices.length) t.diagnostic('Chrome cancelled ' + platformNotices.length +
      ' cross-document View Transition(s) at the non-opted-in About destination; application errors remain independently checked.');
  });
  if (storageDenied) {
    await context.addInitScript(() => {
      Object.defineProperty(window, 'sessionStorage', {
        configurable: true,
        get() { throw new DOMException('Storage disabled by browser test', 'SecurityError'); },
      });
    });
  }
  if (arrival) {
    await context.addInitScript(({ key, entry }) => {
      if (location.pathname === '/resume/') {
        sessionStorage.setItem(key, JSON.stringify({ to: '/resume/', from: '/galleries/hb-egypt/',
          at: Date.now() - (entry.age || 0), ...entry }));
      }
    }, { key: markerKey, entry: arrival });
  }
  if (observe) {
    await context.addInitScript(() => {
      if (location.pathname !== '/resume/') return;
      window.aboutFrames = [];
      const start = performance.now();
      function sample() {
        const sheet = document.querySelector('.about-entry-sheet');
        const title = document.querySelector('#about-title');
        const masks = [...document.querySelectorAll('.about-entry-mask')].map(mask => {
          const bounds = mask.getBoundingClientRect();
          const white = mask.querySelector('.about-entry-white');
          const accent = mask.querySelector('.about-entry-accent');
          const whiteBounds = white?.getBoundingClientRect(), accentBounds = accent?.getBoundingClientRect();
          const clip = white && getComputedStyle(white).clipPath;
          const inset = clip?.match(/^inset\((.+)\)$/)?.[1].split(/\s+/);
          const pixels = value => parseFloat(value) * (value.endsWith('%') ? whiteBounds.width / 100 : 1);
          const visibleWhite = inset?.length === 4 ? Math.max(0, whiteBounds.width - pixels(inset[1]) - pixels(inset[3])) : 0;
          return { width: bounds.width, white: visibleWhite, whiteClip: clip,
            accent: accentBounds ? Math.max(0, Math.min(accentBounds.right, bounds.right) - Math.max(accentBounds.left, bounds.left)) : 0,
            accentX: accentBounds ? accentBounds.left - bounds.left : 0 };
        });
        if (document.documentElement.dataset.aboutEntry || sheet || masks.length) {
          window.aboutFrames.push({ time: performance.now() - start,
            state: document.documentElement.dataset.aboutEntry,
            clip: sheet && getComputedStyle(sheet).clipPath,
            parentIsBody: sheet?.parentElement === document.body,
            width: sheet?.getBoundingClientRect().width, height: sheet?.getBoundingClientRect().height,
            titleOpacity: title && Number(getComputedStyle(title).opacity), masks });
        }
        if (performance.now() - start < 6500) requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
  }
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    requests.push(url.href);
    if (intercept && await intercept(route, url)) return;
    if (/\.(?:webp|jpe?g|png|gif)$/i.test(url.pathname) &&
        !(url.origin === origin && url.pathname.startsWith('/assets/'))) {
      return route.fulfill({ contentType: 'image/webp', body: image });
    }
    if (url.origin !== origin) return route.fulfill({ status: 404 });
    let file = resolve(site, '.' + decodeURIComponent(url.pathname));
    if (file !== site && !file.startsWith(site + sep)) return route.fulfill({ status: 404 });
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file) || !statSync(file).isFile()) return route.fulfill({ status: 404 });
    return route.fulfill({ path: file });
  });
  const page = await context.newPage();
  return { context, page, requests, errors };
}

async function source(page, path, diagnostics = false) {
  await page.goto(origin + path + (diagnostics ? '?diagnostics=1' : ''), { waitUntil: 'domcontentloaded' });
  const link = page.locator(linkSelector);
  await link.waitFor({ state: 'visible' });
  assert.equal(await link.getAttribute('href'), '/resume/');
  return link;
}

async function finished(page) {
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-about-entry') &&
    !document.querySelector('.about-entry-sheet, .about-entry-mask, .about-entry-label, .about-entry-copy'));
  await readable(page);
}

async function readable(page) {
  assert.equal(new URL(page.url()).pathname, '/resume/');
  assert.equal(await page.locator('#about-title').innerText(), 'About Us');
  const state = await page.evaluate(() => {
    const elements = ['.site-header', '.about-content', '#about-title', '.about-motto',
      '.about-intro > p', '.about-details', '.about-footer'].flatMap(selector => [...document.querySelectorAll(selector)]);
    return { visible: elements.every(element => {
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility === 'visible' && Number(style.opacity) === 1;
    }), viewport: document.documentElement.clientWidth, width: document.documentElement.scrollWidth };
  });
  assert.equal(state.visible, true, 'all About content is readable after the reveal or fallback');
  assert.ok(state.width <= state.viewport + 1, 'temporary masks do not create horizontal page overflow');
  assert.equal(await page.locator('.about-actions a').count(), 2);
  assert.equal(await page.locator('.about-socials a').count(), 2);
}

test('listed, unlisted, protected, and map galleries all enter the real About page and recover on Back', { timeout: 35_000 }, async t => {
  for (const path of ['/galleries/hb-egypt/', '/galleries/nfs-unbound/', '/galleries/hb-rzstart/', '/experiments/atrium-overview/']) {
    await t.test(path, async t => {
      const { page, errors } = await session(t);
      const link = await source(page, path);
      if (path.includes('rzstart')) assert.equal(await page.locator('#gallery-access-form').isVisible(), true);
      await page.evaluate(() => {
        const observer = new MutationObserver(() => {
          const sheet = document.querySelector('.about-entry-sheet');
          if (!sheet) return;
          const rect = sheet.getBoundingClientRect();
          sessionStorage.setItem('about-test-departure', JSON.stringify({ parentIsBody: sheet.parentElement === document.body,
            path: location.pathname, left: rect.left, top: rect.top, width: rect.width, height: rect.height,
            viewportWidth: document.documentElement.clientWidth, innerWidth,
            rootWidth: document.documentElement.getBoundingClientRect().width,
            scrollbarGutter: getComputedStyle(document.documentElement).scrollbarGutter,
            viewportHeight: innerHeight }));
          observer.disconnect();
        });
        observer.observe(document.body, { childList: true, subtree: true });
      });
      await Promise.all([page.waitForURL(destination), path.includes('nfs') ? link.press('Enter') : link.click()]);
      await finished(page);
      assert.equal(await page.evaluate(key => sessionStorage.getItem(key), markerKey), null, 'arrival consumes its one-shot marker');
      const departure = await page.evaluate(() => JSON.parse(sessionStorage.getItem('about-test-departure')));
      assert.ok(departure, 'a departure cover was rendered before navigation');
      assert.equal(departure.path, path);
      assert.equal(departure.parentIsBody, true, 'the wipe stays outside transformed map/scroll containers');
      assert.equal(departure.left, 0);
      assert.equal(departure.top, 0);
      assert.ok(departure.width >= departure.viewportWidth - 1, 'cover spans the viewport: ' + JSON.stringify(departure));
      assert.equal(departure.height, departure.viewportHeight);
      await page.goBack({ waitUntil: 'domcontentloaded' });
      assert.equal(new URL(page.url()).pathname, path);
      await page.locator(linkSelector).waitFor({ state: 'visible' });
      assert.equal(await page.locator('.about-entry-sheet').count(), 0, 'Back does not restore an opaque departure cover');
      assert.deepEqual(errors, []);
    });
  }
});

test('the browser renders the diagonal wipe and two-color text masks before finishing the GSAP reveal', async t => {
  const { page, errors } = await session(t, { observe: true });
  const link = await source(page, '/galleries/hb-egypt/', true);
  await Promise.all([page.waitForURL(destination), link.click()]);
  async function capture(name, condition) {
    try {
      await page.waitForFunction(condition, undefined, { timeout: 3500 });
      await page.screenshot({ path: join(evidence, name + '.png') });
    } catch (error) {
      // Geometry assertions below remain the acceptance gate; a missed screenshot is diagnostic evidence only.
      t.diagnostic('Could not capture ' + name + ': ' + error.message.split('\n')[0]);
    }
  }
  const captures = [
    capture('01-diagonal-wipe', () => {
      const sheet = document.querySelector('.about-entry-sheet');
      const clip = sheet && getComputedStyle(sheet).clipPath;
      const values = clip?.match(/[\d.]+/g)?.map(Number);
      return values?.length >= 8 && ((values[0] > 25 && values[0] < 90) || (values[1] > 10 && values[1] < 75));
    }),
    capture('02-heading-masks', () => [...document.querySelectorAll('.about-entry-white')].some(white => {
      const heading = white.closest('.about-entry-label')?.parentElement;
      const values = getComputedStyle(white).clipPath.match(/[\d.]+/g)?.map(Number);
      return heading && getComputedStyle(heading).visibility === 'visible' &&
        values?.length === 4 && (values[1] > 10 && values[1] < 85 || values[3] > 10 && values[3] < 85);
    })),
  ];
  await Promise.all([finished(page), ...captures]);
  await page.screenshot({ path: join(evidence, '03-completed-about-page.png'), fullPage: true });
  const frames = await page.evaluate(() => window.aboutFrames);
  const sheetFrames = frames.filter(frame => frame.clip?.startsWith('polygon('));
  assert.ok(sheetFrames.length >= 4, 'the wipe was actually rendered over multiple frames');
  assert.ok(new Set(sheetFrames.map(frame => frame.clip)).size > 3, 'the computed clipping geometry moves');
  assert.ok(sheetFrames.every(frame => frame.parentIsBody));
  assert.ok(sheetFrames.every(frame => frame.width >= 1400 && frame.height === 900));
  const masks = frames.flatMap(frame => frame.masks);
  assert.ok(masks.some(mask => mask.width > 20 && mask.white > 2 && mask.white < mask.width - 2), 'a white block expands through an intermediate width');
  assert.ok(masks.some(mask => mask.width > 20 && mask.accent > 2 && mask.accent < mask.width - 2), 'an orange block moves through the reveal');
  assert.ok(new Set(masks.map(mask => mask.accentX.toFixed(1))).size > 4, 'the orange leading edge changes its rendered position');
  assert.equal(await page.locator(temporarySelector).count(), 0);
  await page.waitForFunction(() => typeof window.PortfolioDiagnostics?.report === 'function');
  const report = await page.evaluate(() => window.PortfolioDiagnostics.report().pages.at(-1));
  const tally = report.tallies['about-entry'];
  assert.equal(tally['reveal started'], 1);
  assert.equal(tally['wipe completed'], 1);
  assert.ok(tally['text reveals'] >= 1);
  assert.equal(tally['reveal completed'], 1);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await readable(page);
  assert.equal(await page.locator('html').getAttribute('data-about-entry'), null, 'reload does not replay a consumed arrival');
  assert.equal(await page.locator(temporarySelector).count(), 0);
  assert.deepEqual(errors, []);
});

test('direct, stale and wrongly addressed arrivals stay readable without an entry animation', async t => {
  for (const arrival of [undefined, { age: 11_000 }, { to: '/another-page/' }]) {
    await t.test(arrival ? JSON.stringify(arrival) : 'direct', async t => {
      const { page, errors } = await session(t, { arrival });
      await page.goto(destination, { waitUntil: 'domcontentloaded' });
      await readable(page);
      assert.equal(await page.locator('html').getAttribute('data-about-entry'), null);
      assert.equal(await page.locator(temporarySelector).count(), 0);
      assert.equal(await page.evaluate(key => sessionStorage.getItem(key), markerKey), null);
      assert.deepEqual(errors, []);
    });
  }
});

test('reduced motion, disabled storage, and disabled JavaScript preserve native About navigation', async t => {
  for (const options of [{ reducedMotion: 'reduce' }, { storageDenied: true }, { javaScriptEnabled: false }]) {
    await t.test(Object.keys(options)[0], async t => {
      const { page, errors } = await session(t, options);
      const link = await source(page, '/galleries/nfs-unbound/');
      await Promise.all([page.waitForURL(destination), link.click()]);
      await readable(page);
      assert.equal(await page.locator('html').getAttribute('data-about-entry'), null);
      assert.equal(await page.locator(temporarySelector).count(), 0);
      assert.deepEqual(errors, []);
    });
  }
});

test('modified clicks keep a native background tab and personal gallery navigation stays unchanged', async t => {
  const { page, context, errors } = await session(t);
  const link = await source(page, '/galleries/nfs-unbound/');
  const [tab] = await Promise.all([context.waitForEvent('page'), link.click({ modifiers: ['Control'] })]);
  await tab.bringToFront();
  await tab.waitForURL(destination);
  await readable(tab);
  assert.equal(await tab.locator('html').getAttribute('data-about-entry'), null);
  assert.equal(new URL(page.url()).pathname, '/galleries/nfs-unbound/');
  assert.equal(await page.evaluate(key => sessionStorage.getItem(key), markerKey), null);
  await tab.close();
  await page.goto(origin + '/artur/galleries/hb-egypt/', { waitUntil: 'domcontentloaded' });
  assert.equal(await page.locator(linkSelector).count(), 0);
  assert.equal(await page.locator('.site-nav').getByRole('link', { name: 'Resume', exact: true }).getAttribute('href'), '/artur/resume/');
  assert.equal(await page.locator('script[src*="about-entry.js"]').count(), 0);
  assert.deepEqual(errors, []);
});

test('mobile arrivals fit the viewport and an interruption releases every temporary effect', { timeout: 15_000 }, async t => {
  const requested = signal(), gate = signal();
  let arrivalRequests = 0;
  const { page, errors } = await session(t, { width: 390, height: 844, touch: true,
    intercept: async (route, url) => {
      if (!url.pathname.endsWith('/gsap.min.js') ||
          new URL(route.request().frame().url()).pathname !== '/resume/') return false;
      if (++arrivalRequests !== 2) return false;
      requested.release();
      await gate.reached;
      await route.fulfill({ path: join(site, url.pathname) });
      return true;
    },
  });
  const link = await source(page, '/galleries/hb-egypt/');
  await Promise.all([page.waitForURL(destination), link.tap()]);
  await finished(page);
  await page.goBack({ waitUntil: 'domcontentloaded' });
  const navigation = page.waitForURL(destination, { waitUntil: 'commit' });
  const tapping = page.locator(linkSelector).tap();
  tapping.catch(() => {}); // The assertion path below still awaits and checks this real gesture.
  try {
    await navigation;
    await withinFiveSeconds(requested.reached, 'the second arrival GSAP request');
    await page.locator('.about-content').waitFor({ state: 'attached' });
    assert.equal(await page.locator('html').getAttribute('data-about-entry'), 'pending', 'the second real tap creates a fresh valid arrival');
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), markerKey), null, 'the destination consumes the fresh marker');
    const revealing = page.waitForFunction(() => document.documentElement.dataset.aboutEntry === 'revealing' &&
      document.querySelector('.about-entry-sheet') && document.querySelector('.about-entry-mask'));
    gate.release();
    await revealing;
    await page.setViewportSize({ width: 844, height: 390 });
  } finally {
    gate.release();
    await tapping;
  }
  await finished(page);
  assert.deepEqual(errors, []);
});

test('a failed GSAP request falls back to a readable page', async t => {
  const { page, errors } = await session(t, { arrival: {}, intercept: async (route, url) => {
    if (!url.pathname.endsWith('/gsap.min.js')) return false;
    await route.abort('failed');
    return true;
  } });
  await page.goto(destination, { waitUntil: 'domcontentloaded' });
  await finished(page);
  assert.deepEqual(errors, []);
});

test('the arrival watchdog releases a stalled dependency and a late load does not hide the page again', { timeout: 12_000 }, async t => {
  const requested = signal(), gate = signal();
  const { page, errors } = await session(t, { arrival: {}, intercept: async (route, url) => {
    if (!url.pathname.endsWith('/gsap.min.js')) return false;
    requested.release();
    await gate.reached;
    await route.fulfill({ path: join(site, url.pathname) });
    return true;
  } });
  await page.goto(destination, { waitUntil: 'commit' });
  await requested.reached;
  await page.locator('.about-content').waitFor({ state: 'attached' });
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-about-entry'));
  await readable(page);
  gate.release();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(150);
  await finished(page);
  assert.deepEqual(errors, []);
});

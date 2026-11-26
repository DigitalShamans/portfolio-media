'use strict';

const assert = require('node:assert/strict');
const { existsSync, readFileSync, statSync } = require('node:fs');
const { createServer } = require('node:http');
const { join, resolve, sep } = require('node:path');
const { after, before, test } = require('node:test');
const { chromium } = require('playwright');

const root = resolve(__dirname, '../..');
const site = join(root, '_site');
const cardsSelector = '#full-portfolio .portfolio-card';
const layerSelector = '.portfolio-tile-preview';
const image = Buffer.from('UklGRjAAAABXRUJQVlA4ICQAAABQAQCdASoQAAkAAUAmJQBOgCgAAP7nMP6+8odiZDdJ+p/KAAA=', 'base64');
const galleryDestination = '<!doctype html><title>Gallery destination</title><h1>Gallery destination</h1>';
let browser, server, origin;

before(async () => {
  assert.ok(existsSync(join(site, 'index.html')), 'Build _site with the shared validation action before running browser checks.');
  // Chromium may start a native background tab before Playwright can route its first request.
  server = createServer((request, response) => {
    if (/^\/(?:artur\/)?galleries\//.test(request.url)) {
      response.writeHead(200, { 'content-type': 'text/html' }).end(galleryDestination);
    } else {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

function signal() {
  let release;
  const reached = new Promise(resolve => { release = resolve; });
  return { reached, release };
}

async function openHome(t, {
  home = '/', width = 1440, height = 900, diagnostics = false,
  reducedMotion = 'no-preference', touch = false, intercept,
} = {}) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, reducedMotion });
  context.setDefaultTimeout(5000);
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const requests = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    requests.push(url.href);
    if (intercept && await intercept(route, url)) return;
    if (/\.(?:webp|jpe?g|png|gif)$/i.test(url.pathname)) {
      return route.fulfill({ contentType: 'image/webp', body: image });
    }
    if (url.origin !== origin) return route.fulfill({ status: 404 });
    // Keep genuine link navigation without loading an unrelated gallery viewer.
    if (/^\/(?:artur\/)?galleries\//.test(url.pathname) && route.request().isNavigationRequest()) {
      return route.fulfill({ contentType: 'text/html', body: galleryDestination });
    }
    let file = resolve(site, '.' + decodeURIComponent(url.pathname));
    if (file !== site && !file.startsWith(site + sep)) return route.fulfill({ status: 404 });
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file) || !statSync(file).isFile()) return route.fulfill({ status: 404 });
    return route.fulfill({ path: file });
  });
  await page.goto(origin + home + (diagnostics ? '?diagnostics=1' : ''), { waitUntil: 'load' });
  return { page, context, requests, errors };
}

async function revealCard(page, index = 0) {
  const card = page.locator(cardsSelector).nth(index);
  await card.scrollIntoViewIfNeeded();
  await card.evaluate(card => {
    const header = document.querySelector('.site-header').getBoundingClientRect();
    const rect = card.getBoundingClientRect();
    if (rect.top < header.bottom + 20) {
      window.scrollBy({ top: rect.top - header.bottom - 20, behavior: 'instant' });
    }
  });
  // Let ScrollTrigger's deferred batch start before checking its final state.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForFunction(index => {
    const item = document.querySelectorAll('#full-portfolio .portfolio-card')[index].parentElement;
    const style = getComputedStyle(item);
    const tweens = window.gsap?.getTweensOf(item) || [];
    return Number(style.opacity) === 1 && style.transform === 'none' &&
      tweens.every(tween => tween.totalProgress() === 1);
  }, index);
  return card;
}

async function moveInto(page, card) {
  const rect = await card.boundingBox();
  assert.ok(rect);
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  return rect;
}

async function settled(page) {
  await page.locator(layerSelector + '.is-open').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const layer = document.querySelector('.portfolio-tile-preview');
    return layer?.classList.contains('is-open') &&
      !layer.getAnimations().some(animation => animation.playState === 'running' || animation.pending);
  });
}

async function closePreview(page) {
  await page.mouse.move(2, 2);
  await page.locator(layerSelector).waitFor({ state: 'hidden' });
}

async function assertFrame(page) {
  const frame = await page.locator(layerSelector).evaluate(layer => {
    const rect = layer.getBoundingClientRect();
    return { width: rect.width, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right,
      viewportWidth: innerWidth, viewportHeight: innerHeight,
      headerBottom: document.querySelector('.site-header').getBoundingClientRect().bottom,
      parentIsBody: layer.parentElement === document.body,
      pointerEvents: getComputedStyle(layer).pointerEvents,
      objectFit: getComputedStyle(layer.querySelector('img')).objectFit,
      duration: getComputedStyle(layer).transitionDuration,
      easing: getComputedStyle(layer).transitionTimingFunction,
      hiddenFromAT: layer.getAttribute('aria-hidden'), inert: layer.inert };
  });
  assert.ok(Math.abs(frame.width - frame.viewportWidth * .6) < 1.5, 'preview frame occupies 60% of the viewport width');
  assert.ok(frame.left >= 15 && frame.right <= frame.viewportWidth - 15);
  assert.ok(frame.top >= frame.headerBottom + 15 && frame.bottom <= frame.viewportHeight - 15, 'preview stays below the header and within the viewport');
  assert.equal(frame.parentIsBody, true, 'the preview does not inherit grid reveal transforms or clipping');
  assert.equal(frame.pointerEvents, 'none');
  assert.equal(frame.objectFit, 'contain');
  assert.equal(frame.hiddenFromAT, 'true');
  assert.equal(frame.inert, true);
  return frame;
}

test('both built homepages preview the first manifest image of all 26 Full Portfolio cards', async t => {
  const versions = JSON.parse(readFileSync(join(root, '_data/gallery_asset_versions.json'), 'utf8'));
  let checked = 0;
  for (const home of ['/', '/artur/']) {
    const { page, errors } = await openHome(t, { home });
    const entries = await page.locator(cardsSelector).evaluateAll(cards => cards.map(card => ({
      href: card.href, preview: card.dataset.galleryPreview, cover: card.querySelector('img').src,
    })));
    assert.equal(entries.length, 13);
    const webpRevision = await page.locator('html').getAttribute('data-gallery-webp-revision');
    for (const entry of entries) {
      const route = new URL(entry.href);
      const folder = /^\/(?:artur\/)?galleries\/([^/]+)\/$/.exec(route.pathname)?.[1];
      assert.ok(folder, entry.href);
      const manifest = JSON.parse(readFileSync(join(root, 'galleries', folder, 'gallery.json'), 'utf8'));
      const first = typeof manifest[0] === 'string' ? manifest[0] : manifest[0].image;
      assert.ok(entry.preview, entry.href + ' has a first-image preview');
      const preview = new URL(entry.preview, origin);
      const expectedPath = '/galleries/' + folder + '/1440p/' + first.replace(/\.[^.]+$/, '.webp');
      assert.equal(preview.origin, origin);
      assert.equal(decodeURIComponent(preview.pathname), expectedPath);
      assert.equal(preview.searchParams.get('v'), versions[folder][first]);
      assert.equal(preview.searchParams.get('webp'), webpRevision);
      assert.ok(existsSync(join(site, expectedPath)), expectedPath + ' is present after publication pruning');
      assert.notEqual(preview.href, entry.cover, 'the screenshot is distinct from the square cover');
      checked++;
    }
    assert.equal(await page.locator('.recent-gallery[data-gallery-preview]').count(), 0, 'Recent Work banners keep their current behavior, including password-protected galleries');
    assert.deepEqual(errors, []);
  }
  assert.equal(checked, 26);
});

test('Battlezone hover uses the current published replacement on both portfolios', { timeout: 25_000 }, async t => {
  const folder = 'battlezone-vr';
  const first = JSON.parse(readFileSync(join(root, 'galleries', folder, 'gallery.json'), 'utf8'))[0].image;
  const revision = 'a'.repeat(40);
  const indexPath = '/public-replacements/' + folder + '.json';
  const replacementPath = '/public-replacements/' + folder + '/' + revision + '/1440p/' + first;

  for (const [home, unavailable] of [['/', false], ['/artur/', false], ['/artur/', true]]) {
    await t.test(home + (unavailable ? ' fallback' : ''), async t => {
      const { page, errors, requests } = await openHome(t, { home, intercept: async (route, url) => {
        if (url.pathname === indexPath) {
          await route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { images: { [first]: revision } } });
          return true;
        }
        if (url.pathname === replacementPath && unavailable) {
          await route.fulfill({ status: 503 });
          return true;
        }
        return false;
      } });
      const position = await page.locator(cardsSelector).evaluateAll(cards =>
        cards.findIndex(card => card.href.endsWith('/galleries/battlezone-vr/')));
      assert.ok(position >= 0);
      const card = await revealCard(page, position);
      const fallback = new URL(await card.getAttribute('data-gallery-preview'), origin);
      await moveInto(page, card);
      await settled(page);
      const shown = new URL(await page.locator(layerSelector + ' img').evaluate(image => image.currentSrc));
      assert.equal(shown.pathname, unavailable ? fallback.pathname : replacementPath);
      assert.equal(requests.filter(url => new URL(url).pathname === indexPath).length, 1);
      if (!unavailable) assert.ok(!requests.includes(fallback.href), 'the older Pages copy was not requested');
      assert.deepEqual(errors, []);
    });
  }
});

test('both homepages dwell before a real CSS expansion, restore the tile view, and retain link navigation', { timeout: 25_000 }, async t => {
  for (const home of ['/', '/artur/']) {
    await t.test(home, async t => {
      const { page, errors } = await openHome(t, { home, diagnostics: true });
      const card = await revealCard(page);
      const previewURL = new URL(await card.getAttribute('data-gallery-preview'), origin).href;
      await card.evaluate(card => {
        window.previewTiming = { opened: [] };
        card.addEventListener('pointerenter', () => { window.previewTiming.entered = performance.now(); });
        const layer = document.querySelector('.portfolio-tile-preview');
        new MutationObserver(() => {
          if (layer.classList.contains('is-open')) window.previewTiming.opened.push(performance.now() - window.previewTiming.entered);
        }).observe(layer, { attributes: true, attributeFilter: ['class'] });
      });
      await moveInto(page, card);
      await page.waitForTimeout(180);
      await page.mouse.move(2, 2);
      await page.waitForTimeout(300);
      assert.equal(await page.locator(layerSelector).isVisible(), false, 'leaving before the dwell cancels opening');
      assert.deepEqual(await page.evaluate(() => window.previewTiming.opened), []);

      await page.evaluate(() => {
        window.previewWidths = { active: true, samples: [] };
        function sample() {
          const layer = document.querySelector('.portfolio-tile-preview');
          if (!layer.hidden) window.previewWidths.samples.push(layer.getBoundingClientRect().width);
          if (window.previewWidths.active) requestAnimationFrame(sample);
        }
        sample();
      });
      const thumbnail = await moveInto(page, card);
      const position = await page.evaluate(() => scrollY);
      await settled(page);
      assert.equal(await page.locator(layerSelector + ' img').evaluate(image => image.currentSrc), previewURL);
      const timing = await page.evaluate(() => window.previewTiming.opened);
      assert.equal(timing.length, 1);
      assert.ok(timing[0] >= 390, 'opening respects the 400 ms hover dwell');
      const frame = await assertFrame(page);
      assert.ok(frame.duration.split(', ').every(duration => duration === '0.28s'));
      assert.ok(frame.easing.replace(/\s/g, '').includes('cubic-bezier(0.2,0.75,0.25,1)'));
      assert.equal(await page.evaluate(() => scrollY), position, 'previewing never scrolls the homepage');
      const unchanged = await card.boundingBox();
      for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(unchanged[key] - thumbnail[key]) < 1, key + ' remains in the grid');
      await closePreview(page);
      const widths = await page.evaluate(() => { window.previewWidths.active = false; return window.previewWidths.samples; });
      assert.ok(widths.filter(width => width > thumbnail.width + 3 && width < frame.width - 3).length >= 2, 'the browser renders intermediate CSS sizes');
      const report = await page.evaluate(() => window.PortfolioDiagnostics.report().pages.at(-1));
      const counts = report.tallies['portfolio-preview'];
      assert.equal(report.features['portfolio-preview'].mode, 'CSS hover previews');
      assert.equal(counts['CSS enlargements'], 1);
      assert.equal(counts['CSS shrinks'], 1);
      assert.equal(counts['CSS completed'], 2);
      assert.ok(report.motion['portfolio-preview'].advances > 1);
      await page.getByText('Diagnostics', { exact: true }).click();
      await page.getByText('Portfolio tile previews', { exact: true }).waitFor();
      const row = await page.getByText('Portfolio tile previews', { exact: true }).evaluate(title => title.nextElementSibling.textContent);
      assert.match(row, /CSS hover previews/);
      assert.match(row, /CSS completed 2/);
      await page.getByText('Diagnostics', { exact: true }).click();

      await moveInto(page, card);
      await settled(page);
      const destination = await card.getAttribute('href');
      await Promise.all([page.waitForURL(new URL(destination, origin).href), card.click()]);
      assert.deepEqual(errors, []);
    });
  }
});

test('slow or failed gallery images cannot replace a newer preview or trap a link', { timeout: 15_000 }, async t => {
  const releaseFirst = signal(), firstRequested = signal();
  t.after(releaseFirst.release);
  let firstURL, failedURL;
  const { page, errors } = await openHome(t, { intercept: async (route, url) => {
    if (url.href === firstURL) {
      firstRequested.release();
      await releaseFirst.reached;
      await route.fulfill({ contentType: 'image/webp', body: image });
      return true;
    }
    if (url.href === failedURL) {
      await route.fulfill({ status: 404 });
      return true;
    }
    return false;
  } });
  const first = await revealCard(page, 0), second = page.locator(cardsSelector).nth(1), failed = page.locator(cardsSelector).nth(2);
  firstURL = new URL(await first.getAttribute('data-gallery-preview'), origin).href;
  failedURL = new URL(await failed.getAttribute('data-gallery-preview'), origin).href;
  await moveInto(page, first);
  await firstRequested.reached;
  await page.waitForTimeout(450);
  assert.equal(await page.locator(layerSelector).isVisible(), false, 'the dwell alone cannot show an unloaded image');
  await moveInto(page, second);
  await settled(page);
  const secondURL = new URL(await second.getAttribute('data-gallery-preview'), origin).href;
  assert.equal(await page.locator(layerSelector + ' img').evaluate(image => image.currentSrc), secondURL);
  releaseFirst.release();
  await page.waitForTimeout(100);
  assert.equal(await page.locator(layerSelector + ' img').evaluate(image => image.currentSrc), secondURL, 'late decode cannot overwrite the current gallery');
  assert.equal(await page.locator(layerSelector).count(), 1);
  await closePreview(page);
  await moveInto(page, failed);
  await page.waitForTimeout(500);
  assert.equal(await page.locator(layerSelector).isVisible(), false, 'a failed preview does not show a logo or an empty enlarged panel');
  await Promise.all([page.waitForURL(new URL(await failed.getAttribute('href'), origin).href), failed.click()]);
  assert.deepEqual(errors, []);
});

test('touch tiles navigate directly without loading hover screenshots', async t => {
  const { page, requests, errors } = await openHome(t, { home: '/artur/', width: 390, touch: true, diagnostics: true });
  const card = await revealCard(page);
  const previewURL = new URL(await card.getAttribute('data-gallery-preview'), origin).href;
  assert.equal(await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches), false);
  await moveInto(page, card);
  await page.waitForTimeout(450);
  assert.equal(await page.locator(layerSelector).isVisible(), false);
  assert.ok(!requests.includes(previewURL));
  const report = await page.evaluate(() => window.PortfolioDiagnostics.report().pages.at(-1));
  assert.equal(report.features['portfolio-preview'].mode, 'Hover previews unavailable');
  const href = new URL(await card.getAttribute('href'), origin).href;
  await Promise.all([page.waitForURL(href), card.tap()]);
  assert.deepEqual(errors, []);
});

test('reduced motion keeps the dwell and native keyboard and modified-click navigation', async t => {
  const { page, context, errors } = await openHome(t, { reducedMotion: 'reduce', diagnostics: true });
  const card = await revealCard(page);
  await moveInto(page, card);
  await page.waitForTimeout(180);
  assert.equal(await page.locator(layerSelector).isVisible(), false);
  await settled(page);
  const frame = await assertFrame(page);
  assert.equal(frame.duration, '0s');
  await closePreview(page);
  const report = await page.evaluate(() => window.PortfolioDiagnostics.report().pages.at(-1));
  assert.equal(report.features['portfolio-preview'].mode, 'Reduced motion');
  assert.equal(report.tallies['portfolio-preview']['instant changes'], 2);
  assert.equal(report.motion['portfolio-preview'], undefined);
  const destination = new URL(await card.getAttribute('href'), origin).href;
  const navigationEvents = [];
  context.on('request', request => {
    if (request.isNavigationRequest()) navigationEvents.push({ event: 'request', url: request.url() });
  });
  context.on('requestfailed', request => {
    if (request.isNavigationRequest()) navigationEvents.push({ event: 'failed', url: request.url(), error: request.failure()?.errorText });
  });
  context.on('response', response => {
    if (response.request().isNavigationRequest()) navigationEvents.push({ event: 'response', url: response.url(), status: response.status() });
  });
  // A modified anchor click can open a background tab without an opener popup event.
  const [newTab] = await Promise.all([context.waitForEvent('page'), card.click({ modifiers: ['Control'] })]);
  const createdURL = newTab.url();
  try {
    await newTab.bringToFront();
    await newTab.waitForURL(destination, { timeout: 5000 });
  } catch (error) {
    t.diagnostic(JSON.stringify({ destination, createdURL, tabURLs: context.pages().map(page => page.url()), navigationEvents }));
    throw error;
  }
  assert.equal(new URL(page.url()).pathname, '/');
  await newTab.close();
  await Promise.all([page.waitForURL(destination), card.press('Enter')]);
  assert.deepEqual(errors, []);
});

test('tall first images stay within a short viewport and cancellation removes the preview', { timeout: 15_000 }, async t => {
  let portraitURL;
  const { page, errors } = await openHome(t, { width: 1000, height: 500, intercept: async (route, url) => {
    if (url.href !== portraitURL) return false;
    await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="900"><rect width="300" height="900" fill="#678"/></svg>' });
    return true;
  } });
  const card = await revealCard(page);
  portraitURL = new URL(await card.getAttribute('data-gallery-preview'), origin).href;
  await moveInto(page, card);
  await settled(page);
  await assertFrame(page);
  assert.equal(await page.locator(layerSelector + ' img').evaluate(image => image.naturalHeight / image.naturalWidth), 3);
  await page.keyboard.press('Escape');
  await page.locator(layerSelector).waitFor({ state: 'hidden' });
  await page.mouse.move(2, 2);
  await moveInto(page, card);
  await settled(page);
  await page.mouse.wheel(0, 40);
  await page.locator(layerSelector).waitFor({ state: 'hidden' });
  await page.mouse.move(2, 2);
  await revealCard(page);
  await moveInto(page, card);
  await settled(page);
  await page.setViewportSize({ width: 1100, height: 550 });
  await page.locator(layerSelector).waitFor({ state: 'hidden' });
  assert.deepEqual(errors, []);
});

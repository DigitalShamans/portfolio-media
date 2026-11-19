'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { after, before, test } = require('node:test');
const { chromium } = require('playwright');

const root = resolve(__dirname, '../..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const galleryLayout = read('_layouts/gallery.html');
const lockedLayout = read('_layouts/locked-gallery.html');
const portfolio = 'http://localhost:3000';
const media = 'https://media.example.test';
const revision = 'a'.repeat(40);
const gallery = '/galleries/hb-egypt/';
const locked = '/galleries/hb-rzstart/';
const desktopQuery = '(min-width: 2560px) and (hover: hover) and (pointer: fine)';
const manifest = [
  { image: 'First.jpg', compare: 'First_Checker.jpg', additionalImages: ['First_Wireframe.jpg'] },
  { image: 'Second.jpg' },
  { image: 'Third.jpg' },
];
const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAJABADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKgAJT//2Q==', 'base64');
const webp = Buffer.from('UklGRjAAAABXRUJQVlA4ICQAAABQAQCdASoQAAkAAUAmJQBOgCgAAP7nMP6+8odiZDdJ+p/KAAA=', 'base64');
const originals = name => `${media}/public-media/${revision}/hb-egypt/${name}.jpg`;
const preview = name => `${portfolio}${gallery}1440p/${name}.webp?v=test&webp=q92-m6`;

let browser;
before(async () => {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
});
after(() => browser?.close());

function scripts(layout) {
  return layout.slice(layout.indexOf('  <script src='), layout.indexOf('</body>'))
    .replace("{{ '/assets/gallery-resolution.js' | relative_url }}", '/assets/gallery-resolution.js');
}

function pageHtml(path, { embeds, assetVersions = {} } = {}) {
  const isLocked = path.endsWith(locked);
  const settings = isLocked ? '' : `data-gallery-webp-revision="q92-m6"
    data-gallery-originals-origin="${media}" data-gallery-originals-revision="${revision}"`;
  const base = path.startsWith('/artur/') ? `<base href="${isLocked ? locked : gallery}">` : '';
  const body = isLocked
    ? lockedLayout.slice(lockedLayout.indexOf('  <main id="gallery-access"'), lockedLayout.indexOf('  <script src='))
      .replace('{{ portfolio_url | relative_url }}', '/') + scripts(lockedLayout)
      .replace('{{ site.data.gallery_delivery.service_origin | jsonify }}', JSON.stringify(media))
    : `<div class="gallery-content"><header class="intro"><h1>Hard Bullet - Egypt</h1></header>
        <p id="gallery-status" hidden></p>
        <section class="gallery"${embeds ? ' data-gallery-embeds="gallery-embeds.json"' : ''}>${galleryLayout.match(/<a class="shot" data-gallery-fallback[\s\S]*?<\/a>/)[0]
          .replace('{{ gallery_original_url | escape }}', `${gallery}First.jpg?v=test`)
          .replaceAll('{{ reduced_image_url }}', preview('First').replace('&', '&amp;'))
          .replace('{{ site.gallery_4k_media | escape }}', desktopQuery)
          .replace('{{ first_image_url | escape }}', originals('First'))
          .replaceAll('{{ gallery_page.gallery_title | escape }}', 'Hard Bullet - Egypt')}</section></div>
        ${galleryLayout.match(/<dialog id="viewer"[\s\S]*?<\/dialog>/)[0]}${scripts(galleryLayout)}`;
  return `<!doctype html><html data-gallery4k-media="${desktopQuery}" ${settings}>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${base}
    <link rel="stylesheet" href="/galleries/gallery.css">
    <link rel="stylesheet" href="/galleries/gallery-embeds.css"></head>
    <body data-gallery-revision="test" data-gallery-asset-versions="${JSON.stringify(assetVersions).replaceAll('"', '&quot;')}">${body}</body></html>`;
}

function signal() {
  let release;
  const reached = new Promise(resolve => { release = resolve; });
  return { reached, release };
}

async function openPage(t, { route = gallery, width = 2800, intercept, embeds, assetVersions } = {}) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  t.after(() => page.close());
  page.setDefaultTimeout(5000);
  const requests = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async request => {
    const url = new URL(request.request().url());
    requests.push(url.href);
    if (intercept && await intercept(request, url)) return;
    if (url.pathname === route) return request.fulfill({ contentType: 'text/html', body: pageHtml(route, { embeds, assetVersions }) });
    if (url.pathname === `${gallery}gallery.json` || url.pathname === '/media/gallery.json') {
      return request.fulfill({ json: manifest });
    }
    if (embeds && url.pathname === `${gallery}gallery-embeds.json`) return request.fulfill({ json: embeds });
    if (url.pathname.endsWith('.webp')) return request.fulfill({ contentType: 'image/webp', body: webp });
    if (url.pathname.endsWith('.jpg')) {
      return request.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, contentType: 'image/jpeg', body: jpeg });
    }
    if (url.origin === portfolio && /\.(?:js|css)$/.test(url.pathname)) {
      return request.fulfill({ path: resolve(root, url.pathname.slice(1)) });
    }
    return request.fulfill({ status: 404 });
  });
  await page.goto(portfolio + route, { waitUntil: 'domcontentloaded' });
  return { page, requests, errors };
}

async function displayed(page, selector, source) {
  await page.waitForFunction(({ selector, source }) => {
    const image = document.querySelector(selector);
    return image?.complete && image.naturalWidth > 0 && image.currentSrc === source;
  }, { selector, source });
}

function segment(page, variant) {
  return page.locator('#viewer .comparison-indicator button').nth(variant);
}

async function activeSegment(page, variant) {
  await segment(page, variant).waitFor({ state: 'visible' });
  assert.equal(await segment(page, variant).getAttribute('aria-pressed'), 'true');
}

function onceEach(requests, ...urls) {
  for (const url of urls) assert.equal(requests.filter(request => request === url).length, 1, url);
}

function expectFallback(requests, name) {
  const original = originals(name);
  const webp = preview(name);
  assert.deepEqual(requests.filter(url => url === original || url === webp), [original, original, webp]);
}

test('local MP4 uses asset versions, native controls and fullscreen on both gallery routes', async t => {
  const file = 'shooting-challenge.mp4';
  const embeds = [{ type: 'video', file, title: 'Shooting challenge', after: 'First_Checker.jpg', before: 'Second.jpg' }];
  for (const route of [gallery, '/artur' + gallery]) {
    for (const width of [1000, 2800]) {
      await t.test(`${route} at ${width}px`, async t => {
        const { page, requests, errors } = await openPage(t, {
          route, width, embeds,
          assetVersions: { 'gallery-embeds.json': 'manifest-blob', [file]: 'mp4-blob' },
        });
        const video = page.locator('.gallery-embed video');
        await video.waitFor();
        assert.equal(await page.locator('.gallery > :nth-child(2) video').count(), 1);
        const properties = await video.evaluate(video => ({
          src: video.src, controls: video.controls, inline: video.playsInline, preload: video.preload,
          autoplay: video.autoplay, loop: video.loop, title: video.title,
          noFullscreen: video.controlsList.contains('nofullscreen'),
          ratio: video.getBoundingClientRect().width / video.getBoundingClientRect().height,
          fits: video.getBoundingClientRect().width <= document.documentElement.clientWidth,
        }));
        assert.deepEqual(properties, {
          src: `${portfolio}${gallery}${file}?v=mp4-blob`, controls: true, inline: true, preload: 'metadata',
          autoplay: false, loop: false, title: 'Shooting challenge', noFullscreen: false,
          ratio: properties.ratio, fits: true,
        });
        assert.ok(Math.abs(properties.ratio - 16 / 9) < 0.01);
        assert.ok(requests.includes(`${portfolio}${gallery}gallery-embeds.json?v=manifest-blob`));
        // A failed MP4 request stays local to the native player and preserves every image.
        await page.waitForFunction(() => document.querySelector('video')?.error);
        assert.equal(await page.locator('.shot').count(), manifest.length);
        await video.evaluate(video => video.requestFullscreen());
        assert.equal(await video.evaluate(video => document.fullscreenElement === video), true);
        await page.evaluate(() => document.exitFullscreen());
        await page.locator('.shot').first().press('Enter');
        await displayed(page, '#original', (width === 2800 ? originals : preview)('First'));
        assert.equal(await page.locator('#counter').textContent(), '1 / 3');
        assert.deepEqual(errors, []);
      });
    }
  }
});

test('invalid local video metadata keeps the loaded image gallery usable', async t => {
  const { page, errors } = await openPage(t, {
    embeds: [{ type: 'video', file: '../private.mp4', title: 'Invalid video', after: 'First.jpg' }],
  });
  await page.locator('.gallery-embed-error').waitFor();
  assert.equal(await page.locator('.gallery-embed').count(), 0);
  assert.equal(await page.locator('.shot').count(), manifest.length);
  await page.locator('.shot').first().press('Enter');
  await displayed(page, '#original', originals('First'));
  assert.deepEqual(errors, []);
});

test('healthy 4K stays in 4K, and 1440p viewports go directly to WebP', async t => {
  for (const width of [2800, 1000]) {
    await t.test(`viewport ${width}px`, async t => {
      const { page, requests, errors } = await openPage(t, { width });
      const source = width === 2800 ? originals : preview;
      const unused = width === 2800 ? preview : originals;
      await page.locator('.shot').first().press('Enter');
      await displayed(page, '#original', source('First'));
      await segment(page, 2).press('Enter');
      await displayed(page, '#original', source('First_Wireframe'));
      await activeSegment(page, 2);
      onceEach(requests, source('First'), source('First_Wireframe'));
      assert.ok(!requests.includes(unused('First')) && !requests.includes(unused('First_Wireframe')));
      assert.deepEqual(errors, []);
    });
  }
});

test('a temporary 4K failure retries the same JPG after a second and keeps 4K on success', async t => {
  let failedAt;
  let retryAt;
  const { page, requests, errors } = await openPage(t, {
    intercept: async (request, url) => {
      if (url.href !== originals('First')) return false;
      if (failedAt === undefined) {
        failedAt = performance.now();
        await request.fulfill({ status: 503 });
        return true;
      }
      retryAt = performance.now();
      return false;
    },
  });
  await page.locator('.shot').first().press('Enter');
  await page.waitForFunction(() => {
    const image = document.querySelector('#original');
    return image.complete && image.naturalWidth > 0 && image.currentSrc.startsWith('blob:') &&
      image.currentSrc === document.querySelector('.shot-primary').currentSrc;
  });
  assert.ok(retryAt - failedAt >= 990, 'The second JPG request starts after the one-second delay');
  assert.equal(requests.filter(url => url === originals('First')).length, 2);
  assert.ok(!requests.includes(preview('First')));
  assert.equal(await page.locator('.shot').first().getAttribute('href'), originals('First'));
  assert.deepEqual(errors, []);
});

test('both routes recover when the 4K service is unreachable before the viewer starts', async t => {
  for (const route of [gallery, '/artur' + gallery]) {
    await t.test(route, async t => {
      const firstFailed = signal();
      const { page, requests, errors } = await openPage(t, {
        route,
        intercept: async (request, url) => {
          if (url.origin === media) {
            await request.abort('connectionrefused');
            if (url.href === originals('First')) firstFailed.release();
            return true;
          }
          if (url.pathname === '/galleries/gallery-viewer.js') {
            await firstFailed.reached;
          }
          return false;
        },
      });
      await displayed(page, '.shot-primary', preview('First'));
      assert.equal(await page.locator('.shot').first().getAttribute('href'), originals('First'));
      await page.locator('.shot').first().press('Enter');
      await displayed(page, '#original', preview('First'));
      await activeSegment(page, 0);
      assert.equal(await page.locator('#status').isHidden(), true);
      expectFallback(requests, 'First');
      assert.deepEqual(errors, []);
    });
  }
});

test('navigation holds the visible image and ignores late fallback from a previous shot', { timeout: 12_000 }, async t => {
  const failOriginal = signal();
  const releasePreview = signal();
  const previewStarted = signal();
  t.after(() => { failOriginal.release(); releasePreview.release(); });
  const { page, requests, errors } = await openPage(t, {
    intercept: async (request, url) => {
      if (url.href === originals('Second')) {
        await failOriginal.reached;
        await request.fulfill({ status: 503 });
        return true;
      }
      if (url.href === preview('Second')) {
        previewStarted.release();
        await releasePreview.reached;
      }
      return false;
    },
  });
  await page.locator('.shot').first().press('Enter');
  await displayed(page, '#original', originals('First'));
  await page.locator('#next-side').press('Enter');
  assert.equal(await page.locator('#counter').textContent(), '2 / 3');
  assert.equal(await page.locator('#status').textContent(), 'Loading image…');
  await displayed(page, '#original', originals('First'));
  failOriginal.release();
  await previewStarted.reached;
  await page.locator('#next-side').press('Enter');
  await displayed(page, '#original', originals('Third'));
  releasePreview.release();
  await displayed(page, '.shot:nth-child(2) .shot-primary', preview('Second'));
  assert.equal(await page.locator('#original').evaluate(image => image.currentSrc), originals('Third'));
  await page.locator('#previous-side').press('Enter');
  await displayed(page, '#original', preview('Second'));
  assert.equal(await page.locator('#status').isHidden(), true);
  expectFallback(requests, 'Second');
  onceEach(requests, originals('Third'));
  assert.deepEqual(errors, []);
});

test('a late Checker fallback cannot replace the selected Wireframe', { timeout: 12_000 }, async t => {
  const releaseChecker = signal();
  const checkerStarted = signal();
  t.after(releaseChecker.release);
  const { page, requests, errors } = await openPage(t, {
    intercept: async (request, url) => {
      if (url.href === originals('First_Checker')) {
        await request.fulfill({ status: 503 });
        return true;
      }
      if (url.href === originals('First_Wireframe')) {
        await request.fulfill({
          headers: { 'Access-Control-Allow-Origin': '*' },
          contentType: 'image/jpeg',
          body: 'invalid JPEG',
        });
        return true;
      }
      if (url.href === preview('First_Checker')) {
        checkerStarted.release();
        await releaseChecker.reached;
      }
      return false;
    },
  });
  const tileButton = page.locator('.shot-entry .comparison-indicator button').nth(2);
  await tileButton.press('Enter');
  await displayed(page, '.shot-comparison.is-visible', preview('First_Wireframe'));
  assert.equal(await tileButton.getAttribute('aria-pressed'), 'true');
  await page.locator('.shot').first().press('Enter');
  await displayed(page, '#original', preview('First_Wireframe'));
  await activeSegment(page, 2);
  await segment(page, 0).press('Enter');
  await displayed(page, '#original', originals('First'));
  await segment(page, 1).press('Enter');
  await checkerStarted.reached;
  await activeSegment(page, 0);
  await segment(page, 2).press('Enter');
  await displayed(page, '#original', preview('First_Wireframe'));
  await activeSegment(page, 2);
  releaseChecker.release();
  await displayed(page, '.shot-comparison[src*="Checker"]', preview('First_Checker'));
  await displayed(page, '#original', preview('First_Wireframe'));
  await activeSegment(page, 2);
  await segment(page, 1).press('Enter');
  await displayed(page, '#original', preview('First_Checker'));
  await activeSegment(page, 1);
  await segment(page, 2).press('Enter');
  await displayed(page, '#original', preview('First_Wireframe'));
  await activeSegment(page, 2);
  expectFallback(requests, 'First_Checker');
  expectFallback(requests, 'First_Wireframe');
  assert.deepEqual(errors, []);
});

test('two 4K failures and one WebP failure show an error without restarting the requests', async t => {
  const { page, requests, errors } = await openPage(t, {
    intercept: async (request, url) => {
      if (![originals('Second'), preview('Second'), originals('First_Checker'),
        preview('First_Checker')].includes(url.href)) return false;
      await request.fulfill({ status: 503 });
      return true;
    },
  });
  await page.locator('.shot').first().press('Enter');
  await displayed(page, '#original', originals('First'));
  await segment(page, 1).press('Enter');
  await segment(page, 0).press('Enter');
  await segment(page, 1).press('Enter');
  await activeSegment(page, 0);
  await page.locator('#next-side').press('Enter');
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'This image could not be loaded.');
  await displayed(page, '#original', originals('First'));
  await page.locator('#previous-side').press('Enter');
  await page.locator('#next-side').press('Enter');
  // Leave enough time to detect an extra retry after the terminal failure.
  await page.waitForTimeout(1100);
  expectFallback(requests, 'Second');
  expectFallback(requests, 'First_Checker');
  assert.deepEqual(errors, []);
});

test('RZ Start stays behind password and bearer-token delivery', async t => {
  const protectedRequests = [];
  let primaryAttempts = 0;
  const { page, requests, errors } = await openPage(t, {
    route: '/artur' + locked,
    intercept: async (request, url) => {
      if (url.pathname === '/unlock') {
        const { password } = request.request().postDataJSON();
        await request.fulfill(password === 'fixture-password'
          ? { json: { token: 'fixture-token', expiresAt: Date.now() + 60_000 } }
          : { status: 401 });
        return true;
      }
      if (url.pathname.startsWith('/media/')) protectedRequests.push(request.request().headers().authorization);
      if (url.pathname === '/media/First.jpg' && ++primaryAttempts === 1) {
        await request.fulfill({ status: 503 });
        return true;
      }
      return false;
    },
  });
  await page.locator('#gallery-password').fill('incorrect');
  await page.locator('button[type="submit"]').press('Enter');
  await page.waitForFunction(() => document.querySelector('#access-message').textContent === 'Incorrect password.');
  assert.deepEqual(protectedRequests, []);
  assert.equal(await page.locator('.shot').count(), 0);
  await page.locator('#gallery-password').fill('fixture-password');
  await page.locator('button[type="submit"]').press('Enter');
  await page.locator('.shot').first().press('Enter');
  await page.waitForFunction(() => {
    const image = document.querySelector('#original');
    return image?.complete && image.naturalWidth > 0 && image.currentSrc.startsWith('blob:');
  });
  assert.equal(primaryAttempts, 2);
  assert.ok(protectedRequests.length >= 2 && protectedRequests.every(token => token === 'Bearer fixture-token'));
  assert.ok(!requests.some(url => url.includes('/public-media/') || url.includes('/1440p/')));
  assert.deepEqual(errors, []);
});

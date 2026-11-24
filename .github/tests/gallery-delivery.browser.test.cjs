'use strict';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const { readFileSync } = require('node:fs');
const { createServer } = require('node:http');
const { resolve } = require('node:path');
const { after, before, test } = require('node:test');
const { chromium } = require('playwright');

const root = resolve(__dirname, '../..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const galleryLayout = read('_layouts/gallery.html');
const lockedLayout = read('_layouts/locked-gallery.html');
const mapLayout = read('_layouts/gallery-map.html');
const viewerInclude = read('_includes/gallery-viewer.html');
const galleryViewer = viewerInclude
  .replace(/{% if include\.map %}[\s\S]*?{% endif %}/, '');
const mapViewer = viewerInclude.replace(/{% (?:if include\.map|endif) %}/g, '');
const revision = 'a'.repeat(40);
const gallery = '/galleries/hb-egypt/';
const locked = '/galleries/hb-rzstart/';
const mapRoute = '/experiments/atrium-overview/';
const desktopQuery = '(min-width: 2560px) and (hover: hover) and (pointer: fine)';
const manifest = [
  { image: 'First.jpg', compare: 'First_Checker.jpg', additionalImages: ['First_Wireframe.jpg'] },
  { image: 'Second.jpg' },
  { image: 'Third.jpg' },
];
const mapManifest = {
  version: 1, overview: { image: 'First.jpg', alt: 'Overview' },
  regions: [
    { image: 'Second.jpg', label: 'Reception', x: 37, y: 70 },
    { image: 'Third.jpg', label: 'Office', x: 77, y: 68 },
  ],
};
const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAJABADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKgAJT//2Q==', 'base64');
const webp = Buffer.from('UklGRjAAAABXRUJQVlA4ICQAAABQAQCdASoQAAkAAUAmJQBOgCgAAP7nMP6+8odiZDdJ+p/KAAA=', 'base64');
function fixtureUrls(portfolio, media) {
  return {
    portfolio, media,
    originals: name => `${media}/public-media/${revision}/hb-egypt/${name}.jpg`,
    preview: name => `${portfolio}${gallery}1440p/${name}.webp?v=test&webp=q92-m6`,
  };
}

const routedUrls = fixtureUrls('http://localhost:3000', 'https://media.example.test');
const { portfolio, originals, preview } = routedUrls;

let browser;
before(async () => {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
});
after(() => browser?.close());

function scripts(layout) {
  return layout.slice(layout.indexOf('  <script src=', layout.indexOf('</head>')), layout.indexOf('</body>'))
    .replace(/{{ '(\/[^']+)' \| relative_url }}/g, '$1');
}

function diagnosticsBootstrap() {
  return read('_includes/portfolio-diagnostics.html')
    .replace('{{ include.section | jsonify }}', '"gallery"')
    .replace(/{{ '([^']+)' \| relative_url \| jsonify }}/g, (_, asset) => JSON.stringify(asset));
}

function mapBody() {
  // Keep the production map markup, shared viewer include and map controller.
  // Only Jekyll data and remote image delivery are replaced by bounded fixtures.
  const atrium = read('experiments/atrium-overview/index.html');
  const content = mapLayout.slice(mapLayout.indexOf('>', mapLayout.indexOf('<body')) + 1, mapLayout.indexOf('  {% assign map_pages'))
    .replace('{% include site-header.html %}', '')
    .replace('{% include gallery-viewer.html map=true %}', mapViewer);
  const options = {
    defaultGallery: 'hb-egypt', personal: false, galleryRoot: '/galleries/',
    previewSize: Number(/^map_preview_size:\s*([.\d]+)/m.exec(atrium)?.[1] || 1),
    navigateOnClick: !/^map_navigate_on_click:\s*false\s*$/m.test(atrium),
    navigateExpandedPreview: !/^map_navigate_expanded_preview:\s*false\s*$/m.test(atrium),
    viewerScript: '/galleries/gallery-viewer.js', media: desktopQuery,
    webpRevision: 'q92-m6', delivery: {},
    galleries: { 'hb-egypt': { title: 'Hard Bullet - Egypt', hasMap: true, versions: {} } },
  };
  return content + `<script id="gallery-map-options" type="application/json">${JSON.stringify(options)}</script>` + scripts(mapLayout);
}

function pageHtml(path, { embeds, assetVersions = {}, map = false, diagnostics = false, urls = routedUrls } = {}) {
  const { media, originals, preview } = urls;
  const isLocked = path.endsWith(locked);
  const settings = isLocked ? '' : `data-gallery-webp-revision="q92-m6"
    data-gallery-originals-origin="${media}" data-gallery-originals-revision="${revision}"`;
  const base = path.startsWith('/artur/') ? `<base href="${isLocked ? locked : gallery}">` : '';
  const body = map ? mapBody() : isLocked
    ? lockedLayout.slice(lockedLayout.indexOf('  <main id="gallery-access"'), lockedLayout.indexOf('  <script src=', lockedLayout.indexOf('</head>')))
      .replace('{{ portfolio_url | relative_url }}', '/') + scripts(lockedLayout)
      .replace('{{ site.data.gallery_delivery.service_origin | jsonify }}', JSON.stringify(media))
    : `<div class="gallery-content"><header class="intro"><h1>Hard Bullet - Egypt</h1></header>
        <p id="gallery-status" hidden></p>
        <section class="gallery" data-grouped-image-scroll${embeds ? ' data-gallery-embeds="gallery-embeds.json"' : ''}>${galleryLayout.match(/<a class="shot" data-gallery-fallback[\s\S]*?<\/a>/)[0]
          .replace('{{ gallery_original_url | escape }}', `${gallery}First.jpg?v=test`)
          .replaceAll('{{ reduced_image_url }}', preview('First').replace('&', '&amp;'))
          .replace('{{ site.gallery_4k_media | escape }}', desktopQuery)
          .replace('{{ first_image_url | escape }}', originals('First'))
          .replaceAll('{{ gallery_page.gallery_title | escape }}', 'Hard Bullet - Egypt')}</section></div>
        ${galleryViewer}${scripts(galleryLayout)}`;
  return `<!doctype html><html data-gallery4k-media="${desktopQuery}" ${settings}>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${base}${diagnostics ? diagnosticsBootstrap() : ''}
    ${map ? '<link rel="stylesheet" href="/assets/site.css">' : ''}
    <link rel="stylesheet" href="/galleries/gallery.css">
    <link rel="stylesheet" href="/galleries/gallery-embeds.css">
    ${map ? '<link rel="stylesheet" href="/galleries/gallery-map.css">' : ''}</head>
    <body${map ? ' class="gallery-map-experiment"' : ''} data-gallery-revision="test" data-gallery-asset-versions="${JSON.stringify(assetVersions).replaceAll('"', '&quot;')}">${body}</body></html>`;
}

function signal() {
  let release;
  const reached = new Promise(resolve => { release = resolve; });
  return { reached, release };
}

async function startFixtureServer(t, serve, errors) {
  const server = createServer(async (incoming, response) => {
    const request = {
      fulfill({ status = 200, headers, contentType = 'text/plain', body, json, path }) {
        if (path) {
          body = readFileSync(path);
          contentType = path.endsWith('.css') ? 'text/css' : 'text/javascript';
        } else if (json !== undefined) {
          body = JSON.stringify(json);
          contentType = 'application/json';
        }
        response.writeHead(status, {
          'Content-Type': contentType, 'Cache-Control': 'no-store', 'Connection': 'close', ...headers,
        });
        response.end(body);
      },
      abort() { response.destroy(); },
    };
    try {
      await serve(request, new URL(incoming.url, 'http://127.0.0.1:' + server.address().port));
    } catch (error) {
      errors.push(error.message);
      response.destroy();
    }
  });
  t.after(() => {
    if (!server.listening) return;
    return new Promise(resolve => {
      server.close(resolve);
      server.closeAllConnections();
    });
  });
  const listening = once(server, 'listening');
  server.listen(0, '127.0.0.1');
  await listening;
  return 'http://127.0.0.1:' + server.address().port;
}

async function openPage(t, {
  route = gallery, width = 2800, hasTouch = false, intercept, embeds, assetVersions,
  map = false, diagnostics = false, reducedMotion, cacheImages = false,
} = {}) {
  if (map) route = mapRoute;
  const page = await browser.newPage({ hasTouch, viewport: { width, height: 900 } });
  t.after(() => page.close());
  page.setDefaultTimeout(5000);
  if (reducedMotion) await page.emulateMedia({ reducedMotion });
  const requests = [];
  const errors = [];
  const imageHeaders = cacheImages ? { 'Cache-Control': 'public, max-age=600' } : {};
  let urls = routedUrls;
  page.on('pageerror', error => errors.push(error.message));
  async function serve(request, url) {
    requests.push(url.href);
    if (intercept && await intercept(request, url, urls)) return;
    if (url.pathname === route) {
      return request.fulfill({ contentType: 'text/html', body: pageHtml(route, { embeds, assetVersions, map, diagnostics, urls }) });
    }
    if (map && url.pathname === `${gallery}gallery-map.json`) return request.fulfill({ json: mapManifest });
    if (url.pathname === `${gallery}gallery.json` || url.pathname === '/media/gallery.json') {
      return request.fulfill({ json: manifest });
    }
    if (embeds && url.pathname === `${gallery}gallery-embeds.json`) return request.fulfill({ json: embeds });
    if (url.pathname.endsWith('.webp')) return request.fulfill({ headers: imageHeaders, contentType: 'image/webp', body: webp });
    if (url.pathname.endsWith('.jpg')) {
      return request.fulfill({ headers: { ...imageHeaders, 'Access-Control-Allow-Origin': '*' }, contentType: 'image/jpeg', body: jpeg });
    }
    if (url.origin === urls.portfolio && /^\/(?:assets|galleries)\/[\w./-]+\.(?:js|css)$/.test(url.pathname)) {
      return request.fulfill({ path: resolve(root, url.pathname.slice(1)) });
    }
    return request.fulfill({ status: 404 });
  }
  if (cacheImages) {
    // Playwright routing disables HTTP caching. Count requests reaching the two local origins.
    const [siteOrigin, mediaOrigin] = await Promise.all([
      startFixtureServer(t, serve, errors), startFixtureServer(t, serve, errors),
    ]);
    urls = fixtureUrls(siteOrigin, mediaOrigin);
  } else {
    await page.route('**/*', request => serve(request, new URL(request.request().url())));
  }
  await page.goto(urls.portfolio + route + (diagnostics ? '?diagnostics=1' : ''), { waitUntil: 'domcontentloaded' });
  return { page, requests, errors, urls };
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

function expectFallback(requests, name, { originals, preview }) {
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
      const { page, requests, errors, urls } = await openPage(t, { width, cacheImages: true });
      const { originals, preview } = urls;
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
  const { page, requests, errors, urls } = await openPage(t, {
    cacheImages: true,
    intercept: async (request, url, { originals }) => {
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
  const { originals, preview } = urls;
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
      const { page, requests, errors, urls } = await openPage(t, {
        cacheImages: true,
        route,
        intercept: async (request, url, { originals, media }) => {
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
      const { originals, preview } = urls;
      await displayed(page, '.shot-primary', preview('First'));
      assert.equal(await page.locator('.shot').first().getAttribute('href'), originals('First'));
      await page.locator('.shot').first().press('Enter');
      await displayed(page, '#original', preview('First'));
      await activeSegment(page, 0);
      assert.equal(await page.locator('#status').isHidden(), true);
      expectFallback(requests, 'First', urls);
      assert.deepEqual(errors, []);
    });
  }
});

test('navigation holds the visible image and ignores late fallback from a previous shot', { timeout: 12_000 }, async t => {
  const failOriginal = signal();
  const releasePreview = signal();
  const previewStarted = signal();
  t.after(() => { failOriginal.release(); releasePreview.release(); });
  const { page, requests, errors, urls } = await openPage(t, {
    cacheImages: true,
    intercept: async (request, url, { originals, preview }) => {
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
  const { originals, preview } = urls;
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
  expectFallback(requests, 'Second', urls);
  onceEach(requests, originals('Third'));
  assert.deepEqual(errors, []);
});

test('a late Checker fallback cannot replace the selected Wireframe', { timeout: 12_000 }, async t => {
  const releaseChecker = signal();
  const checkerStarted = signal();
  t.after(releaseChecker.release);
  const { page, requests, errors, urls } = await openPage(t, {
    cacheImages: true,
    intercept: async (request, url, { originals, preview }) => {
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
  const { originals, preview } = urls;
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
  expectFallback(requests, 'First_Checker', urls);
  expectFallback(requests, 'First_Wireframe', urls);
  assert.deepEqual(errors, []);
});

test('two 4K failures and one WebP failure show an error without restarting the requests', async t => {
  const { page, requests, errors, urls } = await openPage(t, {
    cacheImages: true,
    intercept: async (request, url, { originals, preview }) => {
      if (![originals('Second'), preview('Second'), originals('First_Checker'),
        preview('First_Checker')].includes(url.href)) return false;
      await request.fulfill({ status: 503 });
      return true;
    },
  });
  const { originals, preview } = urls;
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
  expectFallback(requests, 'Second', urls);
  expectFallback(requests, 'First_Checker', urls);
  assert.deepEqual(errors, []);
});

async function swipeInViewer(session, start, end) {
  const point = (x, y) => [{ x: Math.round(x), y: Math.round(y), id: 1 }];
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(...start) });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(...end) });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function pinchInViewer(session, x, y, startingRadius, endingRadius) {
  const point = (radius, side, id) => ({ x: Math.round(x + side * radius), y: Math.round(y), id });
  const points = radius => [point(radius, -1, 1), point(radius, 1, 2)];
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(startingRadius) });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(endingRadius) });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function viewerTransform(page) {
  return page.locator('#viewer-canvas').evaluate(canvas => {
    const transform = getComputedStyle(canvas).transform;
    const matrix = new DOMMatrixReadOnly(transform === 'none' ? undefined : transform);
    return { scale: matrix.a, x: matrix.e, y: matrix.f };
  });
}

async function waitForViewerScale(page, scale) {
  await page.waitForFunction(target => {
    const transform = document.querySelector('#viewer-canvas').style.transform;
    return new DOMMatrixReadOnly(transform || undefined).a === target;
  }, scale);
}

async function modifiedWheel(page, modifier, deltaX, deltaY) {
  await page.keyboard.down(modifier);
  try {
    await page.mouse.wheel(deltaX, deltaY);
  } finally {
    await page.keyboard.up(modifier);
  }
}

async function gallerySmootherReady(page, paused = false) {
  await page.waitForFunction(paused => {
    const smoother = window.ScrollSmoother?.get();
    const features = window.PortfolioDiagnostics?.report?.().pages.at(-1).features;
    const mode = paused ? 'Paused for fullscreen viewer' : 'GSAP ScrollSmoother';
    return smoother && smoother.paused() === paused &&
      features?.['gallery-smoother']?.mode === mode;
  }, paused);
}

async function galleryScrollPosition(page) {
  return page.evaluate(() => ({
    native: window.scrollY,
    rendered: window.ScrollSmoother.get().scrollTop(),
    top: document.querySelector('.gallery-map-page').getBoundingClientRect().top,
  }));
}

async function galleryScrollTargets(page, selector) {
  return page.evaluate(selector => {
    const rendered = window.ScrollSmoother?.get()?.scrollTop() ?? scrollY;
    const max = document.scrollingElement.scrollHeight - document.documentElement.clientHeight;
    return [...document.querySelector(selector).children].map(entry => {
      const bounds = entry.getBoundingClientRect();
      return Math.max(0, Math.min(max, rendered + bounds.top + (bounds.height - innerHeight) / 2));
    });
  }, selector);
}

async function completedGalleryStep(page, target, completed) {
  await page.waitForFunction(({ target, completed }) => {
    const rendered = window.ScrollSmoother?.get()?.scrollTop() ?? scrollY;
    const tally = window.PortfolioDiagnostics.report().pages.at(-1).tallies['gallery-wheel'];
    return Math.abs(rendered - target) < 1 && Math.abs(rendered - scrollY) < 1 &&
      (tally?.['step completed'] || 0) >= completed;
  }, { target, completed });
}

test('Atrium ScrollSmoother moves shared wheel steps once and smooths independent small trackpad deltas', { timeout: 20_000 }, async t => {
  const { page, requests, errors } = await openPage(t, {
    map: true, width: 1440, diagnostics: true, reducedMotion: 'no-preference',
  });
  await page.locator('#map-screenshots .shot-primary').nth(2).waitFor();
  await gallerySmootherReady(page);
  await page.waitForLoadState('load');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].filter(image => {
    const bounds = image.getBoundingClientRect();
    return bounds.width > 0 && bounds.height > 0 && bounds.bottom > 0 && bounds.top < innerHeight;
  }).every(image => image.complete && image.naturalWidth > 0));
  // ScrollSmoother 3.15.1 has a .5s initialization phase and a .2s delayed
  // ResizeObserver refresh. Measure interpolation after the fixture layout settles.
  await page.waitForTimeout(600);
  await page.waitForFunction(() => window.ScrollSmoother.get().scrollTrigger.end > 0 &&
    !window.ScrollTrigger.isRefreshing && !window.ScrollSmoother.isRefreshing);
  const setup = await page.evaluate(() => {
    const smoother = window.ScrollSmoother.get();
    return {
      versions: [window.gsap.version, window.ScrollTrigger.version, window.ScrollSmoother.version],
      wrapper: smoother.wrapper().id, content: smoother.content().id, smooth: smoother.smooth(),
      effects: smoother.vars.effects, normalizeScroll: smoother.vars.normalizeScroll, smoothTouch: smoother.vars.smoothTouch,
      viewerOutside: !smoother.content().contains(document.querySelector('#viewer')),
      diagnosticsOutside: !smoother.content().contains(document.querySelector('.portfolio-diagnostics')),
      optIn: document.querySelector('#map-screenshots').hasAttribute('data-gsap-gallery-scroll'),
    };
  });
  assert.deepEqual(setup, {
    versions: ['3.15.1', '3.15.1', '3.15.1'], wrapper: 'gallery-scroll-wrapper', content: 'gallery-scroll-content',
    smooth: .65, effects: false, normalizeScroll: false, smoothTouch: false,
    viewerOutside: true, diagnosticsOutside: true, optIn: true,
  });
  const [firstTarget] = await galleryScrollTargets(page, '#map-screenshots');
  assert.ok(firstTarget > 160, 'the first screenshot is below the overview');
  await page.mouse.move(300, 300);
  for (const delta of [160, 12]) {
    if (delta === 12) await page.waitForTimeout(180); // Start a new gesture after the shared quiet gap.
    const before = await galleryScrollPosition(page);
    await page.evaluate(() => {
      const trace = window.atriumScrollTrace = { active: true, samples: [] };
      function sample() {
        const smoother = window.ScrollSmoother.get();
        trace.samples.push({
          time: performance.now(), native: scrollY, rendered: smoother.scrollTop(),
          top: smoother.content().getBoundingClientRect().top, refreshing: Boolean(window.ScrollTrigger.isRefreshing),
        });
        if (trace.active) requestAnimationFrame(sample);
      }
      sample();
    });
    await page.mouse.wheel(0, delta);
    const target = delta === 160 ? firstTarget : before.native + delta;
    await page.waitForFunction(target => {
      const rendered = window.ScrollSmoother.get().scrollTop();
      return Math.abs(rendered - target) < 1 && Math.abs(scrollY - rendered) < 1;
    }, target);
    const after = await galleryScrollPosition(page);
    const samples = await page.evaluate(() => {
      window.atriumScrollTrace.active = false;
      return window.atriumScrollTrace.samples;
    });
    assert.ok(after.rendered - before.rendered > delta / 2, `${delta}px input moves the rendered page`);
    if (delta === 160) {
      assert.ok(Math.abs(after.rendered - firstTarget) < 1, 'one coarse gesture centers exactly the first screenshot');
      assert.ok(Math.max(...samples.map(sample => Math.abs(sample.native - sample.rendered))) <= 1.5,
        'the GSAP image step writes rendered and native positions together without a second smoothing pass');
    }
    assert.ok(Math.abs(after.top - before.top + after.rendered - before.rendered) < 2,
      'the visible map follows the smoother position');
    const intermediate = samples.some(sample => sample.rendered > before.rendered + .5 && sample.rendered < after.rendered - .5);
    t.diagnostic(JSON.stringify({
      delta, frames: samples.length, from: before.rendered, to: after.rendered,
      intermediateFrames: samples.filter(sample => sample.rendered > before.rendered + .5 && sample.rendered < after.rendered - .5).length,
      maxNativeDifference: Math.max(...samples.map(sample => Math.abs(sample.native - sample.rendered))),
    }));
    if (!intermediate) {
      t.diagnostic(JSON.stringify({ delta, before, after, samples, environment: await page.evaluate(() => ({
        documentState: document.readyState, gsapTime: window.gsap.globalTimeline.time(),
        pendingImages: [...document.images].filter(image => !image.complete).length,
        smootherTween: window.ScrollSmoother.get().scrollTrigger.getTween()?.progress(),
        report: window.PortfolioDiagnostics.report().pages.at(-1).motion,
      })) }));
    }
    assert.ok(intermediate,
      `${delta}px input renders intermediate positions`);
    assert.ok(samples.some(sample => sample.rendered > samples[0].rendered + .5 &&
      Math.abs(sample.top - samples[0].top + sample.rendered - samples[0].rendered) < 2),
      'GSAP applies the scroll transform to the content');
  }
  const report = await page.evaluate(() => window.PortfolioDiagnostics.report().pages.at(-1));
  assert.equal(report.features['gallery-smoother'].mode, 'GSAP ScrollSmoother');
  assert.equal(report.tallies['gallery-wheel']['animated step started'], 1);
  assert.equal(report.tallies['gallery-wheel']['step completed'], 1);
  for (const feature of ['gallery-smoother', 'gallery-wheel']) {
    assert.ok(report.motion[feature].advances > 1, `${feature} records changing positions`);
  }
  assert.ok(report.input.wheel >= 2);
  assert.ok(report.input.smallPixelWheel >= 1);
  for (const name of ['gsap', 'ScrollTrigger', 'ScrollSmoother']) {
    assert.ok(requests.includes(`${portfolio}/assets/vendor/gsap/3.15.1/${name}.min.js`), `${name} is served locally`);
  }
  assert.deepEqual(errors, []);
});

test('Atrium and ordinary gallery wheel gestures select one image per quiet gap and reverse cleanly', { timeout: 25_000 }, async t => {
  for (const map of [false, true]) {
    await t.test(map ? 'Atrium GSAP stepping' : 'ordinary gallery animation', async t => {
      const { page, errors } = await openPage(t, { map, width: 1440, diagnostics: true, reducedMotion: 'no-preference' });
      await page.waitForFunction(() => {
        const images = [...document.querySelectorAll('.gallery .shot-primary')];
        return images.length === 3 && images.every(image => image.complete && image.naturalWidth > 0);
      });
      await page.waitForLoadState('load');
      await page.evaluate(() => document.fonts.ready);
      if (map) {
        await gallerySmootherReady(page);
        await page.waitForTimeout(600); // Allow the vendor's initial layout refresh to finish.
      } else {
        await page.addStyleTag({ content: '.gallery-content { padding-top: 120px; }' });
        assert.equal(await page.evaluate(() => Boolean(window.ScrollSmoother?.get())), false);
      }
      const [first, second] = await galleryScrollTargets(page, map ? '#map-screenshots' : '.gallery');
      assert.ok(first > 24 && second > first + 100);
      await page.evaluate(() => {
        window.galleryGestureWheels = [];
        window.addEventListener('wheel', event => {
          window.galleryGestureWheels.push({ time: event.timeStamp, delta: event.deltaY,
            trusted: event.isTrusted, prevented: event.defaultPrevented });
        });
      });
      await page.mouse.move(300, 300);
      for (const delta of [120, 120, 60, 12]) await page.mouse.wheel(0, delta);
      await page.waitForFunction(() => window.galleryGestureWheels.length === 4);
      const burst = await page.evaluate(() => window.galleryGestureWheels);
      assert.equal(burst.length, 4);
      assert.ok(burst.every(event => event.trusted && event.prevented));
      assert.ok(burst.slice(1).every((event, index) => event.time - burst[index].time < 150),
        'the input burst stays within the shared gesture gap');
      await completedGalleryStep(page, first, 1);
      const firstReport = await page.evaluate(() => window.PortfolioDiagnostics.report().pages.at(-1));
      assert.equal(firstReport.tallies['gallery-wheel']['animated step started'], 1,
        'coarse ticks and their small tail select one screenshot');

      await page.waitForTimeout(180);
      await page.mouse.wheel(0, 120);
      await completedGalleryStep(page, second, 2);
      await page.mouse.wheel(0, -120);
      await completedGalleryStep(page, first, 3);
      let started = 3, completed = 3;
      if (map) {
        // Reverse an active GSAP step after leaving the near-center tolerance.
        await page.mouse.wheel(0, 120);
        await page.waitForFunction(({ first, second }) => {
          const position = window.ScrollSmoother.get().scrollTop();
          return position > first + 64 && position < second - 24;
        }, { first, second });
        await page.mouse.wheel(0, -120);
        await completedGalleryStep(page, first, 4);
        started = 5; completed = 4;
        await page.waitForTimeout(250);
        const position = await galleryScrollPosition(page);
        assert.ok(Math.abs(position.rendered - first) < 1, 'the cancelled forward tween cannot move the settled image');
        await page.mouse.wheel(0, -120);
        await completedGalleryStep(page, 0, 5);
        started = 6; completed = 5;
      }
      const report = await page.evaluate(() => window.PortfolioDiagnostics.report().pages.at(-1));
      assert.equal(report.tallies['gallery-wheel']['animated step started'], started);
      assert.equal(report.tallies['gallery-wheel']['step completed'], completed);
      if (map) assert.ok(report.tallies['gallery-wheel']['step cancelled'] >= 1);
      t.diagnostic(JSON.stringify({ map, targets: [first, second], wheel: report.tallies['gallery-wheel'] }));
      assert.deepEqual(errors, []);
    });
  }
});

test('Atrium ScrollSmoother pauses for fullscreen wheel input and resumes at the last image', { timeout: 20_000 }, async t => {
  const { page, errors } = await openPage(t, {
    map: true, width: 1440, diagnostics: true, reducedMotion: 'no-preference',
  });
  const overview = page.locator('#public-map .gallery-map-overview-button');
  await overview.waitFor();
  await gallerySmootherReady(page);
  await page.evaluate(() => { window.atriumSmootherInstance = window.ScrollSmoother.get(); });
  await overview.evaluate(button => button.focus({ preventScroll: true }));
  const before = await galleryScrollPosition(page);
  await overview.press('Enter');
  await page.locator('#fullscreen-map').waitFor({ state: 'visible' });
  await gallerySmootherReady(page, true);
  const stage = await page.locator('#stage').boundingBox();
  await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2);
  await modifiedWheel(page, 'Control', 0, -120);
  await page.locator('#stage.zoomed').waitFor();
  assert.equal(await page.locator('#counter').textContent(), '1 / 3');
  assert.ok(Math.abs((await galleryScrollPosition(page)).rendered - before.rendered) < 2,
    'fullscreen wheel zoom holds the page position');
  await page.mouse.wheel(0, 160);
  await displayed(page, '#original', preview('Second'));
  assert.equal(await page.locator('#counter').textContent(), '2 / 3');
  const paused = await galleryScrollPosition(page);
  assert.ok(Math.abs(paused.rendered - before.rendered) < 2, 'fullscreen wheel navigation holds the page position');
  await page.locator('#fullscreen').click();
  await page.locator('#viewer').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.fullscreenElement === null);
  await gallerySmootherReady(page);
  assert.equal(await page.evaluate(() => window.ScrollSmoother.get() === window.atriumSmootherInstance), true);
  await page.waitForFunction(() => {
    const image = document.querySelectorAll('#map-screenshots .shot')[1];
    const bounds = image.getBoundingClientRect();
    return document.activeElement === image && Math.abs(bounds.top + bounds.height / 2 - innerHeight / 2) < 2;
  });
  const restored = await galleryScrollPosition(page);
  assert.ok(restored.rendered > before.rendered, 'the last fullscreen image is farther down the map');
  assert.ok(Math.abs(restored.rendered - restored.native) < 2, 'the visual and native scroll positions agree');
  await page.mouse.move(300, 300);
  await page.mouse.wheel(0, 120);
  await page.waitForFunction(position => window.ScrollSmoother.get().scrollTop() > position + 60, restored.rendered);
  assert.deepEqual(errors, []);
});

test('Atrium ScrollSmoother leaves native scrolling usable for reduced motion or a missing dependency', { timeout: 20_000 }, async t => {
  for (const fallback of ['reduced motion', 'missing dependency']) {
    await t.test(fallback, async t => {
      const { page, requests, errors } = await openPage(t, {
        map: true, width: 1440, diagnostics: true,
        reducedMotion: fallback === 'reduced motion' ? 'reduce' : 'no-preference',
        intercept: async (request, url) => {
          if (fallback !== 'missing dependency' || !url.pathname.endsWith('/ScrollSmoother.min.js')) return false;
          await request.fulfill({ status: 503 });
          return true;
        },
      });
      await page.locator('#map-screenshots .shot-primary').nth(2).waitFor();
      await page.waitForFunction(() => window.PortfolioDiagnostics?.report?.().pages.at(-1)
        .features['gallery-smoother']?.mode === 'Native scrolling');
      assert.equal(await page.evaluate(() => Boolean(window.ScrollSmoother?.get())), false);
      assert.equal(await page.locator('#gallery-scroll-content').evaluate(content => getComputedStyle(content).transform), 'none');
      const before = await page.evaluate(() => scrollY);
      await page.mouse.move(300, 300);
      await page.mouse.wheel(0, 120);
      await page.waitForFunction(before => scrollY > before + 60, before);
      await page.locator('#map-fullscreen').click();
      await page.locator('#fullscreen-map').waitFor({ state: 'visible' });
      await page.locator('#fullscreen').click();
      await page.locator('#viewer').waitFor({ state: 'hidden' });
      if (fallback === 'missing dependency') {
        assert.ok(requests.some(url => url.endsWith('/ScrollSmoother.min.js')));
      }
      assert.deepEqual(errors, []);
    });
  }
});

test('Atrium ScrollSmoother initializes after a slow dependency while native scrolling stays usable', { timeout: 15_000 }, async t => {
  const dependencyRequested = signal();
  const releaseDependency = signal();
  let requestedAt;
  t.after(releaseDependency.release);
  const { page, requests, errors } = await openPage(t, {
    map: true, width: 1440, diagnostics: true, reducedMotion: 'no-preference',
    intercept: async (request, url) => {
      if (!url.pathname.endsWith('/ScrollSmoother.min.js')) return false;
      requestedAt = performance.now();
      dependencyRequested.release();
      await releaseDependency.reached;
      return false;
    },
  });
  await dependencyRequested.reached;
  await page.locator('#map-screenshots .shot-primary').nth(2).waitFor();
  assert.equal(await page.evaluate(() => Boolean(window.ScrollSmoother?.get())), false);
  await page.mouse.move(300, 300);
  const initial = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 120);
  await page.waitForFunction(initial => scrollY > initial + 60, initial);

  // Reproduce a real slow response beyond the former eight-second rejection.
  // The response remains pending, so no download failure has occurred.
  await page.waitForTimeout(Math.max(0, 8200 - (performance.now() - requestedAt)));
  assert.ok(performance.now() - requestedAt >= 8000);
  assert.deepEqual(await page.evaluate(() => ({
    gsap: window.gsap?.version, trigger: window.ScrollTrigger?.version,
    smoother: Boolean(window.ScrollSmoother),
    transform: getComputedStyle(document.querySelector('#gallery-scroll-content')).transform,
  })), { gsap: '3.15.1', trigger: '3.15.1', smoother: false, transform: 'none' });
  const waiting = await page.evaluate(() => scrollY);
  await page.evaluate(() => {
    window.galleryEngineHandoff = null;
    document.addEventListener('gallery-scrollcontrollerchange', () => {
      const tally = window.PortfolioDiagnostics.report().pages.at(-1).tallies['gallery-wheel'];
      window.galleryEngineHandoff = {
        native: scrollY, hadSmoother: Boolean(window.ScrollSmoother?.get()),
        activeStep: (tally?.['animated step started'] || 0) >
          (tally?.['step completed'] || 0) + (tally?.['step cancelled'] || 0),
      };
    }, { capture: true, once: true });
  });
  await page.mouse.wheel(0, 120);
  await page.waitForFunction(waiting => scrollY > waiting + 60, waiting);
  const beforeRelease = await page.evaluate(() => scrollY);
  const delayedFor = performance.now() - requestedAt;
  releaseDependency.release();

  await gallerySmootherReady(page);
  const handoff = await page.evaluate(() => window.galleryEngineHandoff);
  assert.ok(handoff?.activeStep, 'the actual controller-change event interrupts an active native fallback step');
  assert.equal(handoff.hadSmoother, false);
  await page.waitForFunction(position => {
    const smoother = window.ScrollSmoother.get();
    return smoother.scrollTrigger.end > 0 && Math.abs(smoother.scrollTop() - position) < 2;
  }, handoff.native);
  await page.waitForTimeout(600); // Let startup and any uncancelled old step expose a late movement.
  const settled = await page.evaluate(() => {
    const smoother = window.ScrollSmoother.get(), content = smoother.content();
    const { top, bottom, height } = content.getBoundingClientRect();
    const focus = document.activeElement;
    return {
      time: performance.now(), native: scrollY, rendered: smoother.scrollTop(), paused: smoother.paused(),
      viewport: innerHeight, clientHeight: document.documentElement.clientHeight,
      maxScroll: document.scrollingElement.scrollHeight - document.documentElement.clientHeight,
      body: { margin: getComputedStyle(document.body).margin, height: document.body.style.height, scrollHeight: document.body.scrollHeight },
      content: { top, bottom, height, clientHeight: content.clientHeight, scrollHeight: content.scrollHeight },
      triggerEnd: smoother.scrollTrigger.end, triggerProgress: smoother.scrollTrigger.progress,
      scrubProgress: smoother.scrollTrigger.getTween()?.progress(),
      refreshing: Boolean(window.ScrollTrigger.isRefreshing || window.ScrollSmoother.isRefreshing),
      focus: { tag: focus.tagName, id: focus.id, class: focus.className },
      wheel: window.PortfolioDiagnostics.report().pages.at(-1).tallies['gallery-wheel'],
    };
  });
  if (Math.abs(settled.native - handoff.native) >= 2 || Math.abs(settled.rendered - handoff.native) >= 2) {
    t.diagnostic('Gallery engine handoff failure: ' + JSON.stringify({ beforeRelease, handoff, settled }));
  }
  assert.ok(Math.abs(settled.native - handoff.native) < 2);
  assert.ok(Math.abs(settled.rendered - handoff.native) < 2);
  assert.equal(requests.filter(url => url.endsWith('/ScrollSmoother.min.js')).length, 1,
    'the pending request is allowed to complete without a duplicate download');
  await page.mouse.wheel(0, 120);
  await page.waitForFunction(position => window.ScrollSmoother.get().scrollTop() > position + 60, handoff.native);
  const report = await page.evaluate(() => window.PortfolioDiagnostics.report().pages.at(-1));
  assert.equal(report.features['gallery-smoother'].mode, 'GSAP ScrollSmoother');
  assert.ok(report.motion['gallery-smoother'].advances > 0);
  assert.ok(report.tallies['gallery-wheel']['step cancelled'] >= 1);
  t.diagnostic(JSON.stringify({
    delayedForMs: Math.round(delayedFor), nativeBeforeRelease: beforeRelease, handoff,
    renderedAfterRelease: await page.evaluate(() => window.ScrollSmoother.get().scrollTop()),
    mode: report.features['gallery-smoother'].mode,
  }));
  assert.deepEqual(errors, []);
});

test('opening diagnostics update when GSAP loads without scroll input', async t => {
  const page = await browser.newPage();
  t.after(() => page.close());
  const bootstrap = diagnosticsBootstrap();
  const library = '/assets/vendor/gsap/3.15.1/gsap.min.js';
  const gsapReady = signal();
  t.after(gsapReady.release);
  await page.route('**/*', async request => {
    const { pathname } = new URL(request.request().url());
    if (pathname === gallery) {
      return request.fulfill({ contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">${bootstrap}<script src="${library}" async></script></head><body></body></html>` });
    }
    if (pathname === library) {
      await gsapReady.reached;
      return request.fulfill({ path: resolve(root, pathname.slice(1)) });
    }
    if (/^\/assets\/portfolio-diagnostics\.(js|css)$/.test(pathname)) {
      return request.fulfill({ path: resolve(root, pathname.slice(1)) });
    }
    return request.fulfill({ status: 404 });
  });
  await page.goto(portfolio + gallery + '?diagnostics=1', { waitUntil: 'domcontentloaded' });
  await page.getByText('Diagnostics', { exact: true }).click({ timeout: 4000 });
  await page.getByText('Loading libraries — gsap', { exact: true }).waitFor({ timeout: 4000 });
  gsapReady.release();
  await page.getByText('Loaded libraries — gsap 3.15.1', { exact: true }).waitFor({ timeout: 4000 });
  const [report] = await page.evaluate(() => window.PortfolioDiagnostics.report().pages);
  assert.equal(report.input.wheel, 0);
  assert.equal(report.input.scrollEvents, 0);
  assert.ok(report.events.some(entry => entry.feature === 'libraries' && entry.details.file === 'gsap.min.js'));
});

test('the first desktop wheel step animates the opening image into place', async t => {
  const { page, errors } = await openPage(t, { width: 1440 });
  await page.locator('.shot-primary').nth(2).waitFor();
  await displayed(page, '.shot-primary', preview('First'));
  assert.equal(await page.evaluate(() => Boolean(window.ScrollSmoother?.get())), false,
    'ordinary galleries retain their existing scrolling controller');
  // Recreate the space reserved by the site header on a real gallery.
  await page.addStyleTag({ content: '.gallery-content { padding-top: 120px; }' });
  const firstCenter = await page.locator('.shot-entry').first().evaluate(entry => {
    const bounds = entry.getBoundingClientRect();
    return scrollY + bounds.top + (bounds.height - document.documentElement.clientHeight) / 2;
  });
  assert.ok(firstCenter > 24);
  assert.equal(await page.evaluate(() => scrollY), 0);

  await page.evaluate(() => {
    const scrollTo = window.scrollTo.bind(window);
    const scrollBy = window.scrollBy.bind(window);
    const calls = window.galleryScrollCalls = { offsets: [], browserSteps: 0 };
    window.scrollTo = options => {
      calls.offsets.push(options.top);
      scrollTo(options);
    };
    window.scrollBy = options => {
      calls.browserSteps++;
      scrollBy(options);
    };
  });
  await page.mouse.move(400, 400);
  await page.mouse.wheel(0, 120);
  await page.waitForFunction(target => Math.abs(scrollY - target) <= 1, firstCenter);
  const calls = await page.evaluate(() => window.galleryScrollCalls);
  assert.equal(calls.browserSteps, 0);
  assert.ok(calls.offsets.some(offset => offset > 0 && offset < firstCenter - 1), 'the first step must render intermediate positions');
  assert.deepEqual(errors, []);
});

test('fullscreen touch swipes navigate on both axes while pinch and pan stay on the image', async t => {
  const { page, errors } = await openPage(t, { width: 412, hasTouch: true });
  const session = await page.context().newCDPSession(page);
  await page.locator('.shot').first().tap();
  await displayed(page, '#original', preview('First'));

  await segment(page, 1).tap();
  await displayed(page, '#original', preview('First_Checker'));
  await activeSegment(page, 1);

  const stage = await page.locator('#stage').boundingBox();
  const x = stage.x + stage.width / 2;
  const y = stage.y + stage.height / 2;
  for (const [start, end, image] of [
    [[x, y + 50], [x, y - 55], 'Second'],
    [[x - 70, y], [x + 70, y], 'First'],
    [[x + 70, y], [x - 70, y], 'Second'],
    [[x, y - 55], [x, y + 50], 'First'],
  ]) {
    await swipeInViewer(session, start, end);
    await displayed(page, '#original', preview(image));
  }

  await pinchInViewer(session, x, y, 30, 90);
  await page.locator('#stage.zoomed').waitFor();
  const beforePan = await viewerTransform(page);
  assert.ok(beforePan.scale > 1);
  assert.equal(await page.locator('#counter').textContent(), '1 / 3');

  await swipeInViewer(session, [x - 45, y], [x + 45, y]);
  const afterPan = await viewerTransform(page);
  assert.equal(afterPan.scale, beforePan.scale);
  assert.notEqual(afterPan.x, beforePan.x);
  assert.equal(await page.locator('#counter').textContent(), '1 / 3');

  await pinchInViewer(session, x, y, 95, 25);
  await page.locator('#stage.zoomed').waitFor({ state: 'detached' });
  assert.equal((await viewerTransform(page)).scale, 1);
  assert.equal(await page.locator('#counter').textContent(), '1 / 3');
  assert.deepEqual(errors, []);
});

test('fullscreen desktop left click toggles zoom, middle and right drag pan, and double-click fits', async t => {
  const { page, errors } = await openPage(t, { width: 1440 });
  const firstShot = page.locator('.shot').first();
  const viewer = page.locator('#viewer');
  const zoomedStage = page.locator('#stage.zoomed');
  await firstShot.click();
  await displayed(page, '#original', preview('First'));
  const image = await page.locator('#original').boundingBox();
  const x = image.x + image.width / 2;
  const y = image.y + image.height / 2;
  assert.equal(await page.locator('#original').evaluate(image => getComputedStyle(image).cursor), 'default');
  await page.evaluate(() => {
    window.galleryContextMenus = [];
    window.galleryClickZoomFrames = [];
    document.querySelector('#viewer').addEventListener('gallery-zoomchange', event => {
      window.galleryClickZoomFrames.push(event.detail);
    });
    document.addEventListener('contextmenu', event => {
      window.galleryContextMenus.push(event.defaultPrevented);
      event.preventDefault();
    });
  });
  await page.mouse.click(x, y, { button: 'right' });
  assert.deepEqual(await page.evaluate(() => window.galleryContextMenus), [false]);
  assert.deepEqual(await viewerTransform(page), { scale: 1, x: 0, y: 0 });

  async function scaleOnFirstClickFrame(click) {
    await page.evaluate(() => {
      window.scaleOnClickFrame = null;
      document.querySelector('#viewer').addEventListener('click', () => {
        requestAnimationFrame(() => {
          const transform = document.querySelector('#viewer-canvas').style.transform;
          window.scaleOnClickFrame = new DOMMatrixReadOnly(transform || undefined).a;
        });
      }, { once: true });
    });
    await click();
    await page.waitForFunction(() => window.scaleOnClickFrame !== null);
    return page.evaluate(() => window.scaleOnClickFrame);
  }

  async function assertAnimatedZoom(target) {
    await waitForViewerScale(page, target);
    const frames = await page.evaluate(() => window.galleryClickZoomFrames.splice(0));
    assert.equal(frames.at(-1).scale, target);
    assert.ok(frames.filter(({ scale }) => scale > 1 && scale < 2).length > 1);
    return frames;
  }

  const firstFrame = await scaleOnFirstClickFrame(() => page.mouse.click(x, y));
  assert.ok(firstFrame > 1 && firstFrame < 2, 'the single click starts zooming on the next frame');
  await assertAnimatedZoom(2);
  await page.mouse.click(x, y);
  await assertAnimatedZoom(1);
  assert.deepEqual(await viewerTransform(page), { scale: 1, x: 0, y: 0 });
  assert.equal(await viewer.evaluate(element => element.open), true);
  await page.mouse.click(x, y);
  await waitForViewerScale(page, 2);

  await page.mouse.click(x, y, { button: 'right' });
  assert.deepEqual(await page.evaluate(() => window.galleryContextMenus), [false, true]);
  await page.mouse.move(x, y);
  for (const [button, offset] of [['middle', 60], ['right', 120]]) {
    const beforePan = await viewerTransform(page);
    await page.mouse.down({ button });
    await page.locator('#stage.dragging').waitFor();
    assert.equal(await page.locator('#original').evaluate(image => getComputedStyle(image).cursor), 'grabbing');
    await page.mouse.move(x + offset, y - offset / 2, { steps: 3 });
    await page.mouse.up({ button });
    await page.locator('#stage.dragging').waitFor({ state: 'detached' });
    const afterPan = await viewerTransform(page);
    assert.equal(afterPan.scale, 2);
    assert.ok(afterPan.x > beforePan.x, button);
    assert.equal(await viewer.evaluate(element => element.open), true);
  }
  const afterPan = await viewerTransform(page);

  await page.mouse.down({ button: 'left' });
  await page.mouse.move(x + 100, y, { steps: 3 });
  await page.mouse.up({ button: 'left' });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  assert.deepEqual(await viewerTransform(page), afterPan);

  assert.ok(afterPan.x > 0 && afterPan.y < 0);
  await page.evaluate(() => window.galleryClickZoomFrames.splice(0));
  const firstFitFrame = await scaleOnFirstClickFrame(() => page.mouse.click(x - 300, y + 200));
  assert.ok(firstFitFrame > 1 && firstFitFrame < 2, 'zoom-out starts on the next frame too');
  const resetFrames = await assertAnimatedZoom(1);
  let previous = afterPan;
  for (const frame of resetFrames) {
    assert.ok(frame.x >= 0 && frame.x <= previous.x + 0.01, 'horizontal pan returns directly to center');
    assert.ok(frame.y <= 0 && frame.y >= previous.y - 0.01, 'vertical pan returns directly to center');
    previous = frame;
  }
  assert.deepEqual(await viewerTransform(page), { scale: 1, x: 0, y: 0 });
  await page.mouse.click(x, y);
  await waitForViewerScale(page, 2);

  const wheelPoint = await page.locator('#stage').boundingBox();
  await page.mouse.move(wheelPoint.x + wheelPoint.width / 2, wheelPoint.y + wheelPoint.height / 2);
  await page.mouse.wheel(0, 160);
  await displayed(page, '#original', preview('Second'));
  assert.equal(await page.locator('#counter').textContent(), '2 / 3');
  assert.equal((await viewerTransform(page)).scale, 1);
  const session = await page.context().newCDPSession(page);
  async function clickWithCount(clickCount) {
    const point = { x, y, button: 'left', clickCount };
    await session.send('Input.dispatchMouseEvent', { ...point, type: 'mousePressed', buttons: 1 });
    await session.send('Input.dispatchMouseEvent', { ...point, type: 'mouseReleased' });
  }
  const beforeSecondClick = await scaleOnFirstClickFrame(() => clickWithCount(1));
  assert.ok(beforeSecondClick > 1 && beforeSecondClick < 2);
  await clickWithCount(2);
  await waitForViewerScale(page, 1);
  assert.deepEqual(await viewerTransform(page), { scale: 1, x: 0, y: 0 });
  assert.equal(await viewer.evaluate(element => element.open), true);

  // Chromium can carry the click count into an independent click after a double-click.
  await clickWithCount(3);
  await waitForViewerScale(page, 2);
  await clickWithCount(4);
  await zoomedStage.waitFor({ state: 'detached' });
  assert.deepEqual(await viewerTransform(page), { scale: 1, x: 0, y: 0 });

  await page.mouse.click(x, y);
  await waitForViewerScale(page, 2);
  await page.mouse.dblclick(x, y);
  await page.waitForFunction(() => {
    const scale = new DOMMatrixReadOnly(document.querySelector('#viewer-canvas').style.transform || undefined).a;
    return scale > 1 && scale < 2;
  });
  await clickWithCount(3);
  await waitForViewerScale(page, 2);
  await page.evaluate(() => window.galleryClickZoomFrames.splice(0));
  await page.mouse.dblclick(x, y);
  await assertAnimatedZoom(1);
  assert.deepEqual(await viewerTransform(page), { scale: 1, x: 0, y: 0 });
  assert.equal(await page.locator('#counter').textContent(), '2 / 3');
  assert.equal(await page.evaluate(() => document.fullscreenElement?.id), 'viewer-frame');
  await page.locator('#fullscreen').press('Enter');
  await viewer.waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.fullscreenElement === null);
  assert.deepEqual(errors, []);
});

test('fullscreen exit resumes at the last gallery image and reopening starts at fit', async t => {
  for (const [route, delayedResize] of [[gallery, true], ['/artur' + gallery, false]]) {
    await t.test(route, async t => {
      const { page, errors } = await openPage(t, { route, width: 1440 });
      const windowedViewport = page.viewportSize();
      const links = page.locator('.gallery .shot');
      await links.first().click();
      await displayed(page, '#original', preview('First'));
      const openingScroll = await page.evaluate(() => scrollY);

      const stage = await page.locator('#stage').boundingBox();
      await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2);
      await page.mouse.wheel(0, 160);
      await displayed(page, '#original', preview('Second'));
      await page.keyboard.press('ArrowRight');
      await displayed(page, '#original', preview('Third'));
      await modifiedWheel(page, 'Control', 0, -120);
      await page.locator('#stage.zoomed').waitFor();

      if (delayedResize) {
        // Chrome can complete fullscreen exit before it finishes restoring the window size.
        await page.setViewportSize({ width: 2048, height: 1152 });
        await page.locator('#fullscreen').press('Enter');
      } else {
        await page.keyboard.press('Escape');
      }
      await page.locator('#viewer').waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.fullscreenElement === null);
      if (delayedResize) {
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.equal(await links.nth(2).evaluate(link => link === document.activeElement), false,
          'waits for the windowed viewport before returning to the last image');
        await page.setViewportSize(windowedViewport);
      }
      await page.waitForFunction(() => {
        const image = document.querySelectorAll('.gallery .shot')[2];
        const bounds = image.getBoundingClientRect();
        const middle = bounds.top + bounds.height / 2;
        return innerWidth === 1440 && innerHeight === 900
          && document.activeElement === image && middle > 0 && middle < innerHeight;
      });
      assert.ok(await page.evaluate(() => scrollY) > openingScroll + 100);
      assert.deepEqual(await viewerTransform(page), { scale: 1, x: 0, y: 0 });

      const returnScroll = await page.evaluate(() => scrollY);
      await links.nth(2).click();
      await displayed(page, '#original', preview('Third'));
      assert.deepEqual(await viewerTransform(page), { scale: 1, x: 0, y: 0 });
      await page.locator('#fullscreen').click();
      await page.locator('#viewer').waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.fullscreenElement === null &&
        document.activeElement === document.querySelectorAll('.gallery .shot')[2]);
      assert.ok(Math.abs(await page.evaluate(() => scrollY) - returnScroll) < 2);
      assert.deepEqual(errors, []);
    });
  }
});

test('fullscreen desktop modifier-wheel zoom eases toward the cursor without zooming the page', async t => {
  const { page, errors } = await openPage(t, { width: 1440 });
  await page.locator('.shot').first().click();
  await displayed(page, '#original', preview('First'));
  await page.waitForFunction(() => document.fullscreenElement?.id === 'viewer-frame');
  const stage = await page.locator('#stage').boundingBox();
  const centerX = stage.x + stage.width / 2;
  // Keep the test off center within Chromium's headless fullscreen surface.
  const x = Math.round(centerX - stage.width / 10);
  const y = Math.round(stage.y + stage.height / 2);
  await page.mouse.move(x, y);
  const pageZoom = () => page.evaluate(() => [devicePixelRatio, visualViewport.scale, innerWidth, scrollY]);
  const originalPageZoom = await pageZoom();
  await page.evaluate(() => {
    const wheels = [], scales = [];
    window.viewerWheelTest = { wheels, scales };
    document.addEventListener('wheel', event => {
      const { ctrlKey, shiftKey, altKey, defaultPrevented, isTrusted } = event;
      wheels.push({ ctrlKey, shiftKey, altKey, defaultPrevented, isTrusted });
    }, { passive: true });
    document.querySelector('#viewer').addEventListener('gallery-zoomchange', event => scales.push(event.detail.scale));
  });

  const combinations = [
    ['Control', 'ctrlKey', 0, -2500],
    ['Shift', 'shiftKey', -2500, 0],
    ['Alt', 'altKey', 0, -2500],
  ];
  for (const [modifier, eventKey, dx, dy] of combinations) {
    await page.evaluate(() => window.viewerWheelTest.scales.length = 0);
    await modifiedWheel(page, modifier, dx, dy);
    await page.waitForFunction(() => window.viewerWheelTest.scales.at(-1) === 4);
    const { scales } = await page.evaluate(() => window.viewerWheelTest);
    const inMotion = scales.filter(scale => scale > 1 && scale < 4);
    assert.ok(inMotion.length >= 2, modifier + ' eased through intermediate scales');
    assert.ok((inMotion[0] - 1) / 3 < 0.05, modifier + ' started gently on the first frame');
    const transform = await viewerTransform(page);
    assert.ok(Math.abs(transform.x + (x - centerX) * 3) < 1, modifier + ' kept the point under the cursor');

    await modifiedWheel(page, modifier, -dx, -dy);
    await page.waitForFunction(() => window.viewerWheelTest.scales.at(-1) === 1);
    assert.deepEqual(await viewerTransform(page), { scale: 1, x: 0, y: 0 });
    const pair = await page.evaluate(() => window.viewerWheelTest.wheels.slice(-2));
    assert.equal(pair.length, 2);
    assert.ok(pair.every(event => event[eventKey] && event.isTrusted && event.defaultPrevented), modifier + ' stayed inside the viewer');
    assert.equal(await page.locator('#counter').textContent(), '1 / 3');
    assert.deepEqual(await pageZoom(), originalPageZoom);
  }

  // Three small ticks accumulate before the animation catches up.
  await page.keyboard.down('Control');
  for (let tick = 0; tick < 3; tick++) await page.mouse.wheel(0, -120);
  await page.keyboard.up('Control');
  await page.waitForFunction(() => window.viewerWheelTest.scales.at(-1) > 1.7);

  // Reverse between two frames so residual zoom-in velocity cannot slip past the assertion.
  const reversal = await page.evaluate(() => {
    const scales = window.viewerWheelTest.scales;
    const before = scales.at(-1);
    document.querySelector('#viewer-frame').dispatchEvent(new WheelEvent('wheel', {
      deltaY: 120, ctrlKey: true, bubbles: true, cancelable: true,
    }));
    return new Promise(resolve => requestAnimationFrame(() => resolve({ before, after: scales.at(-1) })));
  });
  assert.ok(reversal.after < reversal.before, 'a wheel reversal starts moving out on the next frame');

  // Plain wheel navigation cancels an in-progress zoom and fits the new image.
  await modifiedWheel(page, 'Control', 0, -2500);
  await page.mouse.wheel(0, 160);
  await displayed(page, '#original', preview('Second'));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.deepEqual(await viewerTransform(page), { scale: 1, x: 0, y: 0 });

  await page.keyboard.press('Escape');
  await page.locator('#viewer').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.fullscreenElement === null);
  await page.mouse.move(x, y);
  await modifiedWheel(page, 'Control', 0, 120);
  await page.waitForFunction(() => {
    const event = window.viewerWheelTest.wheels.at(-1);
    return event?.ctrlKey && event.isTrusted && !event.defaultPrevented;
  });
  assert.deepEqual(errors, []);
});

test('comparison hover is limited to the bottom 6% on gallery tiles and fullscreen images', async t => {
  await t.test('gallery tile', async t => {
    const { page, errors } = await openPage(t, { width: 1440 });
    const entry = page.locator('.shot-entry').first();
    const image = entry.locator('.shot-primary');
    const buttons = entry.locator('.comparison-indicator button');
    const chosen = () => entry.locator('button[aria-pressed="true"]').getAttribute('aria-label');

    await displayed(page, '.shot-primary', preview('First'));
    await buttons.nth(1).click();
    await buttons.nth(1).and(entry.locator('[aria-pressed="true"]')).waitFor();
    await buttons.nth(0).click();

    const { x, y, width, height } = await image.boundingBox();
    const moveToChecker = fraction => page.mouse.move(x + width / 2, y + height * fraction);
    await moveToChecker(0.93);
    assert.equal(await chosen(), 'Show variant 1 of 3');
    await moveToChecker(0.95);
    assert.equal(await chosen(), 'Show variant 2 of 3');
    await moveToChecker(0.93);
    assert.equal(await chosen(), 'Show variant 1 of 3');

    await buttons.nth(2).hover();
    await buttons.nth(2).and(entry.locator('[aria-pressed="true"]')).waitFor();
    await moveToChecker(0.93);
    assert.equal(await chosen(), 'Show variant 1 of 3');
    await buttons.nth(2).click();
    await moveToChecker(0.93);
    assert.equal(await chosen(), 'Show variant 3 of 3');
    assert.deepEqual(errors, []);
  });

  await t.test('fullscreen image', async t => {
    const { page, errors } = await openPage(t, { width: 1440 });
    const image = page.locator('#original');
    await page.locator('.shot').first().click();
    await displayed(page, '#original', preview('First'));

    const { x, y, width, height } = await image.evaluate(element => {
      const { x, y, width, height } = element.getBoundingClientRect();
      const ratio = element.naturalWidth / element.naturalHeight;
      const fittedWidth = Math.min(width, height * ratio);
      const fittedHeight = fittedWidth / ratio;
      return {
        x: x + (width - fittedWidth) / 2,
        y: y + (height - fittedHeight) / 2,
        width: fittedWidth,
        height: fittedHeight
      };
    });
    const moveToChecker = fraction => page.mouse.move(x + width / 2, y + height * fraction);
    await moveToChecker(0.93);
    assert.equal(await image.getAttribute('src'), preview('First'));
    await moveToChecker(0.95);
    await displayed(page, '#original', preview('First_Checker'));
    await moveToChecker(0.93);
    await displayed(page, '#original', preview('First'));

    await segment(page, 2).hover();
    await displayed(page, '#original', preview('First_Wireframe'));
    await moveToChecker(0.93);
    await displayed(page, '#original', preview('First'));
    await segment(page, 2).click();
    await displayed(page, '#original', preview('First_Wireframe'));
    await moveToChecker(0.93);
    assert.equal(await image.getAttribute('src'), preview('First_Wireframe'));
    assert.deepEqual(errors, []);
  });
});


async function enlargeMapPreview(page, selector) {
  const stage = page.locator(selector);
  const card = stage.locator('.gallery-map-region').first();
  const point = await card.evaluate(card => {
    const stage = card.parentElement, bounds = stage.getBoundingClientRect();
    return { x: bounds.left + bounds.width * Number(card.dataset.x) / 100, y: bounds.top + bounds.height * Number(card.dataset.y) / 100 };
  });
  await page.mouse.move(point.x, point.y);
  await card.and(stage.locator('[aria-expanded="true"]')).waitFor();
  await page.waitForFunction(selector => {
    const stage = document.querySelector(selector), card = stage.querySelector('.is-open');
    return card && Math.abs(card.getBoundingClientRect().width / stage.getBoundingClientRect().width - .8) < .01;
  }, selector);
  return { card, point };
}

async function clickCollapsedMapRegion(page, selector, index = 0) {
  const card = page.locator(`${selector} .gallery-map-region`).nth(index);
  assert.equal(await card.getAttribute('aria-expanded'), 'false');
  await card.evaluate(card => {
    card.addEventListener('click', event => {
      window.collapsedMapClick = { expanded: card.getAttribute('aria-expanded'), trusted: event.isTrusted };
    }, { capture: true, once: true });
  });
  // Click directly, before the 400ms hover dwell can enlarge the thumbnail.
  await card.click();
  assert.deepEqual(await page.evaluate(() => window.collapsedMapClick), { expanded: 'false', trusted: true });
}

async function focusedMapScreenshotIsVisible(page, filename, t) {
  try {
    await page.waitForFunction(filename => {
      const target = [...document.querySelectorAll('.gallery-map-shot')].find(figure => figure.dataset.image === filename);
      const bounds = target?.getBoundingClientRect();
      const smoother = window.ScrollSmoother?.get();
      return target && document.activeElement === target && bounds.height > 0 && bounds.top >= -2 &&
        bounds.bottom <= innerHeight + 2 && (!smoother || Math.abs(smoother.scrollTop() - scrollY) < 1);
    }, filename);
  } catch (error) {
    const diagnostics = await page.evaluate(filename => {
      const target = [...document.querySelectorAll('.gallery-map-shot')].find(figure => figure.dataset.image === filename);
      const smoother = window.ScrollSmoother?.get(), content = document.querySelector('#gallery-scroll-content');
      const rect = element => {
        if (!element) return null;
        const { top, bottom, height } = element.getBoundingClientRect();
        return { top, bottom, height };
      };
      const focus = document.activeElement;
      const snapshot = {
        filename, focus: { tag: focus.tagName, id: focus.id, class: focus.className, image: focus.closest('.gallery-map-shot')?.dataset.image },
        targetFocused: focus === target, figure: rect(target), image: rect(target?.querySelector('.shot-primary')),
        innerHeight, clientHeight: document.documentElement.clientHeight, native: scrollY, rendered: smoother?.scrollTop(),
        maxScroll: document.scrollingElement.scrollHeight - document.documentElement.clientHeight,
        triggerEnd: smoother?.scrollTrigger.end, paused: smoother?.paused(),
        body: { margin: getComputedStyle(document.body).margin, height: document.body.style.height, scrollHeight: document.body.scrollHeight },
        content: { height: content.style.height, clientHeight: content.clientHeight, scrollHeight: content.scrollHeight },
        wrapperScrollTop: document.querySelector('#gallery-scroll-wrapper').scrollTop,
        previews: [...document.querySelectorAll('#public-map .gallery-map-region')].map(card => ({
          label: card.getAttribute('aria-label'), expanded: card.getAttribute('aria-expanded'),
          hovered: card.matches(':hover'), focusVisible: card.matches(':focus-visible'), class: card.className,
        })),
      };
      snapshot.smootherOffset = target && smoother ? smoother.offset(target, 'top top') : null;
      return snapshot;
    }, filename);
    t.diagnostic('Map navigation failure: ' + JSON.stringify(diagnostics));
    throw error;
  }
}

test('Atrium collapsed thumbnails select the exact gallery screenshot with GSAP and native scrolling', { timeout: 20_000 }, async t => {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    await t.test(reducedMotion === 'reduce' ? 'native reduced motion' : 'GSAP with keyboard navigation', async t => {
      const { page, errors } = await openPage(t, { map: true, width: 1440, diagnostics: true, reducedMotion });
      await page.locator('#public-map').waitFor({ state: 'visible' });
      if (reducedMotion === 'reduce') {
        await page.waitForFunction(() => window.PortfolioDiagnostics?.report?.().pages.at(-1)
          .features['gallery-smoother']?.mode === 'Native scrolling');
        assert.equal(await page.evaluate(() => Boolean(window.ScrollSmoother?.get())), false);
      } else {
        await gallerySmootherReady(page);
        // ScrollTrigger suppresses scrubbing for its first half-second.
        await page.evaluate(() => new Promise(resolve => window.gsap.delayedCall(.6, resolve)));
      }
      const before = await page.evaluate(() => scrollY);
      await clickCollapsedMapRegion(page, '#public-map');
      await focusedMapScreenshotIsVisible(page, 'Second.jpg', t);
      await displayed(page, '.gallery-map-shot[data-image="Second.jpg"] .shot-primary', preview('Second'));
      assert.equal(await page.locator('#viewer').evaluate(viewer => viewer.open), false);
      assert.equal(await page.locator('#public-map .is-open').count(), 0);
      assert.equal(await page.locator('#gallery-scroll-wrapper').evaluate(wrapper => wrapper.scrollTop), 0);
      const selectedPosition = await page.evaluate(() => scrollY);
      assert.ok(selectedPosition > before + 100, 'the selected screenshot is reached in the page scroller');
      await page.mouse.move(300, 300);
      await page.mouse.wheel(0, 120);
      await page.waitForFunction(position => {
        const smoother = window.ScrollSmoother?.get();
        return (smoother ? smoother.scrollTop() : scrollY) > position + 60;
      }, selectedPosition);

      if (reducedMotion === 'no-preference') {
        await page.waitForFunction(() =>
          window.PortfolioDiagnostics.report().pages.at(-1).tallies['gallery-wheel']?.['step completed'] >= 1);
        await page.mouse.move(5, 5);
        await page.evaluate(() => window.ScrollSmoother.get().scrollTo(0, false));
        await page.waitForFunction(() => scrollY < 1 && window.ScrollSmoother.get().scrollTop() < 1);
        await page.locator('#public-map .gallery-map-overview-button').evaluate(button => button.focus({ preventScroll: true }));
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        const keyboardCard = page.locator('#public-map .gallery-map-region').nth(1);
        assert.equal(await keyboardCard.evaluate(card => card === document.activeElement), true);
        assert.equal(await keyboardCard.getAttribute('aria-expanded'), 'false', 'keyboard focus keeps the thumbnail collapsed');
        await keyboardCard.evaluate(card => {
          // Exercise an instant reset and navigation in the same event turn.
          card.addEventListener('click', () => window.ScrollSmoother.get().scrollTo(0, false), {
            capture: true, once: true,
          });
        });
        await page.keyboard.press('Enter');
        await focusedMapScreenshotIsVisible(page, 'Third.jpg', t);
        assert.equal(await page.locator('#viewer').evaluate(viewer => viewer.open), false);
        assert.equal(await page.locator('#public-map .is-open').count(), 0);
      }
      assert.deepEqual(errors, []);
    });
  }
});

test('Atrium collapsed fullscreen thumbnails select an image at fit and exit to that gallery screenshot', { timeout: 15_000 }, async t => {
  const { page, errors } = await openPage(t, {
    map: true, width: 1440, diagnostics: true, reducedMotion: 'no-preference',
  });
  await page.locator('#map-fullscreen').waitFor();
  await gallerySmootherReady(page);
  const before = await galleryScrollPosition(page);
  await page.locator('#map-fullscreen').click();
  await page.locator('#fullscreen-map').waitFor({ state: 'visible' });
  await gallerySmootherReady(page, true);
  await clickCollapsedMapRegion(page, '#fullscreen-map');
  await displayed(page, '#original', preview('Second'));
  assert.equal(await page.locator('#counter').textContent(), '2 / 3');
  assert.equal(await page.locator('#fullscreen-map').isVisible(), false);
  // A hotspot navigation click must not bubble into the stage's delayed zoom toggle.
  await page.waitForTimeout(350);
  assert.deepEqual(await viewerTransform(page), { scale: 1, x: 0, y: 0 });
  assert.equal(await page.locator('#viewer').evaluate(viewer => viewer.open), true);
  assert.equal(await page.evaluate(() => document.fullscreenElement?.id), 'viewer-frame');
  assert.ok(Math.abs((await galleryScrollPosition(page)).rendered - before.rendered) < 2);
  await page.locator('#fullscreen').click();
  await page.locator('#viewer').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.fullscreenElement === null);
  await gallerySmootherReady(page);
  await page.waitForFunction(() => {
    const image = document.querySelector('.gallery-map-shot[data-image="Second.jpg"] .shot');
    const bounds = image.getBoundingClientRect();
    return document.activeElement === image && Math.abs(bounds.top + bounds.height / 2 - innerHeight / 2) < 2;
  });
  const restored = await galleryScrollPosition(page);
  assert.ok(restored.rendered > before.rendered + 100);
  assert.ok(Math.abs(restored.rendered - restored.native) < 2);
  assert.deepEqual(errors, []);
});

test('Atrium previews stay at 80 percent without navigating and share fullscreen mouse controls', async t => {
  const { page, errors } = await openPage(t, { map: true, width: 1440, diagnostics: true, reducedMotion: 'no-preference' });
  await page.locator('#public-map').waitFor({ state: 'visible' });
  await gallerySmootherReady(page);
  assert.equal(await page.locator('#map-error').isVisible(), false);
  assert.equal(await page.locator('.gallery-map-overview-button').evaluate(button => getComputedStyle(button).cursor), 'pointer');
  const normal = await enlargeMapPreview(page, '#public-map');
  const beforeClick = await page.evaluate(() => scrollY);
  await page.mouse.click(normal.point.x, normal.point.y);
  assert.equal(await normal.card.getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('#viewer').evaluate(viewer => viewer.open), false);
  assert.equal(await page.evaluate(() => scrollY), beforeClick);
  assert.equal(await page.locator('.gallery-map-shot:focus').count(), 0);

  await page.locator('#map-fullscreen').click();
  await page.locator('#fullscreen-map').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#stage > #viewer-canvas > #fullscreen-map').count(), 1);
  const fullscreen = await enlargeMapPreview(page, '#fullscreen-map');
  const beforeZoom = await page.evaluate(() => scrollY);
  await page.mouse.click(fullscreen.point.x, fullscreen.point.y);
  await waitForViewerScale(page, 2);
  assert.equal(await fullscreen.card.getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('#counter').textContent(), '1 / 3');
  assert.equal(await page.locator('#fullscreen-map').isVisible(), true);
  assert.equal(await page.evaluate(() => scrollY), beforeZoom);

  for (const [button, offset] of [['middle', 60], ['right', 120]]) {
    const mapBeforePan = await viewerTransform(page);
    await page.mouse.down({ button });
    await page.mouse.move(fullscreen.point.x + offset, fullscreen.point.y, { steps: 3 });
    await page.mouse.up({ button });
    const mapAfterPan = await viewerTransform(page);
    assert.equal(mapAfterPan.scale, 2);
    assert.ok(mapAfterPan.x > mapBeforePan.x, button);
    assert.equal(await fullscreen.card.getAttribute('aria-expanded'), 'true');
  }

  await page.mouse.dblclick(fullscreen.point.x + 120, fullscreen.point.y);
  await page.locator('#stage.zoomed').waitFor({ state: 'detached' });
  assert.deepEqual(await viewerTransform(page), { scale: 1, x: 0, y: 0 });
  assert.equal(await page.locator('#fullscreen-map').isVisible(), true);
  assert.equal(await page.evaluate(() => document.fullscreenElement?.id), 'viewer-frame');
  await page.locator('#fullscreen').press('Enter');
  await page.locator('#viewer').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.fullscreenElement === null);

  await page.locator('#map-fullscreen').click();
  await page.locator('#fullscreen-map').waitFor({ state: 'visible' });
  assert.equal((await viewerTransform(page)).scale, 1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => {
    window.mapWheelScales = [];
    document.querySelector('#viewer').addEventListener('gallery-zoomchange', event => window.mapWheelScales.push(event.detail.scale));
  });
  const mapBounds = await page.locator('#stage').boundingBox();
  await page.mouse.move(mapBounds.x + mapBounds.width / 2, mapBounds.y + mapBounds.height / 2);
  await modifiedWheel(page, 'Alt', 0, -120);
  await page.locator('#stage.zoomed').waitFor();
  const mapWheelScales = await page.evaluate(() => window.mapWheelScales);
  assert.equal(mapWheelScales.length, 1, 'reduced motion applies the wheel zoom in one update');
  assert.ok(mapWheelScales[0] > 1 && mapWheelScales[0] < 2);
  assert.equal(await page.locator('#fullscreen-map').isVisible(), true);
  assert.equal(await page.locator('#counter').textContent(), '1 / 3');
  await page.keyboard.press('ArrowRight');
  await displayed(page, '#original', preview('Second'));
  assert.equal(await page.locator('#fullscreen-map').isVisible(), false);
  await page.keyboard.press('ArrowLeft');
  await page.locator('#fullscreen-map').waitFor({ state: 'visible' });
  const wheelPoint = await page.locator('#stage').boundingBox();
  await page.mouse.move(wheelPoint.x + wheelPoint.width / 2, wheelPoint.y + wheelPoint.height / 2);
  await page.mouse.wheel(0, 160);
  await displayed(page, '#original', preview('Second'));
  assert.equal(await page.locator('#counter').textContent(), '2 / 3');
  await page.keyboard.press('Escape');
  await page.locator('#viewer').waitFor({ state: 'hidden' });
  assert.deepEqual(errors, []);
});

test('Atrium touch taps survive capture while pinch and pan suppress their trailing click', async t => {
  const { page, errors } = await openPage(t, { map: true, width: 412, hasTouch: true });
  const session = await page.context().newCDPSession(page);
  await page.locator('#map-fullscreen').tap();
  await page.locator('#fullscreen-map').waitFor({ state: 'visible' });
  const card = page.locator('#fullscreen-map .gallery-map-region').first();
  await card.tap();
  assert.equal(await card.getAttribute('aria-expanded'), 'true');
  assert.equal((await viewerTransform(page)).scale, 1);
  await card.tap();
  assert.equal(await card.getAttribute('aria-expanded'), 'false');
  await card.tap();
  assert.equal(await card.getAttribute('aria-expanded'), 'true');

  const stage = await page.locator('#stage').boundingBox();
  const x = stage.x + stage.width / 2, y = stage.y + stage.height / 2;
  await pinchInViewer(session, x, y, 30, 90);
  await page.locator('#stage.zoomed').waitFor();
  const pinched = await viewerTransform(page);
  assert.ok(pinched.scale > 1);
  // A compatibility click is not emitted for every OS/browser gesture. Exercise
  // that event explicitly after real touch input so it cannot toggle a hotspot.
  await card.dispatchEvent('click', { bubbles: true, cancelable: true, detail: 1, button: 0 });
  assert.equal(await card.getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('#counter').textContent(), '1 / 3');
  await swipeInViewer(session, [x - 45, y], [x + 45, y]);
  const panned = await viewerTransform(page);
  assert.equal(panned.scale, pinched.scale);
  assert.notEqual(panned.x, pinched.x);
  await card.dispatchEvent('click', { bubbles: true, cancelable: true, detail: 1, button: 0 });
  assert.equal(await card.getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('#counter').textContent(), '1 / 3');
  // Keyboard activation remains available despite the trailing pointer-click guard.
  await card.dispatchEvent('click', { bubbles: true, cancelable: true, detail: 0 });
  assert.equal(await card.getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator('#viewer').evaluate(viewer => viewer.open), true);
  assert.equal(await page.locator('#counter').textContent(), '1 / 3');
  assert.equal(await page.locator('#fullscreen-map').isVisible(), true);
  assert.deepEqual(errors, []);
});

async function viewerGeometry(page) {
  return page.evaluate(() => {
    const image = document.querySelector('#original'), bounds = image.getBoundingClientRect();
    const ratio = image.naturalWidth / image.naturalHeight;
    const width = Math.min(bounds.width, bounds.height * ratio), height = width / ratio;
    const drawn = { x: bounds.left + (bounds.width - width) / 2, y: bounds.top + (bounds.height - height) / 2, width, height };
    const controls = ['#previous-side', '#next-side', '#viewer .comparison-indicator'].map(selector => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return { selector, x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    });
    return { image: drawn, controls };
  });
}

function assertAnchored(before, after) {
  const scale = after.image.width / before.image.width;
  for (let i = 0; i < before.controls.length; i++) {
    const a = before.controls[i], b = after.controls[i];
    for (const [actual, expected, label] of [
      [b.width, a.width * scale, 'width'], [b.height, a.height * scale, 'height'],
      [b.x - after.image.x, (a.x - before.image.x) * scale, 'horizontal anchor'],
      [b.y - after.image.y, (a.y - before.image.y) * scale, 'vertical anchor']
    ]) assert.ok(Math.abs(actual - expected) < 1.5, `${a.selector} ${label}: ${actual} versus ${expected}`);
  }
}

test('pinch and pan keep arrows and comparison strip attached to the image without focus scrolling', async t => {
  const { page, errors } = await openPage(t, { width: 412, hasTouch: true });
  const session = await page.context().newCDPSession(page);
  await page.locator('.shot').first().tap();
  await displayed(page, '#original', preview('First'));
  await segment(page, 0).waitFor({ state: 'visible' });
  const initial = await viewerGeometry(page);
  for (const control of initial.controls) assert.ok(control.width > 0 && control.height > 0, control.selector);
  const stage = await page.locator('#stage').boundingBox();
  const x = stage.x + stage.width / 2, y = stage.y + stage.height / 2;
  await pinchInViewer(session, x, y, 30, 90);
  await page.locator('#stage.zoomed').waitFor();
  const zoomed = await viewerGeometry(page);
  assert.ok(zoomed.image.width > initial.image.width * 1.5);
  assertAnchored(initial, zoomed);
  await swipeInViewer(session, [x - 45, y], [x + 45, y]);
  const panned = await viewerGeometry(page);
  assert.ok(Math.abs(panned.image.x - zoomed.image.x) > 10);
  assertAnchored(zoomed, panned);
  assert.equal(await page.locator('#counter').textContent(), '1 / 3');

  const offsets = () => page.evaluate(() => Object.fromEntries(['#stage', '#viewer-canvas', '#viewer-frame', '#viewer'].map(selector => {
    const element = document.querySelector(selector);
    return [selector, { x: element.scrollLeft, y: element.scrollTop }];
  })));
  const expectedOffsets = await offsets();
  assert.deepEqual(expectedOffsets['#stage'], { x: 0, y: 0 });
  const transform = await viewerTransform(page);
  // Visit every enabled dialog control once, including a zoomed-offscreen arrow
  // and comparison segments. Focus must not introduce a second pan mechanism.
  const focusTargets = new Set();
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('Tab');
    focusTargets.add(await page.evaluate(() => document.activeElement.id || document.activeElement.getAttribute('aria-label')));
    assert.deepEqual(await offsets(), expectedOffsets);
    assert.deepEqual(await viewerTransform(page), transform);
  }
  assert.ok(focusTargets.has('next-side'), 'Tab reaches the next-image arrow');
  assert.ok([...focusTargets].some(label => /^Show variant/.test(label || '')), 'Tab reaches the comparison strip');
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





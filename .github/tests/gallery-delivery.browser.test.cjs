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
const backToTop = read('_includes/gallery-back-to-top.html');
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
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    args: ['--enable-blink-features=MiddleClickAutoscroll'],
  });
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
    .replace('{% include gallery-back-to-top.html %}', backToTop)
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
      .replace('{{ portfolio_url | relative_url }}', '/')
      .replace('{% include gallery-back-to-top.html %}', backToTop) + scripts(lockedLayout)
      .replace('{{ site.data.gallery_delivery.service_origin | jsonify }}', JSON.stringify(media))
    : `<div class="gallery-content"><header class="intro"><h1>Hard Bullet - Egypt</h1></header>
        <p id="gallery-status" hidden></p>
        <section class="gallery" data-grouped-image-scroll${embeds ? ' data-gallery-embeds="gallery-embeds.json"' : ''}>${galleryLayout.match(/<a class="shot" data-gallery-fallback[\s\S]*?<\/a>/)[0]
          .replace('{{ gallery_original_url | escape }}', `${gallery}First.jpg?v=test`)
          .replaceAll('{{ reduced_image_url }}', preview('First').replace('&', '&amp;'))
          .replace('{{ site.gallery_4k_media | escape }}', desktopQuery)
          .replace('{{ first_image_url | escape }}', originals('First'))
          .replaceAll('{{ gallery_page.gallery_title | escape }}', 'Hard Bullet - Egypt')}</section></div>
        ${backToTop}${galleryViewer}${scripts(galleryLayout)}`;
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
  map = false, diagnostics = false, reducedMotion, cacheImages = false, galleryEntries = manifest,
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
      return request.fulfill({ json: galleryEntries });
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

async function assertViewerControlStyles(page, { touch = false } = {}) {
  const { surface, arrows, bar } = await page.evaluate(() => {
    const read = selector => {
      const style = getComputedStyle(document.querySelector(selector));
      return {
        background: style.backgroundColor, image: style.backgroundImage, border: style.borderTopColor,
        borderWidth: style.borderTopWidth,
        radius: style.borderTopLeftRadius, shadow: style.boxShadow, color: style.color
      };
    };
    return {
      surface: read('.gallery-back-to-top'),
      arrows: ['#previous-side', '#next-side'].map(read),
      bar: ['#fullscreen', '#counter'].map(read)
    };
  });
  assert.equal(surface.background, 'rgb(24, 24, 24)');
  assert.equal(surface.image, 'none');
  const blackSurface = { ...surface, background: 'rgb(0, 0, 0)' };
  assert.deepEqual(bar, [blackSurface, blackSurface]);
  if (touch) {
    for (const arrow of arrows) {
      assert.equal(arrow.background, 'rgba(0, 0, 0, 0)');
      assert.equal(arrow.image, 'none');
      assert.equal(arrow.borderWidth, '0px');
      assert.equal(arrow.shadow, 'none');
    }
  } else {
    assert.deepEqual(arrows, [surface, surface]);
  }
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

test('gallery comparisons preload for the visible image and its next neighbor', async t => {
  const galleryEntries = [
    manifest[0],
    { ...manifest[1], compare: 'Second_Checker.jpg' },
    { ...manifest[2], compare: 'Third_Checker.jpg' },
  ];
  const { page, requests, errors, urls: { preview } } = await openPage(t, {
    route: '/artur' + gallery, width: 1440, cacheImages: true, galleryEntries,
  });
  await displayed(page, '.shot-comparison[src*="First_Checker"]', preview('First_Checker'));
  await displayed(page, '.shot-comparison[src*="First_Wireframe"]', preview('First_Wireframe'));
  await displayed(page, '.shot-comparison[src*="Second_Checker"]', preview('Second_Checker'));
  assert.ok(!requests.includes(preview('Third_Checker')));
  assert.equal(await page.locator('.shot-comparison.is-visible').count(), 0);
  assert.equal(await page.locator('.shot-comparison[src*="Second_Checker"]').getAttribute('fetchpriority'), 'low');

  await page.locator('.shot').nth(1).evaluate(shot => shot.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await displayed(page, '.shot-comparison[src*="Third_Checker"]', preview('Third_Checker'));
  await page.locator('.shot-entry').nth(1).locator('.comparison-indicator button').nth(1).press('Enter');
  await displayed(page, '.shot-comparison.is-visible', preview('Second_Checker'));
  onceEach(requests, preview('First_Checker'), preview('First_Wireframe'), preview('Second_Checker'), preview('Third_Checker'));
  assert.deepEqual(errors, []);
});

test('fullscreen preloads the next comparison even when the current image has no variants', async t => {
  const galleryEntries = [
    ...manifest,
    { image: 'Fourth.jpg', compare: 'Fourth_Checker.jpg' },
    { image: 'Fifth.jpg', compare: 'Fifth_Checker.jpg' },
  ];
  const { page, requests, errors, urls: { preview } } = await openPage(t, {
    width: 1440, cacheImages: true, galleryEntries,
  });
  await page.locator('.shot').last().waitFor({ state: 'attached' });
  assert.ok(await page.evaluate(() => window.GalleryViewer.openImage('Third.jpg')));
  await displayed(page, '#original', preview('Third'));
  await displayed(page, '.shot-comparison[src*="Fourth_Checker"]', preview('Fourth_Checker'));
  assert.ok(!requests.includes(preview('Fifth_Checker')));

  await page.locator('#next-side').press('Enter');
  await displayed(page, '#original', preview('Fourth'));
  await displayed(page, '.shot-comparison[src*="Fifth_Checker"]', preview('Fifth_Checker'));
  await segment(page, 1).press('Enter');
  await displayed(page, '#original', preview('Fourth_Checker'));
  await activeSegment(page, 1);
  onceEach(requests, preview('Fourth_Checker'), preview('Fifth_Checker'));
  assert.deepEqual(errors, []);
});

test('selecting a comparison can retry a failed background preload', { timeout: 12_000 }, async t => {
  const failedPreview = signal();
  let originalAttempts = 0;
  const { page, errors, urls: { originals } } = await openPage(t, {
    cacheImages: true,
    intercept: async (request, url, { originals, preview }) => {
      if (url.href === originals('First_Checker') && ++originalAttempts <= 2) {
        await request.fulfill({ status: 503 });
        return true;
      }
      if (url.href !== preview('First_Checker')) return false;
      await request.fulfill({ status: 503 });
      failedPreview.release();
      return true;
    },
  });
  await failedPreview.reached;
  await page.locator('.shot-comparison[src*="First_Checker"]').waitFor({ state: 'detached' });
  await page.locator('.shot-entry .comparison-indicator button').nth(1).press('Enter');
  await displayed(page, '.shot-comparison.is-visible', originals('First_Checker'));
  assert.equal(originalAttempts, 3);
  assert.deepEqual(errors, []);
});

test('middle-click on a gallery image starts native autoscroll without opening a tab', async t => {
  const galleries = [
    ['studio gallery', {}],
    ['personal gallery', { route: '/artur' + gallery }],
    ['interactive map screenshots', { map: true }],
  ];
  for (const [name, options] of galleries) {
    await t.test(name, async t => {
      const { page, errors } = await openPage(t, { width: 1440, reducedMotion: 'reduce', ...options });
      await page.locator('.shot').nth(2).waitFor({ state: 'attached' });
      const shot = page.locator('.shot').first();
      await shot.scrollIntoViewIfNeeded();
      const href = await shot.getAttribute('href');
      const { x, y, width, height } = await shot.boundingBox();
      const mouseX = x + width / 2;
      const mouseY = Math.max(0, y) + Math.min(height / 2, 96);
      assert.ok(await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('a.shot')),
        { x: mouseX, y: mouseY }), 'middle-click starts on a gallery image');
      const start = await page.evaluate(() => window.scrollY);

      await page.mouse.click(mouseX, mouseY, { button: 'middle' });
      await page.mouse.move(mouseX, Math.min(page.viewportSize().height - 5, mouseY + 230));

      await page.waitForFunction(start => window.scrollY > start + 20, start, { timeout: 2200 });
      assert.equal(page.context().pages().length, 1);
      assert.equal(await shot.getAttribute('href'), href);
      assert.ok(!await page.locator('#viewer').isVisible());
      assert.deepEqual(errors, []);
    });
  }
});

test('widening an open fullscreen viewer upgrades its selected WebP to the original', async t => {
  const { page, requests, errors, urls } = await openPage(t, { width: 1440 });
  await page.locator('.shot').first().press('Enter');
  await displayed(page, '#original', urls.preview('First'));
  assert.ok(!requests.includes(urls.originals('First')));
  await page.setViewportSize({ width: 2800, height: 1000 });
  await displayed(page, '#original', urls.originals('First'));
  await activeSegment(page, 0);
  assert.deepEqual(errors, []);
});

test('published replacements refresh both image sizes, including an open fullscreen viewer', async t => {
  let replacement = 'b'.repeat(40);
  const updatedPath = () => `/public-replacements/hb-egypt/${replacement}/`;
  const { page, errors, urls } = await openPage(t, {
    width: 1440,
    intercept: async (route, url) => {
      if (url.pathname === '/public-replacements/hb-egypt.json') {
        await route.fulfill({ json: { images: { 'First.jpg': replacement } },
          headers: { 'Access-Control-Allow-Origin': '*' } });
        return true;
      }
      if (url.pathname === updatedPath() + '1440p/First.jpg') {
        await route.fulfill({ contentType: 'image/webp', body: webp });
        return true;
      }
      return false;
    },
  });
  await displayed(page, '.shot-primary', urls.media + updatedPath() + '1440p/First.jpg');
  await page.locator('.shot').first().press('Enter');
  await displayed(page, '#original', urls.media + updatedPath() + 'First.jpg');

  replacement = 'c'.repeat(40);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await displayed(page, '#original', urls.media + updatedPath() + 'First.jpg');
  await page.locator('#fullscreen').click();
  await displayed(page, '.shot-primary', urls.media + updatedPath() + '1440p/First.jpg');
  assert.deepEqual(errors, []);
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

test('fullscreen hover acknowledges a slow comparison and clears it after a change of target', { timeout: 12_000 }, async t => {
  const checkerStarted = signal();
  const releaseChecker = signal();
  t.after(releaseChecker.release);
  const { page, errors } = await openPage(t, {
    width: 1440,
    intercept: async (_request, url, { preview }) => {
      if (url.href === preview('First_Checker')) {
        checkerStarted.release();
        await releaseChecker.reached;
      }
      return false;
    },
  });
  const checker = segment(page, 1);
  const status = page.locator('#status');
  await page.locator('.shot').first().click();
  await displayed(page, '#original', preview('First'));
  await checkerStarted.reached;
  await checker.hover();
  assert.equal(await checker.getAttribute('aria-busy'), 'true');
  assert.equal(await status.textContent(), 'Loading comparison…');
  await activeSegment(page, 0);
  assert.equal(await checker.evaluate(button => getComputedStyle(button, '::before').backgroundColor), 'rgb(119, 119, 119)');
  assert.equal(await segment(page, 0).evaluate(button => getComputedStyle(button, '::before').backgroundColor), 'rgb(255, 255, 255)');

  await segment(page, 2).hover();
  await displayed(page, '#original', preview('First_Wireframe'));
  await activeSegment(page, 2);
  assert.equal(await checker.getAttribute('aria-busy'), null);
  assert.equal(await status.isHidden(), true);

  await checker.hover();
  assert.equal(await checker.getAttribute('aria-busy'), 'true');
  releaseChecker.release();
  await displayed(page, '#original', preview('First_Checker'));
  await activeSegment(page, 1);
  assert.equal(await checker.getAttribute('aria-busy'), null);
  assert.equal(await status.isHidden(), true);
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
  assert.equal(await segment(page, 1).getAttribute('aria-busy'), 'true');
  assert.equal(await page.locator('#status').textContent(), 'Loading comparison…');
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
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'This comparison could not be loaded.');
  assert.equal(await segment(page, 1).getAttribute('aria-busy'), null);
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

async function gallerySmootherLayoutReady(page) {
  await page.waitForLoadState('load');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].filter(image => {
    const bounds = image.getBoundingClientRect();
    return bounds.width > 0 && bounds.height > 0 && bounds.bottom > 0 && bounds.top < innerHeight;
  }).every(image => image.complete && image.naturalWidth > 0));
  // ScrollSmoother 3.15.1 has a .5s initialization phase. Let startup and the
  // page controller's observed layout changes settle before measuring interpolation.
  await page.waitForTimeout(600);
  await page.waitForFunction(() => window.ScrollSmoother.get().scrollTrigger.end > 0 &&
    !window.ScrollTrigger.isRefreshing && !window.ScrollSmoother.isRefreshing);
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
  await gallerySmootherLayoutReady(page);
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
  await t.test('content-size refresh preserves the view and updates the scroll extent', async () => {
    const snapshot = () => page.evaluate(() => {
      const smoother = window.ScrollSmoother.get();
      return { native: scrollY, rendered: smoother.scrollTop(), end: smoother.scrollTrigger.end,
        max: document.scrollingElement.scrollHeight - document.documentElement.clientHeight,
        contentHeight: smoother.content().clientHeight,
        imageTop: document.querySelector('#map-screenshots .shot-primary').getBoundingClientRect().top };
    });
    const before = await snapshot();
    assert.ok(before.rendered > 100, 'refresh is checked away from the top of the page');
    try {
      await page.evaluate(() => {
        const block = document.createElement('div');
        block.id = 'gallery-test-late-content';
        block.style.height = '320px';
        document.querySelector('#gallery-scroll-content').append(block);
      });
      // No explicit refresh: the owned content ResizeObserver must update the extent.
      await page.waitForFunction(before => {
        const smoother = window.ScrollSmoother.get();
        return Math.abs(smoother.scrollTrigger.end - before.end - 320) < 1 &&
          Math.abs(document.scrollingElement.scrollHeight - document.documentElement.clientHeight - before.max - 320) < 1;
      }, before);
      const grown = await snapshot();
      assert.equal(grown.contentHeight - before.contentHeight, 320);
      assert.ok(Math.abs(grown.native - before.native) < 2);
      assert.ok(Math.abs(grown.rendered - before.rendered) < 2);
      assert.ok(Math.abs(grown.imageTop - before.imageTop) < 2);
    } finally {
      await page.evaluate(() => document.querySelector('#gallery-test-late-content')?.remove());
    }
    await page.waitForFunction(before => {
      const smoother = window.ScrollSmoother.get();
      return Math.abs(smoother.scrollTrigger.end - before.end) < 1 &&
        Math.abs(document.scrollingElement.scrollHeight - document.documentElement.clientHeight - before.max) < 1;
    }, before);
    const restored = await snapshot();
    assert.equal(restored.contentHeight, before.contentHeight);
    assert.ok(Math.abs(restored.native - before.native) < 2);
    assert.ok(Math.abs(restored.rendered - before.rendered) < 2);
    assert.ok(Math.abs(restored.imageTop - before.imageTop) < 2);
  });
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
  await gallerySmootherLayoutReady(page);
  await page.evaluate(() => {
    window.atriumSmootherInstance = window.ScrollSmoother.get();
    window.atriumSmootherInstance.scrollTo(120, false);
  });
  await page.waitForFunction(() => Math.abs(window.ScrollSmoother.get().scrollTop() - 120) < 1 && Math.abs(scrollY - 120) < 1);
  await overview.evaluate(button => button.focus({ preventScroll: true }));
  const before = await galleryScrollPosition(page);
  await overview.press('Enter');
  await page.locator('#fullscreen-map').waitFor({ state: 'visible' });
  await gallerySmootherReady(page, true);
  const pausedBeforeRefresh = await galleryScrollPosition(page);
  await page.evaluate(() => window.ScrollTrigger.refresh());
  await gallerySmootherReady(page, true);
  const pausedAfterRefresh = await galleryScrollPosition(page);
  assert.ok(Math.abs(pausedAfterRefresh.native - pausedBeforeRefresh.native) < 2);
  assert.ok(Math.abs(pausedAfterRefresh.rendered - pausedBeforeRefresh.rendered) < 2);
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
  await assertViewerControlStyles(page, { touch: true });
  await page.locator('#next-side').tap();
  await displayed(page, '#original', preview('Second'));
  await page.locator('#previous-side').tap();
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

test('a touch tap exits fullscreen after a swipe even when Chrome omits the click', async t => {
  const { page, errors } = await openPage(t, { width: 412, hasTouch: true });
  const session = await page.context().newCDPSession(page);
  await page.locator('.shot').first().tap();
  await displayed(page, '#original', preview('First'));

  const stage = await page.locator('#stage').boundingBox();
  const x = stage.x + stage.width / 2;
  const y = stage.y + stage.height / 2;
  await swipeInViewer(session, [x + 70, y], [x - 70, y]);
  await displayed(page, '#original', preview('Second'));

  const exit = page.locator('#fullscreen');
  await exit.evaluate(button => button.addEventListener('click', event => {
    // Model Chromium's post-swipe tap suppression without relying on its timing.
    event.stopImmediatePropagation();
  }, { capture: true }));
  const box = await exit.boundingBox();
  const midY = box.y + box.height / 2;
  await swipeInViewer(session, [box.x + 10, midY], [box.x + box.width - 10, midY]);
  assert.equal(await page.locator('#viewer').evaluate(viewer => viewer.open), true, 'dragging across Exit does not close the viewer');
  await exit.evaluate(button => button.addEventListener('touchend', () => {
    window.viewerOpenAtTouchEnd = document.querySelector('#viewer').open;
  }, { once: true }));
  await exit.tap();
  await page.locator('#viewer[open]').waitFor({ state: 'hidden', timeout: 2500 });
  assert.equal(await page.evaluate(() => window.viewerOpenAtTouchEnd), true, 'the release stays on the viewer, including in landscape');
  assert.deepEqual(errors, []);
});

test('desktop fullscreen controls fade when idle and return on mouse movement or keyboard use', async t => {
  const { page, errors } = await openPage(t, { width: 1440 });
  const first = page.locator('.shot').first();
  await first.click();
  await displayed(page, '#original', preview('First'));

  const arrows = await page.locator('.viewer-arrows button').evaluateAll(buttons => buttons.map(button => {
    const range = document.createRange();
    range.selectNodeContents(button);
    const top = range.getBoundingClientRect().top;
    const height = button.getBoundingClientRect().height;
    button.style.paddingBottom = '0px';
    const centeredTop = range.getBoundingClientRect().top;
    button.style.removeProperty('padding-bottom');
    return { offset: top - centeredTop, height };
  }));
  assert.deepEqual(arrows, [{ offset: -2, height: 48 }, { offset: -2, height: 48 }]);

  const controlsOpacity = opacity => page.waitForFunction(value => {
    return ['.viewer-arrows', '.viewer-bar'].every(selector =>
      Number(getComputedStyle(document.querySelector(selector)).opacity) === value);
  }, opacity);
  await controlsOpacity(1);
  await controlsOpacity(0);
  const targets = page.locator('#previous-side, #next-side, #fullscreen, #counter');
  assert.deepEqual(await targets.evaluateAll(elements => elements.map(element => getComputedStyle(element).pointerEvents)),
    ['none', 'none', 'none', 'none']);

  await page.mouse.move(40, 100);
  await controlsOpacity(1);
  assert.deepEqual(await targets.evaluateAll(elements => elements.map(element => getComputedStyle(element).pointerEvents)),
    ['auto', 'auto', 'auto', 'auto']);

  await controlsOpacity(0);
  await page.keyboard.press('Shift+Tab');
  await controlsOpacity(1);
  assert.equal(await page.evaluate(() => document.querySelector('#viewer').contains(document.activeElement)), true);
  await page.keyboard.press('ArrowRight');
  await displayed(page, '#original', preview('Second'));
  await page.locator('#fullscreen').click();
  await page.locator('#viewer').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.fullscreenElement === null);
  await first.click();
  await controlsOpacity(1);
  assert.deepEqual(errors, []);
});

test('fullscreen desktop left click toggles zoom, middle and right drag pan, and double-click fits', async t => {
  const { page, errors } = await openPage(t, { width: 1440 });
  const firstShot = page.locator('.shot').first();
  const viewer = page.locator('#viewer');
  const zoomedStage = page.locator('#stage.zoomed');
  await firstShot.click();
  await displayed(page, '#original', preview('First'));
  await assertViewerControlStyles(page);
  const exit = page.locator('#fullscreen');
  await exit.hover();
  assert.equal(await exit.evaluate(button => getComputedStyle(button).backgroundColor), 'rgb(0, 0, 0)');
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

test('desktop gallery viewport resize preserves the visible part of the same image', async t => {
  const width = 1920;
  const entries = Array.from({ length: 10 }, (_, index) => ({ image: 'Screenshot-' + (index + 1) + '.jpg' }));
  for (const route of [gallery, '/artur' + gallery, '/artur' + locked]) {
    await t.test(route, async t => {
      const protectedGallery = route.endsWith(locked);
      const embeds = protectedGallery ? undefined : [
        { type: 'video', file: 'preview.mp4', title: 'Preview', after: entries[8].image },
      ];
      const { page, errors } = await openPage(t, {
        route, width, embeds,
        async intercept(request, url) {
          if (url.pathname === '/unlock') {
            await request.fulfill({ json: { token: 'fixture-token', expiresAt: Date.now() + 60_000 } });
          } else if ([gallery + 'gallery.json', '/media/gallery.json'].includes(url.pathname)) {
            await request.fulfill({ json: entries });
          } else return false;
          return true;
        },
      });
      if (protectedGallery) {
        await page.locator('#gallery-password').fill('fixture-password');
        await page.locator('button[type="submit"]').press('Enter');
      }
      await page.waitForFunction(length => {
        const images = [...document.querySelectorAll('.gallery .shot-primary')];
        return images.length === length && images.every(image => image.complete && image.naturalWidth > 0);
      }, entries.length);
      const shot = index => page.locator('.gallery .shot').nth(index);
      const sample = row => row.evaluate(element => {
        const { top, height } = element.getBoundingClientRect();
        return { center: document.documentElement.clientHeight / 2, top, height };
      });
      async function resize(height) {
        await page.setViewportSize({ width, height });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      }
      async function centerRow(row, fraction) {
        await row.evaluate(async (element, fraction) => {
          const { top, height } = element.getBoundingClientRect();
          window.scrollTo({
            top: scrollY + top + height * fraction - document.documentElement.clientHeight / 2, behavior: 'instant',
          });
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        }, fraction);
      }

      await resize(990);
      assert.equal(await page.evaluate(() => scrollY), 0);
      await resize(900);
      const rows = [[shot(1), .5], [shot(8), .35]];
      if (embeds) rows.push([page.locator('.gallery-embed'), .25]);
      for (const [row, fraction] of rows) {
        await centerRow(row, fraction);
        const before = await sample(row);
        const position = (before.center - before.top) / before.height;
        assert.ok(Math.abs(position - fraction) < .01);
        for (const height of [990, 900]) {
          await resize(height);
          const after = await sample(row);
          assert.equal(after.center, height / 2);
          if (height === 990) assert.ok(after.height > before.height + 60, 'the viewport change grows the row');
          const drift = Math.abs(after.top + position * after.height - after.center);
          assert.ok(drift <= 2, 'same point remains centered after resize, drift ' + drift.toFixed(2) + 'px');
        }
      }

      await page.evaluate(async () => {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      await resize(990);
      assert.ok(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight - scrollY <= 1),
        'the bottom of the page stays at the bottom');
      assert.deepEqual(errors, []);
    });
  }
});

test('both homepages and galleries return to the top with ordinary scrolling', async t => {
  for (const route of ['/', '/artur/', gallery, '/artur' + gallery]) {
    await t.test(route, async t => {
      const home = route === '/' || route === '/artur/';
      const { page, errors } = await openPage(t, {
        route, width: 1440, reducedMotion: 'no-preference',
        async intercept(request, url) {
          if (!home || url.pathname !== route) return false;
          await request.fulfill({ contentType: 'text/html', body: `<!doctype html>
            <main data-page-scroll-motion style="height:2400px"></main>
            <script src="/assets/page-scroll-motion.js"></script>` });
          return true;
        },
      });
      if (!home) await page.locator('.gallery .shot').nth(2).waitFor({ state: 'attached' });
      await page.evaluate(async home => {
        const content = document.querySelector(home ? 'main' : '.gallery-content');
        content.setAttribute('data-page-scroll-motion', '');
        const animate = content.animate;
        content.animate = function(frames, options) {
          window.topArrival = true;
          return animate.call(this, frames, options);
        };
        window.scrollTo({ top: 66, behavior: 'instant' });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }, home);
      assert.equal(await page.evaluate(() => window.topArrival), undefined);
      await page.mouse.move(12, 12);
      await page.mouse.wheel(0, -200);
      await page.waitForFunction(() => scrollY === 0);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.evaluate(() => window.topArrival), undefined);
      assert.deepEqual(errors, []);
    });
  }
});

test('page-end motion rebounds without changing the scroll limit', async t => {
  for (const scene of ['gallery', 'Atrium', 'reduced motion']) {
    await t.test(scene, async t => {
      const map = scene === 'Atrium';
      const reducedMotion = scene === 'reduced motion' ? 'reduce' : 'no-preference';
      const { page, errors } = await openPage(t, { width: 1440, map, diagnostics: map, reducedMotion });
      const surface = map ? '#map-screenshots' : '.gallery-content';
      await page.locator(surface + ' .shot-primary').nth(2).waitFor();
      if (map) {
        await gallerySmootherReady(page);
        await gallerySmootherLayoutReady(page);
      }

      await page.evaluate(({ surface, map }) => {
        const content = document.querySelector(surface);
        if (!map) {
          content.setAttribute('data-page-scroll-motion', '');
          const gutter = document.createElement('footer');
          gutter.style.height = '80px';
          content.after(gutter);
        }
        window.bottomMotion = { starts: 0, limit: document.scrollingElement.scrollHeight - innerHeight };
        const animate = content.animate;
        content.animate = function(frames, options) {
          window.bottomMotion.starts++;
          window.bottomMotion.duration = options.duration;
          window.bottomMotion.offsets = frames.map(frame => Number.parseFloat(frame.translate.split(' ')[1]));
          const animation = animate.call(this, frames, options);
          animation.oncancel = () => { window.bottomMotion.cancelled = true; };
          return animation;
        };
        const limit = window.bottomMotion.limit;
        if (map) window.ScrollSmoother.get().scrollTo(limit, false);
        else window.scrollTo({ top: limit, behavior: 'instant' });
      }, { surface, map });

      if (reducedMotion === 'reduce') {
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.equal(await page.evaluate(() => window.bottomMotion.starts), 0);
      } else {
        await page.waitForFunction(() => window.bottomMotion.starts === 1);
        const track = await page.evaluate(() => window.bottomMotion);
        assert.equal(track.offsets[0], 0);
        assert.equal(track.duration, 1120);
        assert.equal(Math.min(...track.offsets), -30);
        assert.ok(Math.max(...track.offsets) > 8);
        assert.ok(track.offsets.at(-1) === 0);
        assert.equal(await page.evaluate(() => document.scrollingElement.scrollHeight - innerHeight), track.limit);
        await page.mouse.wheel(0, -120);
        await page.waitForFunction(() => window.bottomMotion.cancelled);
      }
      assert.deepEqual(errors, []);
    });
  }
});

test('studio About Us uses power4.out and reaches its anchor during startup', async t => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  t.after(() => page.close());
  page.setDefaultTimeout(5000);
  const startupImage = signal();
  t.after(startupImage.release);
  const markup = `<!doctype html><link rel="stylesheet" href="/assets/site.css">
    <link rel="stylesheet" href="/assets/home-sections.css">
    <body class="portfolio-page portfolio-home">
      <header class="site-header" style="position:sticky;top:0;height:80px">
        <nav class="site-nav"><a href="#portfolio" data-home-link="portfolio">Portfolio</a>
        <a href="#about-us" data-home-link="about">About Us</a></nav>
      </header>
      <main data-page-scroll-motion><div id="portfolio" style="height:2200px"></div>
        <section id="about-us" style="height:340px"><h2>About Us</h2></section>
      </main><footer style="height:64px">Copyright<img src="/startup.jpg" width="1" height="1" alt=""></footer>
      <script src="/assets/vendor/gsap/3.15.1/gsap.min.js"></script>
      <script src="/assets/home-sections.js"></script>
      <script src="/assets/page-scroll-motion.js"></script>
    </body>`;
  await page.route('http://localhost:3000/**', async route => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/') return route.fulfill({ contentType: 'text/html', body: markup });
    if (pathname === '/startup.jpg') {
      await startupImage.reached;
      return route.fulfill({ contentType: 'image/jpeg', body: jpeg });
    }
    return route.fulfill({ path: resolve(root, pathname.slice(1)) });
  });
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    window.aboutPageShown = false;
    window.addEventListener('pageshow', () => { window.aboutPageShown = true; }, { once: true });
    window.aboutEases = [];
    window.aboutScrollWrites = [];
    window.extraSprings = 0;
    const scroll = window.scrollTo;
    window.scrollTo = function(options) {
      scroll.call(window, options);
      window.aboutScrollWrites.push(scrollY);
    };
    const to = window.gsap.to;
    window.gsap.to = function(target, vars) {
      window.aboutEases.push({ ease: vars.ease, duration: vars.duration, top: vars.top });
      return to.call(this, target, vars);
    };
    const content = document.querySelector('[data-page-scroll-motion]');
    const animate = content.animate;
    content.animate = function(frames, options) {
      window.extraSprings++;
      return animate.call(this, frames, options);
    };
  });
  await page.getByRole('link', { name: 'About Us' }).click();
  await page.waitForFunction(() => scrollY > 20);
  assert.equal(await page.evaluate(() => window.aboutPageShown), false);
  startupImage.release();
  await page.waitForFunction(() => window.aboutPageShown);
  await page.waitForFunction(() => document.activeElement?.id === 'about-us');
  assert.equal(new URL(page.url()).hash, '#about-us');
  const phases = await page.evaluate(() => window.aboutEases);
  assert.equal(phases.length, 1);
  assert.equal(phases[0].top, await page.evaluate(() => scrollY));
  const writes = await page.evaluate(() => window.aboutScrollWrites);
  assert.ok(writes.length > 10 && writes.every((top, i) => i === 0 || top >= writes[i - 1]),
    'the rendered page never moves backwards');
  assert.equal(phases[0].ease, 'power4.out');
  assert.ok(phases[0].duration >= .65 && phases[0].duration <= 1.2);
  assert.equal(await page.evaluate(() => window.extraSprings), 0);
  assert.equal(await page.evaluate(() => document.scrollingElement.scrollHeight - innerHeight - scrollY), 0);
});

test('back to top follows the gallery scroll and respects the active scroll controller', async t => {
  await t.test('desktop button fades in and out, stays in the gutter and restores keyboard focus', async t => {
    const { page, errors } = await openPage(t, { width: 2300, reducedMotion: 'no-preference', diagnostics: true });
    const button = page.locator('.gallery-back-to-top');
    await displayed(page, '.shot-primary', preview('First'));
    assert.equal(await button.isVisible(), false);
    await button.evaluate(control => {
      window.topButtonFades = [];
      control.addEventListener('transitionend', event => {
        if (event.propertyName === 'opacity') {
          window.topButtonFades.push({ opacity: Number(getComputedStyle(control).opacity), inert: control.inert });
        }
      });
    });

    await page.evaluate(() => window.scrollTo({ top: 840, behavior: 'instant' }));
    await button.waitFor({ state: 'visible' });
    assert.ok(await button.evaluate(control => {
      const rect = control.getBoundingClientRect();
      return rect.left >= document.querySelector('.gallery-content').getBoundingClientRect().right + 12 &&
        rect.top < innerHeight / 3 && rect.width >= 44 && getComputedStyle(control).position === 'fixed';
    }), 'the control sits outside the artwork on a wide desktop');
    await page.waitForFunction(() => window.topButtonFades.length === 1);
    await page.waitForFunction(() => {
      const panel = document.querySelector('.portfolio-diagnostics');
      return panel && getComputedStyle(panel).position === 'fixed';
    });
    const surfaces = await button.evaluate(control => {
      const panel = document.querySelector('.portfolio-diagnostics');
      const properties = ['backgroundColor', 'backgroundImage', 'borderTopColor', 'borderTopWidth',
        'borderTopLeftRadius', 'boxShadow', 'color'];
      return [control, panel].map(element => {
        const style = getComputedStyle(element);
        return properties.map(property => style[property]);
      });
    });
    assert.deepEqual(surfaces[0], surfaces[1]);

    await page.locator('.shot').nth(1).click();
    await page.locator('#viewer[open]').waitFor();
    assert.equal(await button.isVisible(), false);
    await page.keyboard.press('Escape');
    await page.locator('#viewer').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => !document.fullscreenElement &&
      document.activeElement === document.querySelectorAll('.shot')[1]);
    await button.waitFor({ state: 'visible' });
    await page.evaluate(() => {
      const scrollTo = window.scrollTo;
      window.scrollTo = options => {
        window.topButtonScroll = options;
        scrollTo.call(window, options);
      };
    });
    await page.getByRole('button', { name: 'Back to top' }).press('Enter');
    await page.waitForFunction(() => scrollY === 0 && document.activeElement === document.querySelector('.intro h1'));
    assert.deepEqual(await page.evaluate(() => window.topButtonScroll), { top: 0, behavior: 'smooth' });
    await button.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => window.topButtonFades.length >= 2);
    assert.deepEqual(await page.evaluate(() => window.topButtonFades), [
      { opacity: 1, inert: false },
      { opacity: 0, inert: true },
    ]);
    assert.deepEqual(errors, []);
  });

  await t.test('touch button stays within the viewport and honors reduced motion', async t => {
    const { page, errors } = await openPage(t, {
      route: '/artur' + gallery, width: 390, hasTouch: true, reducedMotion: 'reduce',
    });
    await page.setViewportSize({ width: 390, height: 580 });
    await displayed(page, '.shot-primary', preview('First'));
    await page.evaluate(() => {
      window.scrollTo({ top: document.scrollingElement.scrollHeight, behavior: 'instant' });
      const scrollTo = window.scrollTo;
      window.scrollTo = options => {
        window.topButtonScroll = options;
        scrollTo.call(window, options);
      };
    });
    const button = page.getByRole('button', { name: 'Back to top' });
    await button.waitFor();
    assert.ok(await button.evaluate(control => {
      const rect = control.getBoundingClientRect();
      return rect.bottom <= innerHeight - 12 && rect.top > innerHeight / 2 &&
        rect.right <= innerWidth - 8 && rect.height >= 44;
    }));
    assert.equal(await button.evaluate(control => getComputedStyle(control).transitionDuration), '0s');
    await button.tap();
    await page.waitForFunction(() => scrollY === 0);
    assert.deepEqual(await page.evaluate(() => window.topButtonScroll), { top: 0, behavior: 'instant' });
    assert.deepEqual(errors, []);
  });

  await t.test('Atrium keeps the button outside its transform and scrolls to the top with GSAP', async t => {
    const { page, errors } = await openPage(t, { map: true, width: 2300, diagnostics: true });
    await page.locator('#map-screenshots .shot-primary').nth(2).waitFor();
    await gallerySmootherReady(page);
    await gallerySmootherLayoutReady(page);
    await page.evaluate(() => window.ScrollSmoother.get().scrollTo(700, false));
    const button = page.getByRole('button', { name: 'Back to top' });
    await button.waitFor();
    assert.equal(await button.evaluate(control => control.parentElement === document.body), true);
    await button.click();
    await page.waitForFunction(() => scrollY < 1 && window.ScrollSmoother.get().scrollTop() < 1);
    await button.waitFor({ state: 'hidden' });
    assert.deepEqual(errors, []);
  });
});

test('fullscreen wheel zoom starts with the elapsed time at 240 Hz', async t => {
  const { page, errors } = await openPage(t, { width: 1440, reducedMotion: 'no-preference' });
  await page.locator('.shot').first().click();
  await displayed(page, '#original', preview('First'));
  await page.waitForFunction(() => document.fullscreenElement?.id === 'viewer-frame');

  const { beforeAdvance, prevented, scales, settledMs } = await page.evaluate(() => {
    const viewer = document.querySelector('#viewer');
    const frame = document.querySelector('#viewer-frame');
    const interval = 1000 / 240;
    const started = performance.now();
    const realNow = performance.now;
    const realRequest = window.requestAnimationFrame;
    const realCancel = window.cancelAnimationFrame;
    const callbacks = new Map();
    let nextId = 0;
    const scales = [];
    const record = event => scales.push(event.detail.scale);
    viewer.addEventListener('gallery-zoomchange', record);
    window.requestAnimationFrame = callback => {
      const id = ++nextId;
      callbacks.set(id, callback);
      return id;
    };
    window.cancelAnimationFrame = id => callbacks.delete(id);

    function render(time) {
      const pending = Array.from(callbacks.values());
      callbacks.clear();
      for (const callback of pending) callback(time);
    }

    try {
      performance.now = () => started;
      const wheel = new WheelEvent('wheel', { ctrlKey: true, deltaY: -2500, bubbles: true, cancelable: true });
      frame.dispatchEvent(wheel);
      render(started - 1);
      const beforeAdvance = scales.length;
      let settledMs = 0;
      for (let frameNumber = 1; frameNumber <= 144 && scales.at(-1) !== 4; frameNumber++) {
        settledMs = frameNumber * interval;
        render(started + settledMs);
      }
      return { beforeAdvance, prevented: wheel.defaultPrevented, scales, settledMs };
    } finally {
      viewer.removeEventListener('gallery-zoomchange', record);
      performance.now = realNow;
      window.requestAnimationFrame = realRequest;
      window.cancelAnimationFrame = realCancel;
    }
  });

  assert.ok(prevented, 'modifier-wheel zoom stays inside the viewer');
  assert.equal(beforeAdvance, 0, 'a frame timestamp before input cannot advance zoom');
  assert.ok(scales[0] > 1 && scales[0] < 1.01, 'the first 240 Hz frame changes zoom by less than one percentage point');
  assert.ok(scales[1] - scales[0] > scales[0] - 1, 'zoom accelerates smoothly from the first frame');
  assert.ok(scales.every((scale, i) => !i || scale > scales[i - 1]), 'the zoom advances without reversals or stalls');
  assert.equal(scales.at(-1), 4);
  assert.ok(settledMs < 550, 'the short idle tail still settles within 550ms');
  assert.deepEqual(errors, []);
});

test('the visible comparison mark follows the foreground palette in the gallery and fullscreen', async t => {
  const { page, errors } = await openPage(t, { width: 1440 });
  const themedForeground = 'rgb(232, 230, 227)';
  await page.addStyleTag({ content: `.comparison-indicator > button { color: ${themedForeground} }` });
  const strip = page.locator('.shot-entry .comparison-indicator').first();
  const fill = button => button.evaluate(element => getComputedStyle(element, '::before').backgroundColor);
  const chosen = container => container.locator('button[aria-pressed="true"]');
  assert.equal(await fill(chosen(strip)), themedForeground);

  await strip.locator('button').nth(2).hover();
  await displayed(page, '.shot-comparison.is-visible', preview('First_Wireframe'));
  assert.equal(await fill(chosen(strip)), themedForeground);
  assert.equal(await fill(strip.locator('button').first()), 'rgb(59, 59, 59)');

  await page.locator('.shot').first().click();
  await activeSegment(page, 0);
  const fullscreenStrip = page.locator('#viewer .comparison-indicator');
  assert.equal(await fill(chosen(fullscreenStrip)), themedForeground);
  await segment(page, 2).hover();
  await displayed(page, '#original', preview('First_Wireframe'));
  await activeSegment(page, 2);
  assert.equal(await fill(chosen(fullscreenStrip)), themedForeground);
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

async function recordMapPreviewMotion(page, selector) {
  await page.evaluate(selector => {
    const stage = document.querySelector(selector), card = stage.querySelector('.gallery-map-region');
    const recording = window.mapPreviewMotion = { active: true, samples: [] };
    function sample() {
      const bounds = card.getBoundingClientRect(), board = stage.getBoundingClientRect();
      recording.samples.push({ width: bounds.width, ratio: bounds.width / board.width,
        expanded: card.getAttribute('aria-expanded') === 'true' });
      if (recording.active && recording.samples.length < 600) requestAnimationFrame(sample);
    }
    sample();
  }, selector);
}

async function finishMapPreviewMotion(page) {
  return page.evaluate(() => {
    window.mapPreviewMotion.active = false;
    return window.mapPreviewMotion.samples;
  });
}

async function mapPreviewSettled(page, selector, ratio) {
  await page.waitForFunction(({ selector, ratio }) => {
    const stage = document.querySelector(selector), card = stage.querySelector('.gallery-map-region');
    return Math.abs(card.getBoundingClientRect().width / stage.getBoundingClientRect().width - ratio) < .002 &&
      !card.getAnimations().some(animation => animation.playState === 'running' || animation.pending);
  }, { selector, ratio });
}

test('Atrium thumbnail previews use CSS transitions and respect reduced motion', { timeout: 20_000 }, async t => {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    await t.test(reducedMotion, async t => {
      const { page, requests, errors } = await openPage(t, { map: true, width: 1440, diagnostics: true, reducedMotion });
      await page.waitForLoadState('load');
      await page.locator('#public-map .gallery-map-region').first().waitFor({ state: 'visible' });
      const mode = reducedMotion === 'reduce' ? 'Reduced motion' : 'CSS transitions';
      await page.waitForFunction(mode => window.PortfolioDiagnostics?.report?.().pages.at(-1)
        .features['gallery-map-preview']?.mode === mode, mode);
      const ready = await page.evaluate(() => window.PortfolioDiagnostics.report().pages.at(-1));
      assert.equal(ready.motion['gallery-map-preview'], undefined, 'readiness does not invent observed motion');
      assert.equal(ready.tallies['gallery-map-preview'], undefined, 'readiness does not invent animation counts');
      await recordMapPreviewMotion(page, '#public-map');
      const preview = await enlargeMapPreview(page, '#public-map');
      await mapPreviewSettled(page, '#public-map', .8);
      const before = await page.evaluate(() => scrollY);
      await page.mouse.click(preview.point.x, preview.point.y);
      assert.equal(await page.evaluate(() => scrollY), before);
      assert.equal(await preview.card.getAttribute('aria-expanded'), 'true');
      await page.mouse.move(5, 5);
      await mapPreviewSettled(page, '#public-map', .2);
      const samples = await finishMapPreviewMotion(page);
      for (const expanded of [true, false]) {
        const intermediate = samples.some(sample => sample.expanded === expanded && sample.ratio > .205 && sample.ratio < .795);
        assert.equal(intermediate, reducedMotion === 'no-preference',
          `${expanded ? 'enlargement' : 'shrink'} animates with CSS and becomes immediate for reduced motion`);
      }
      assert.equal(await page.evaluate(() => Boolean(window.Flip)), false);
      assert.ok(!requests.some(url => new URL(url).pathname.endsWith('/Flip.min.js')), 'thumbnail previews never request Flip');
      const report = await page.evaluate(() => window.PortfolioDiagnostics.report().pages.at(-1));
      const counts = report.tallies['gallery-map-preview'];
      assert.equal(report.libraries.Flip, false);
      assert.equal(report.features['gallery-map-preview'].mode, mode);
      if (reducedMotion === 'reduce') {
        assert.equal(counts['instant changes'], 2);
        assert.equal(report.motion['gallery-map-preview'], undefined, 'reduced motion does not claim CSS animation frames');
        for (const key of ['CSS enlargements', 'CSS shrinks', 'CSS completed']) assert.equal(counts[key] || 0, 0, key);
      } else {
        assert.equal(counts['CSS enlargements'], 1);
        assert.equal(counts['CSS shrinks'], 1);
        assert.equal(counts['CSS completed'], 2);
        assert.ok(report.motion['gallery-map-preview'].advances > 1, 'diagnostics observed changing thumbnail widths');
        assert.ok(report.motion['gallery-map-preview'].max > report.motion['gallery-map-preview'].min + 100);
      }
      await page.getByText('Diagnostics', { exact: true }).click();
      await page.getByText('Map thumbnail animation', { exact: true }).waitFor();
      const previewRow = await page.getByText('Map thumbnail animation', { exact: true })
        .evaluate(title => title.nextElementSibling.textContent);
      assert.ok(previewRow.includes(mode));
      if (reducedMotion === 'no-preference') {
        assert.match(previewRow, /motion updates/);
        assert.match(previewRow, /CSS completed 2/);
      } else assert.doesNotMatch(previewRow, /motion updates|CSS completed/);
      assert.deepEqual(errors, []);
    });
  }
});

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

test('an Atrium hotspot reaches its screenshot through a ScrollTrigger refresh', { timeout: 15_000 }, async t => {
  const { page, errors } = await openPage(t, { map: true, width: 1440, diagnostics: true });
  await page.locator('#public-map').waitFor({ state: 'visible' });
  await gallerySmootherReady(page);
  await page.locator('#public-map .gallery-map-region').first().evaluate(card => {
    card.addEventListener('click', () => {
      window.addEventListener('scroll', () => {
        // Reproduce an earlier screenshot changing height while the map scrolls.
        document.querySelector('.gallery-map-shot').style.marginBottom = '420px';
        window.ScrollTrigger.refresh();
        window.mapScrollRefreshed = true;
      }, { once: true });
    }, { capture: true, once: true });
  });
  await clickCollapsedMapRegion(page, '#public-map');
  await page.waitForFunction(() => window.mapScrollRefreshed);
  await focusedMapScreenshotIsVisible(page, 'Second.jpg', t);
  const { rendered: selected } = await galleryScrollPosition(page);
  await page.mouse.move(300, 300);
  await page.mouse.wheel(0, 120);
  await page.waitForFunction(selected => window.ScrollSmoother.get().scrollTop() > selected + 60, selected);
  await page.evaluate(() => window.ScrollTrigger.refresh());
  assert.ok((await galleryScrollPosition(page)).rendered > selected + 60, 'a refresh after new wheel input keeps the user position');
  assert.deepEqual(errors, []);
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

test('Atrium hover previews close at either boundary on all four edges in page and fullscreen maps', { timeout: 40_000 }, async t => {
  const cases = [
    { edge: 'left', x: 20, y: 50, inside: [.3, .5], outsideImage: [.08, .5], outsideHover: [.45, .5] },
    { edge: 'right', x: 80, y: 50, inside: [.7, .5], outsideImage: [.92, .5], outsideHover: [.55, .5] },
    { edge: 'top', x: 50, y: 20, inside: [.5, .3], outsideImage: [.5, .08], outsideHover: [.5, .49] },
    { edge: 'bottom', x: 50, y: 80, inside: [.5, .7], outsideImage: [.5, .92], outsideHover: [.5, .51] },
  ];
  const contains = (rect, point) => point.x > rect.x && point.x < rect.x + rect.width &&
    point.y > rect.y && point.y < rect.y + rect.height;
  for (const selector of ['#public-map', '#fullscreen-map']) {
    for (const fixture of cases) {
      await t.test(`${selector}: ${fixture.edge}`, async t => {
        const { page, errors } = await openPage(t, {
          map: true, width: 1440, diagnostics: true, reducedMotion: 'no-preference',
          intercept: async (request, url) => {
            if (url.pathname !== `${gallery}gallery-map.json`) return false;
            // Put the same screenshot near each edge without changing production geometry.
            await request.fulfill({ json: { ...mapManifest,
              regions: [{ ...mapManifest.regions[0], x: fixture.x, y: fixture.y }],
            } });
            return true;
          },
        });
        await gallerySmootherReady(page);
        if (selector === '#fullscreen-map') {
          await page.locator('#map-fullscreen').click();
          await page.locator(selector).waitFor({ state: 'visible' });
          await gallerySmootherReady(page, true);
          await page.waitForFunction(() => document.fullscreenElement?.id === 'viewer-frame');
        }
        await page.locator(`${selector} .gallery-map-region`).first().waitFor({ state: 'visible' });
        await mapPreviewSettled(page, selector, .2);
        const board = await page.locator(selector).boundingBox();
        const point = ([x, y]) => ({ x: board.x + board.width * x, y: board.y + board.height * y });
        const inside = point(fixture.inside), outsideImage = point(fixture.outsideImage), outsideHover = point(fixture.outsideHover);
        const move = target => page.mouse.move(target.x, target.y);
        // The original rectangle is 45% by 54%, centred on the thumbnail and clipped to the map.
        const hoverLeft = Math.max(0, fixture.x / 100 - .225), hoverTop = Math.max(0, fixture.y / 100 - .27);
        const hover = { x: board.x + board.width * hoverLeft, y: board.y + board.height * hoverTop,
          width: board.width * (Math.min(1, fixture.x / 100 + .225) - hoverLeft),
          height: board.height * (Math.min(1, fixture.y / 100 + .27) - hoverTop) };
        assert.ok(contains(hover, inside) && contains(hover, outsideImage), 'the image exit is still inside the original rectangle');
        assert.equal(contains(hover, outsideHover), false, 'the original rectangle also has a separate exit');
        const navigation = () => page.evaluate(() => ({ url: location.href, scroll: scrollY,
          viewer: document.querySelector('#viewer').open, fullscreen: document.fullscreenElement?.id || null,
          counter: document.querySelector('#counter').textContent,
          focusedScreenshot: Boolean(document.querySelector('.gallery-map-shot:focus')) }));
        const before = await navigation();
        for (const [boundary, exit] of [['enlarged image', outsideImage], ['original rectangle', outsideHover]]) {
          // Leaving the collapsed thumbnail clears its re-entry guard before a new hover.
          await move(point([.5, .5]));
          const preview = await enlargeMapPreview(page, selector);
          await mapPreviewSettled(page, selector, .8);
          const expanded = await preview.card.boundingBox();
          assert.ok(contains(expanded, inside) && contains(expanded, outsideHover), 'the old shrink zone remains inside the enlarged image');
          assert.equal(contains(expanded, outsideImage), false, 'the image exit really crosses the rendered image edge');
          await move(inside);
          assert.equal(await preview.card.getAttribute('aria-expanded'), 'true', 'the intersection keeps the preview open');
          await move(exit);
          assert.equal(await preview.card.getAttribute('aria-expanded'), 'false', `${boundary} exit closes the preview`);
          await mapPreviewSettled(page, selector, .2);
          assert.deepEqual(await navigation(), before, 'hovering and shrinking do not navigate or change fullscreen state');
        }
        assert.deepEqual(errors, []);
      });
    }
  }
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
  await mapPreviewSettled(page, '#fullscreen-map', .2);
  const collapsed = await card.evaluate(card => {
    const board = card.parentElement.getBoundingClientRect(), bounds = card.getBoundingClientRect();
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2,
      expectedX: board.x + board.width * Number(card.dataset.x) / 100,
      expectedY: board.y + board.height * Number(card.dataset.y) / 100 };
  });
  assert.ok((await viewerTransform(page)).scale > 1, 'collapse is checked under the pinched parent transform');
  assert.ok(Math.abs(collapsed.x - collapsed.expectedX) < 1.5, 'the thumbnail returns to the transformed horizontal anchor');
  assert.ok(Math.abs(collapsed.y - collapsed.expectedY) < 1.5, 'the thumbnail returns to the transformed vertical anchor');
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
  assert.equal(await page.locator('.gallery-back-to-top').count(), 0);
  await page.locator('#gallery-password').fill('fixture-password');
  await page.locator('button[type="submit"]').press('Enter');
  await page.locator('.shot').first().press('Enter');
  await page.waitForFunction(() => {
    const image = document.querySelector('#original');
    return image?.complete && image.naturalWidth > 0 && image.currentSrc.startsWith('blob:');
  });
  assert.equal(primaryAttempts, 2);
  assert.equal(await page.locator('.gallery-back-to-top').count(), 1);
  assert.ok(protectedRequests.length >= 2 && protectedRequests.every(token => token === 'Bearer fixture-token'));
  assert.ok(!requests.some(url => url.includes('/public-media/') || url.includes('/1440p/')));
  assert.deepEqual(errors, []);
});



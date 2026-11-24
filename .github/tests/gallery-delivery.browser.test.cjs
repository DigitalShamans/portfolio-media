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
const mapLayout = read('_layouts/gallery-map.html');
const viewerInclude = read('_includes/gallery-viewer.html');
const galleryViewer = viewerInclude
  .replace(/{% if include\.map %}[\s\S]*?{% endif %}/, '');
const mapViewer = viewerInclude.replace(/{% (?:if include\.map|endif) %}/g, '');
const portfolio = 'http://localhost:3000';
const media = 'https://media.example.test';
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
const originals = name => `${media}/public-media/${revision}/hb-egypt/${name}.jpg`;
const preview = name => `${portfolio}${gallery}1440p/${name}.webp?v=test&webp=q92-m6`;

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
    viewerScript: '/galleries/gallery-viewer.js', media: desktopQuery,
    webpRevision: 'q92-m6', delivery: {},
    galleries: { 'hb-egypt': { title: 'Hard Bullet - Egypt', hasMap: true, versions: {} } },
  };
  return content + `<script id="gallery-map-options" type="application/json">${JSON.stringify(options)}</script>` + scripts(mapLayout);
}

function pageHtml(path, { embeds, assetVersions = {}, map = false, diagnostics = false } = {}) {
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

async function openPage(t, { route = gallery, width = 2800, hasTouch = false, intercept, embeds, assetVersions, map = false, diagnostics = false, reducedMotion } = {}) {
  if (map) route = mapRoute;
  const page = await browser.newPage({ hasTouch, viewport: { width, height: 900 } });
  t.after(() => page.close());
  page.setDefaultTimeout(5000);
  if (reducedMotion) await page.emulateMedia({ reducedMotion });
  const requests = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async request => {
    const url = new URL(request.request().url());
    requests.push(url.href);
    if (intercept && await intercept(request, url)) return;
    if (url.pathname === route) return request.fulfill({ contentType: 'text/html', body: pageHtml(route, { embeds, assetVersions, map, diagnostics }) });
    if (map && url.pathname === `${gallery}gallery-map.json`) return request.fulfill({ json: mapManifest });
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
  await page.goto(portfolio + route + (diagnostics ? '?diagnostics=1' : ''), { waitUntil: 'domcontentloaded' });
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

async function gallerySmootherReady(page, paused = false) {
  await page.waitForFunction(paused => {
    const smoother = window.ScrollSmoother?.get();
    const features = window.PortfolioDiagnostics?.report?.().pages.at(-1).features;
    const mode = paused ? 'Paused for fullscreen viewer' : 'GSAP ScrollSmoother';
    return smoother && smoother.paused() === paused &&
      features?.['gallery-smoother']?.mode === mode && features?.['gallery-wheel']?.mode === mode;
  }, paused);
}

async function galleryScrollPosition(page) {
  return page.evaluate(() => ({
    native: window.scrollY,
    rendered: window.ScrollSmoother.get().scrollTop(),
    top: document.querySelector('.gallery-map-page').getBoundingClientRect().top,
  }));
}

test('Atrium ScrollSmoother animates wheel and small trackpad deltas and reports actual motion', { timeout: 20_000 }, async t => {
  const { page, requests, errors } = await openPage(t, {
    map: true, width: 1440, diagnostics: true, reducedMotion: 'no-preference',
  });
  await page.locator('#map-screenshots .shot-primary').nth(2).waitFor();
  await gallerySmootherReady(page);
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
  await page.mouse.move(300, 300);
  for (const delta of [160, 12]) {
    const before = await galleryScrollPosition(page);
    await page.evaluate(() => {
      const trace = window.atriumScrollTrace = { active: true, samples: [] };
      function sample() {
        const smoother = window.ScrollSmoother.get();
        trace.samples.push({ rendered: smoother.scrollTop(), top: smoother.content().getBoundingClientRect().top });
        if (trace.active) requestAnimationFrame(sample);
      }
      sample();
    });
    await page.mouse.wheel(0, delta);
    await page.waitForFunction(({ before, delta }) => {
      const rendered = window.ScrollSmoother.get().scrollTop();
      return scrollY > before.native + delta / 2 && Math.abs(scrollY - rendered) < .5;
    }, { before, delta });
    const after = await galleryScrollPosition(page);
    const samples = await page.evaluate(() => {
      window.atriumScrollTrace.active = false;
      return window.atriumScrollTrace.samples;
    });
    assert.ok(after.rendered - before.rendered > delta / 2, `${delta}px input moves the rendered page`);
    assert.ok(Math.abs(after.top - before.top + after.rendered - before.rendered) < 2,
      'the visible map follows the smoother position');
    assert.ok(samples.some(sample => sample.rendered > before.rendered + .5 && sample.rendered < after.rendered - .5),
      `${delta}px input renders intermediate positions`);
    assert.ok(samples.some(sample => sample.rendered > samples[0].rendered + .5 &&
      Math.abs(sample.top - samples[0].top + sample.rendered - samples[0].rendered) < 2),
      'GSAP applies the scroll transform to the content');
  }
  const report = await page.evaluate(() => window.PortfolioDiagnostics.report().pages.at(-1));
  for (const feature of ['gallery-smoother', 'gallery-wheel']) {
    assert.equal(report.features[feature].mode, 'GSAP ScrollSmoother');
    assert.ok(report.motion[feature].advances > 1, `${feature} records changing positions`);
  }
  assert.ok(report.input.wheel >= 2);
  assert.ok(report.input.smallPixelWheel >= 1);
  for (const name of ['gsap', 'ScrollTrigger', 'ScrollSmoother']) {
    assert.ok(requests.includes(`${portfolio}/assets/vendor/gsap/3.15.1/${name}.min.js`), `${name} is served locally`);
  }
  assert.deepEqual(errors, []);
});

test('Atrium ScrollSmoother pauses for fullscreen wheel input and resumes without moving the page', { timeout: 20_000 }, async t => {
  const { page, errors } = await openPage(t, {
    map: true, width: 1440, diagnostics: true, reducedMotion: 'no-preference',
  });
  await page.locator('#map-fullscreen').waitFor();
  await gallerySmootherReady(page);
  await page.evaluate(() => {
    window.atriumSmootherInstance = window.ScrollSmoother.get();
    window.scrollTo({ top: 300, behavior: 'instant' });
  });
  await page.waitForFunction(() => Math.abs(window.ScrollSmoother.get().scrollTop() - 300) < .5);
  const before = await galleryScrollPosition(page);
  await page.locator('#map-fullscreen').click();
  await page.locator('#fullscreen-map').waitFor({ state: 'visible' });
  await gallerySmootherReady(page, true);
  const stage = await page.locator('#stage').boundingBox();
  await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2);
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
  const restored = await galleryScrollPosition(page);
  assert.ok(Math.abs(restored.rendered - before.rendered) < 2, 'closing restores the visible scroll position');
  assert.ok(Math.abs(restored.top - before.top) < 2, 'opener focus does not move the map');
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

test('fullscreen desktop left click toggles zoom, middle drag pans, and double-click exits', async t => {
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

  await page.mouse.click(x, y);
  await zoomedStage.waitFor();
  assert.equal((await viewerTransform(page)).scale, 2);
  await page.mouse.click(x, y);
  await zoomedStage.waitFor({ state: 'detached' });
  assert.deepEqual(await viewerTransform(page), { scale: 1, x: 0, y: 0 });
  assert.equal(await viewer.evaluate(element => element.open), true);
  await page.mouse.click(x, y);
  await zoomedStage.waitFor();

  const beforePan = await viewerTransform(page);
  await page.mouse.move(x, y);
  await page.mouse.down({ button: 'middle' });
  await page.locator('#stage.dragging').waitFor();
  assert.equal(await page.locator('#original').evaluate(image => getComputedStyle(image).cursor), 'grabbing');
  await page.mouse.move(x + 60, y, { steps: 3 });
  await page.mouse.up({ button: 'middle' });
  const afterPan = await viewerTransform(page);
  assert.equal(afterPan.scale, 2);
  assert.ok(afterPan.x > beforePan.x);
  assert.equal(await viewer.evaluate(element => element.open), true);

  await page.mouse.down({ button: 'left' });
  await page.mouse.move(x + 100, y, { steps: 3 });
  await page.mouse.up({ button: 'left' });
  // Check after the single-click delay so a drag cannot toggle the zoom.
  await page.waitForTimeout(350);
  assert.deepEqual(await viewerTransform(page), afterPan);

  const wheelPoint = await page.locator('#stage').boundingBox();
  await page.mouse.move(wheelPoint.x + wheelPoint.width / 2, wheelPoint.y + wheelPoint.height / 2);
  await page.mouse.wheel(0, 160);
  await displayed(page, '#original', preview('Second'));
  assert.equal(await page.locator('#counter').textContent(), '2 / 3');
  assert.equal((await viewerTransform(page)).scale, 1);
  await page.mouse.dblclick(x, y);
  await viewer.waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.fullscreenElement === null);

  await firstShot.click();
  await displayed(page, '#original', preview('First'));
  await page.mouse.click(x, y);
  await zoomedStage.waitFor();
  await page.mouse.dblclick(x, y);
  await viewer.waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.fullscreenElement === null);
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

test('Atrium previews stay at 80 percent without navigating and share fullscreen mouse controls', async t => {
  const { page, errors } = await openPage(t, { map: true, width: 1440 });
  await page.locator('#public-map').waitFor({ state: 'visible' });
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
  await page.locator('#stage.zoomed').waitFor();
  assert.equal((await viewerTransform(page)).scale, 2);
  assert.equal(await fullscreen.card.getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('#counter').textContent(), '1 / 3');
  assert.equal(await page.locator('#fullscreen-map').isVisible(), true);
  assert.equal(await page.evaluate(() => scrollY), beforeZoom);

  const mapBeforePan = await viewerTransform(page);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(fullscreen.point.x + 60, fullscreen.point.y, { steps: 3 });
  await page.mouse.up({ button: 'middle' });
  const mapAfterPan = await viewerTransform(page);
  assert.equal(mapAfterPan.scale, 2);
  assert.ok(mapAfterPan.x > mapBeforePan.x);
  assert.equal(await fullscreen.card.getAttribute('aria-expanded'), 'true');

  await page.mouse.click(fullscreen.point.x + 60, fullscreen.point.y);
  await page.locator('#stage.zoomed').waitFor({ state: 'detached' });
  assert.deepEqual(await viewerTransform(page), { scale: 1, x: 0, y: 0 });
  assert.equal(await page.locator('#fullscreen-map').isVisible(), true);
  await page.mouse.dblclick(fullscreen.point.x, fullscreen.point.y);
  await page.locator('#viewer').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.fullscreenElement === null);

  await page.locator('#map-fullscreen').click();
  await page.locator('#fullscreen-map').waitFor({ state: 'visible' });
  assert.equal((await viewerTransform(page)).scale, 1);
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



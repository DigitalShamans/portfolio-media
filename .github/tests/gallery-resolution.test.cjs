const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../assets/gallery-resolution.js'), 'utf8');

const serviceOrigin = 'https://digital-shamans-rz-start-media.bonnydolphin3.chatgpt.site';
const commit = '1234567890abcdef1234567890abcdef12345678';

function resolution(baseURI, wide = false, delivery = {}) {
  return vm.runInNewContext(source + '\nGalleryResolution;', {
    URL,
    window: { matchMedia: () => ({ matches: wide }) },
    document: {
      baseURI,
      documentElement: {
        dataset: { gallery4kMedia: 'wide desktop', galleryWebpRevision: 'q92-m6', ...delivery },
      },
    },
  });
}

test('primary, wireframe and checker names become clean WebP URLs on both portfolio routes', () => {
  for (const prefix of ['', '/artur']) {
    const mapper = resolution('https://digitalshamans.co.uk' + prefix + '/galleries/hb-egypt/');
    for (const suffix of ['', '_Wireframe', '_Checker']) {
      const original = '/galleries/hb-egypt/HB_Start_03' + suffix + '.jpg?v=source-hash';
      const url = new URL(mapper.publicImageUrl(original, '1440p'));
      assert.equal(url.pathname, '/galleries/hb-egypt/1440p/HB_Start_03' + suffix + '.webp');
      assert.equal(url.searchParams.get('v'), 'source-hash');
      assert.equal(url.searchParams.get('webp'), 'q92-m6');
    }
  }
});

test('only the final extension is replaced, including uppercase extensions and encoded names', () => {
  const mapper = resolution('https://digitalshamans.co.uk/galleries/hb-egypt/');
  for (const [input, expected] of [
    ['name.jpg.detail.JPG', 'name.jpg.detail.webp'],
    ['image.jpeg', 'image.webp'],
    ['image.png', 'image.webp'],
    ['room%20A.jpg', 'room%20A.webp'],
  ]) {
    assert.equal(new URL(mapper.publicImageUrl(input, '1440p')).pathname,
      '/galleries/hb-egypt/1440p/' + expected);
  }
});

test('personal gallery base URLs and homepage preload URLs resolve to shared image files', () => {
  for (const base of ['https://digitalshamans.co.uk/', 'https://digitalshamans.co.uk/artur/',
    'https://digitalshamans.co.uk/galleries/hb-airplanes/']) {
    const mapper = resolution(base);
    assert.equal(new URL(mapper.publicImageUrl('/galleries/hb-airplanes/Plane.jpg?v=hash', '1440p')).pathname,
      '/galleries/hb-airplanes/1440p/Plane.webp');
  }
});

test('4K URLs keep their JPEG names and existing content revisions', () => {
  const mapper = resolution('https://digitalshamans.co.uk/galleries/hb-egypt/', true);
  assert.equal(mapper.current(), '4k');
  assert.equal(mapper.publicImageUrl('HB_Start_03.jpg?v=unchanged', '4k'),
    'https://digitalshamans.co.uk/galleries/hb-egypt/HB_Start_03.jpg?v=unchanged');
  assert.equal(resolution('https://digitalshamans.co.uk/').current(), '1440p');
});

test('both portfolios use the immutable delivery route for all wide-desktop variants', () => {
  const delivery = { galleryOriginalsOrigin: serviceOrigin, galleryOriginalsRevision: commit };
  for (const base of ['https://digitalshamans.co.uk/', 'https://digitalshamans.co.uk/artur/',
    'https://digitalshamans.co.uk/galleries/hb-egypt/']) {
    const desktop = resolution(base, true, delivery);
    const mobile = resolution(base, false, delivery);
    for (const suffix of ['', '_Wireframe', '_Checker']) {
      const name = 'HB_Start_03' + suffix;
      const original = '/galleries/hb-egypt/' + name + '.jpg?v=obsolete#image';
      assert.equal(desktop.publicImageUrl(original, desktop.current()),
        `${serviceOrigin}/public-media/${commit}/hb-egypt/${name}.jpg`);
      assert.equal(new URL(mobile.publicImageUrl(original, mobile.current())).pathname,
        '/galleries/hb-egypt/1440p/' + name + '.webp');
    }
  }
});

test('only offloaded 4K gallery images have a same-variant WebP fallback', () => {
  const delivery = { galleryOriginalsOrigin: serviceOrigin, galleryOriginalsRevision: commit };
  const base = 'https://digitalshamans.co.uk/artur/galleries/hb-egypt/';
  const desktop = resolution(base, true, delivery);
  const mobile = resolution(base, false, delivery);
  const legacy = resolution(base, true);
  for (const suffix of ['', '_Wireframe', '_Checker']) {
    const original = `/galleries/hb-egypt/HB_Start_03${suffix}.jpg?v=content-hash`;
    const source = desktop.publicImageSource(original, desktop.current());
    assert.equal(source.url, desktop.publicImageUrl(original, '4k'));
    assert.equal(source.fallbackUrl, mobile.publicImageUrl(original, '1440p'));
    assert.equal(new URL(source.fallbackUrl).search, '?v=content-hash&webp=q92-m6');
    assert.equal(mobile.publicImageSource(original, '1440p').fallbackUrl, undefined);
    assert.equal(legacy.publicImageSource(original, '4k').fallbackUrl, undefined);
  }
  assert.equal(desktop.publicImageSource(`${serviceOrigin}/outside.jpg`, '4k').fallbackUrl, undefined);
  assert.equal(desktop.publicImageSource('/projects/image.jpg', '4k').fallbackUrl, undefined);
});

test('a new gallery uses its own revision without invalidating existing image URLs', () => {
  const newCommit = 'abcdef1234567890abcdef1234567890abcdef12';
  const delivery = {
    galleryOriginalsOrigin: serviceOrigin,
    galleryOriginalsRevision: commit,
    galleryOriginalsGalleryRevisions: JSON.stringify({ 'nfs-unbound': newCommit }),
  };
  for (const base of ['https://digitalshamans.co.uk/', 'https://digitalshamans.co.uk/artur/',
    'https://digitalshamans.co.uk/galleries/nfs-unbound/',
    'https://digitalshamans.co.uk/galleries/hb-egypt/']) {
    const mapper = resolution(base, true, delivery);
    const nfs = mapper.publicImageSource('/galleries/nfs-unbound/shot.jpg?v=image-hash', '4k');
    assert.equal(nfs.url, `${serviceOrigin}/public-media/${newCommit}/nfs-unbound/shot.jpg`);
    assert.equal(nfs.fallbackUrl,
      'https://digitalshamans.co.uk/galleries/nfs-unbound/1440p/shot.webp?v=image-hash&webp=q92-m6');
    assert.equal(mapper.publicImageUrl('/galleries/hb-egypt/shot.jpg?v=unchanged', '4k'),
      `${serviceOrigin}/public-media/${commit}/hb-egypt/shot.jpg`);
    assert.equal(mapper.publicImageUrl('/galleries/nfs-unbound/shot.jpg?v=image-hash', '1440p'),
      nfs.fallbackUrl);
  }
});

test('missing or malformed optional revision maps retain the established delivery revision', () => {
  for (const value of [undefined, 'null', '[]', '{bad json',
    JSON.stringify({ 'nfs-unbound': 'invalid' }), JSON.stringify({ 'nfs-unbound': 123 })]) {
    const mapper = resolution('https://digitalshamans.co.uk/', true, {
      galleryOriginalsOrigin: serviceOrigin, galleryOriginalsRevision: commit,
      galleryOriginalsGalleryRevisions: value,
    });
    assert.equal(mapper.publicImageUrl('/galleries/nfs-unbound/shot.jpg', '4k'),
      `${serviceOrigin}/public-media/${commit}/nfs-unbound/shot.jpg`);
  }
});

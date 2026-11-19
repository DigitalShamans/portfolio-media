'use strict';

const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve, sep } = require('node:path');
const { runInNewContext } = require('node:vm');
const test = require('node:test');
const root = resolve(__dirname, '../..');
const data = readFileSync(resolve(root, 'galleries/gallery-data.js'), 'utf8');
const source = readFileSync(resolve(root, 'galleries/gallery-embeds.js'), 'utf8');
const { GalleryEmbeds } = runInNewContext(data + '\n' + source + '\n({ GalleryEmbeds })');
const model = { type: 'sketchfab', id: '5db8dc613bc2456da7a0a84d908396b0', title: 'Cessna 340', after: 'first.jpg' };
const parse = embeds => GalleryEmbeds.parse(JSON.stringify(embeds));

function element(tagName) {
  return {
    tagName, children: [], attributes: {}, parent: null,
    append(...children) {
      for (const child of children) {
        child.parent = this;
        this.children.push(child);
      }
    },
    before(child) {
      child.parent = this.parent;
      this.parent.children.splice(this.parent.children.indexOf(this), 0, child);
    },
    after(child) {
      child.parent = this.parent;
      this.parent.children.splice(this.parent.children.indexOf(this) + 1, 0, child);
    },
    setAttribute(name, value) { this.attributes[name] = value; },
  };
}

async function mount(entries, embeds, { ok = true, body = JSON.stringify(embeds), assetUrl } = {}) {
  const gallery = element('section');
  const images = entries.map(entry => Object.assign(element('a'), { image: entry.image }));
  gallery.append(...images);
  const errors = [];
  const api = runInNewContext(data + '\n' + source + '\nGalleryEmbeds', {
    document: { createElement: element },
    fetch: async () => ({ ok, text: async () => body }),
    console: { error: (...args) => errors.push(args) },
  });
  await api.mount(gallery, entries, images, 'gallery-embeds.json', assetUrl);
  const sequence = gallery.children.map(child => child.image ??
    (child.className === 'gallery-embed' ? child.children[1].src : child.className));
  return { gallery, images, errors, sequence };
}

test('viewer anchors follow reordered images and images merged as comparisons', () => {
  const reordered = [{ image: 'second.jpg' }, { image: 'first.jpg' }];
  assert.equal(GalleryEmbeds.anchorIndex(reordered, parse([model])[0].after), 1);
  const merged = [{ image: 'second.jpg', compare: 'first.jpg', additionalImages: ['third.jpg'] }];
  assert.equal(GalleryEmbeds.anchorIndex(merged, parse([model])[0].after), 0);
  assert.equal(GalleryEmbeds.source(model), 'https://sketchfab.com/models/' + model.id + '/embed');
});

test('keeps the placement metadata when an editor excludes its anchor', () => {
  const entries = [{ image: 'second.jpg' }];
  const [embed] = parse([{ ...model, before: 'second.jpg' }]);
  assert.equal(GalleryEmbeds.anchorIndex(entries, embed.after), -1);
  assert.equal(GalleryEmbeds.anchorIndex(entries, embed.before), 0);
});

const trailer = {
  type: 'youtube', id: 'eWHDcWZnTMY',
  title: 'Phantom: Covert Ops | Oculus Rift Gameplay Trailer', before: 'first.jpg',
};
const trailerUrl = 'https://www.youtube-nocookie.com/embed/eWHDcWZnTMY?rel=0';
const video = {
  type: 'video', file: 'phantom-covert-ops-shooting-challenge-gif-gfycat.mp4',
  title: 'Shooting challenge', after: 'first.jpg', before: 'second.jpg',
};

test('accepts only local ASCII MP4 basenames and rejects duplicate videos', () => {
  for (const file of ['clip.mp4', 'Shooting_Challenge-01.mp4', video.file]) {
    assert.equal(parse([{ ...video, file }])[0].file, file);
    assert.equal(GalleryEmbeds.source({ ...video, file }), file);
  }
  for (const file of [undefined, null, 1, '', '.mp4', '.clip.mp4', '../clip.mp4',
    '..\\clip.mp4', '/clip.mp4', 'folder/clip.mp4', 'folder\\clip.mp4',
    'https://example.test/clip.mp4', '//example.test/clip.mp4', 'data:video/mp4;base64,abc',
    'blob:clip.mp4', 'clip.mp4?v=1', 'clip.mp4#t=1', '%2e%2e%2fclip.mp4',
    'clip%2emp4', 'clip.webm', 'clip.jpg', 'clip.MP4', 'two words.mp4', 'vídeo.mp4',
    'clip.mp4\n', 'clip.mp4\r\n']) {
    assert.throws(() => parse([{ ...video, file }]), String(file));
  }
  assert.throws(() => parse([video, video]), /more than once/);
});

test('mounts a native video with metadata preload and a versioned local source', async () => {
  const url = 'https://portfolio.test/galleries/firearms/' + video.file + '?v=mp4-blob';
  const resolved = [];
  const result = await mount([{ image: 'first.jpg' }, { image: 'second.jpg' }], [video], {
    assetUrl: file => { resolved.push(file); return url; },
  });
  assert.deepEqual(result.sequence, ['first.jpg', url, 'second.jpg']);
  assert.deepEqual(resolved, [video.file]);
  const media = result.gallery.children[1].children[1];
  assert.equal(media.tagName, 'video');
  assert.equal(media.title, video.title);
  assert.equal(media.controls, true);
  assert.equal(media.playsInline, true);
  assert.equal(media.preload, 'metadata');
  assert.equal(media.width, 1280);
  assert.equal(media.height, 720);
  assert.equal(media.autoplay, undefined);
  assert.equal(media.controlsList, undefined);
  assert.equal(media.disablePictureInPicture, undefined);
  assert.deepEqual(result.errors, []);
});

test('local video anchors preserve reorder, comparison and exclusion behavior', async t => {
  for (const [name, entries, expected] of [
    ['reorder', [{ image: 'second.jpg' }, { image: 'first.jpg' }], ['second.jpg', 'first.jpg', video.file]],
    ['comparison', [{ image: 'third.jpg', compare: 'first.jpg' }, { image: 'second.jpg' }], ['third.jpg', video.file, 'second.jpg']],
    ['excluded after', [{ image: 'second.jpg' }], [video.file, 'second.jpg']],
    ['both excluded', [{ image: 'third.jpg' }], ['third.jpg', video.file]],
  ]) {
    await t.test(name, async () => {
      const result = await mount(entries, [video]);
      assert.deepEqual(result.sequence, expected);
      assert.deepEqual(result.gallery.children.filter(child => child.image), result.images);
      assert.deepEqual(result.errors, []);
    });
  }
});

test('mounts a before-only YouTube trailer at its exact image anchor', async () => {
  const entries = [{ image: 'first.jpg' }, { image: 'second.jpg' }];
  const result = await mount(entries, [trailer]);
  assert.deepEqual(result.sequence, [trailerUrl, 'first.jpg', 'second.jpg']);
  const iframe = result.gallery.children[0].children[1];
  assert.equal(iframe.title, trailer.title);
  assert.equal(iframe.allowFullscreen, true);
  assert.equal(iframe.referrerPolicy, 'strict-origin-when-cross-origin');
  assert.deepEqual(result.errors, []);

  const reordered = await mount([...entries].reverse(), [trailer]);
  assert.deepEqual(reordered.sequence, ['second.jpg', trailerUrl, 'first.jpg']);
});

test('keeps a leading YouTube trailer first when its image anchor is excluded', async () => {
  const result = await mount([{ image: 'second.jpg' }, { image: 'third.jpg' }], [trailer]);
  assert.deepEqual(result.sequence, [trailerUrl, 'second.jpg', 'third.jpg']);
  assert.deepEqual(result.gallery.children.slice(1), result.images);
  assert.deepEqual(result.errors, []);
});

test('preserves ordered Sketchfab viewers through paired-anchor fallbacks', async t => {
  const models = [
    { ...model, before: 'second.jpg' },
    { ...model, id: 'c80d9972936a4c8fb928099724847919', title: 'Cessna 340 Flying', before: 'second.jpg' },
  ];
  const urls = models.map(GalleryEmbeds.source);
  for (const [name, images, expected] of [
    ['after the primary anchor', ['first.jpg', 'second.jpg', 'third.jpg'], ['first.jpg', ...urls, 'second.jpg', 'third.jpg']],
    ['before the surviving fallback anchor', ['second.jpg', 'third.jpg'], [...urls, 'second.jpg', 'third.jpg']],
    ['appended when both anchors are excluded', ['third.jpg'], ['third.jpg', ...urls]],
  ]) {
    await t.test(name, async () => {
      const result = await mount(images.map(image => ({ image })), models);
      assert.deepEqual(result.sequence, expected);
      assert.deepEqual(result.gallery.children.filter(child => child.image), result.images);
      assert.deepEqual(result.errors, []);
    });
  }
});

test('an unavailable or malformed embed list preserves the image gallery', async t => {
  for (const [name, response] of [['HTTP failure', { ok: false }], ['invalid JSON', { body: '{broken' }],
    ['unsafe local video', { body: JSON.stringify([{ ...video, file: '../private.mp4' }]) }]]) {
    await t.test(name, async () => {
      const result = await mount([{ image: 'first.jpg' }, { image: 'second.jpg' }], [trailer], response);
      assert.deepEqual(result.gallery.children.slice(0, 2), result.images);
      assert.deepEqual(result.sequence, ['first.jpg', 'second.jpg', 'gallery-embed-error']);
      assert.equal(result.gallery.children[2].attributes.role, 'status');
      assert.equal(result.errors.length, 1);
    });
  }
});

test('rejects invalid anchors, unsafe IDs, unsupported providers and duplicate viewers', () => {
  for (const patch of [{ after: undefined }, { after: '../first.jpg' }, { before: '' },
    { id: '../private' }, { type: 'constructor' },
    { type: 'iframe', id: 'https://other.example' }, { title: '' }, { caption: {} }]) {
    assert.throws(() => parse([{ ...model, ...patch }]));
  }
  assert.throws(() => parse([model, model]), /more than once/);
  assert.throws(() => parse([]));
  assert.throws(() => GalleryEmbeds.parse('{broken'), /valid JSON/);
});

test('publication validator requires an existing MP4 with its exact tracked filename', t => {
  const fixture = mkdtempSync(resolve(tmpdir(), 'gallery-embeds-'));
  t.after(() => {
    assert.ok(fixture.startsWith(resolve(tmpdir()) + sep));
    rmSync(fixture, { recursive: true, force: true });
  });
  for (const folder of ['galleries/example', '_data']) mkdirSync(resolve(fixture, folder), { recursive: true });
  const put = (path, text) => writeFileSync(resolve(fixture, path), text);
  put('galleries/gallery-data.js', data);
  put('galleries/gallery-embeds.js', source);
  put('_data/public-gallery-originals.json', JSON.stringify({ galleries: { example: { 'first.jpg': {} } } }));
  put('galleries/example/index.html', 'gallery_embeds: true\n');
  put('galleries/example/gallery-embeds.json', JSON.stringify([{ ...video, before: undefined }]));
  put('galleries/example/' + video.file, 'fixture MP4');
  const validator = readFileSync(resolve(root, '.github/scripts/validate-gallery-embeds.cjs'), 'utf8');
  const manifest = 'galleries/example/gallery-embeds.json';
  const trackedVideo = 'galleries/example/' + video.file;
  function validate(tracked) {
    return runInNewContext(validator, {
      __dirname: resolve(fixture, '.github/scripts'),
      require: name => name === 'node:child_process'
        ? { execFileSync: () => tracked.join('\0') + '\0' }
        : require(name),
      console: { log() {} },
    });
  }
  assert.doesNotThrow(() => validate([manifest, trackedVideo]));
  assert.throws(() => validate([manifest]), /exact tracked filename/);
  assert.throws(() => validate([manifest, trackedVideo.replace('.mp4', '.MP4')]), /exact tracked filename/);
  rmSync(resolve(fixture, trackedVideo));
  assert.throws(() => validate([manifest, trackedVideo]), /exact tracked filename/);
});

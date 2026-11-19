'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
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

async function mount(entries, embeds, { ok = true, body = JSON.stringify(embeds) } = {}) {
  const gallery = element('section');
  const images = entries.map(entry => Object.assign(element('a'), { image: entry.image }));
  gallery.append(...images);
  const errors = [];
  const api = runInNewContext(data + '\n' + source + '\nGalleryEmbeds', {
    document: { createElement: element },
    fetch: async () => ({ ok, text: async () => body }),
    console: { error: (...args) => errors.push(args) },
  });
  await api.mount(gallery, entries, images, 'gallery-embeds.json');
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
  for (const [name, response] of [['HTTP failure', { ok: false }], ['invalid JSON', { body: '{broken' }]]) {
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

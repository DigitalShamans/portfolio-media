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

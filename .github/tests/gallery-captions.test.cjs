const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const code = fs.readFileSync(path.join(root, 'galleries/gallery-captions.js'), 'utf8');

function shot(href) {
  return { href, children: [], attrs: {},
    getAttribute(name) { return name === 'href' ? this.href : this.attrs[name]; },
    setAttribute(name, value) { this.attrs[name] = value; },
    querySelector() { return this.children.find(child => child.className === 'shot-caption'); },
    append(child) { this.children.push(child); } };
}
function run(rows, shots = [], options = {}) {
  let notify;
  let observed;
  const gallery = { shots, querySelectorAll() { return this.shots; } };
  const template = rows === null ? null : { content: {
    querySelectorAll() { return rows.map(([image, textContent]) => ({ dataset: { image }, textContent })); }
  } };
  const document = { baseURI: 'https://example.test/galleries/test/',
    querySelector(selector) { return selector === '.gallery' ? gallery : template; },
    createElement(tag) {
      assert.equal(tag, 'span');
      return { set innerHTML(_) { throw new Error('Captions must never parse HTML'); } };
    }
  };
  const context = { document, URL };
  if (!options.noObserver) context.MutationObserver = class {
    constructor(callback) { notify = callback; }
    observe(target, config) { observed = { target, config }; }
  };
  vm.runInNewContext(code, context);
  return { gallery, notify, observed };
}

test('galleries without caption metadata remain untouched', () => {
  const image = shot('first.jpg');
  const state = run(null, [image]);
  assert.equal(image.children.length, 0);
  assert.equal(state.notify, undefined);
});
test('canonical original and versioned WebP URLs retain exact caption text', () => {
  const original = shot('https://media.test/public-media/revision/test/Exact.JPG');
  const reduced = shot('1440p/Exact.webp?v=abc&webp=q92');
  run([['Exact.JPG', 'First paragraph.\n\nSecond paragraph.']], [original, reduced]);
  for (const image of [original, reduced]) {
    assert.equal(image.children[0].textContent, 'First paragraph.\n\nSecond paragraph.');
    assert.equal(image.attrs['aria-describedby'], image.children[0].id);
  }
  assert.notEqual(original.children[0].id, reduced.children[0].id);
});
test('async replacement and image reorder use filenames rather than positions', () => {
  const fallback = shot('first.jpg');
  const state = run([['first.jpg', 'First'], ['second.jpg', 'Second']], [fallback]);
  const second = shot('1440p/second.webp');
  const first = shot('first.jpg');
  state.gallery.shots = [second, first];
  state.notify();
  assert.equal(second.children[0].textContent, 'Second');
  assert.equal(first.children[0].textContent, 'First');
  state.notify();
  assert.equal(second.children.length, 1);
  assert.equal(first.children.length, 1);
  assert.equal(state.observed.target, state.gallery);
  assert.equal(state.observed.config.childList, true);
  assert.equal(state.observed.config.subtree, undefined);
});
test('unknown case, malformed encoded names and empty captions do not block images', () => {
  const images = [shot('exact.jpg'), shot('%E0%A4%A'), shot('empty.jpg'), shot('Exact.jpg')];
  run([['Exact.jpg', 'Known'], ['empty.jpg', '  ']], images);
  assert.deepEqual(images.map(image => image.children.length), [0, 0, 0, 1]);
});
test('encoded filenames resolve and markup remains plain text', () => {
  const image = shot('1440p/Name%20One.webp');
  run([['Name One.jpg', '<img src=x onerror=alert(1)>']], [image]);
  assert.equal(image.children[0].textContent, '<img src=x onerror=alert(1)>');
});
test('initial captions still mount if MutationObserver is unavailable', () => {
  const image = shot('first.jpg');
  run([['first.jpg', 'Caption']], [image], { noObserver: true });
  assert.equal(image.children[0].textContent, 'Caption');
});
test('both portfolio variants render opt-in inert escaped metadata and dependencies', () => {
  const layout = fs.readFileSync(path.join(root, '_layouts/gallery.html'), 'utf8');
  assert.match(layout, /gallery_page = site\.pages/);
  assert.match(layout, /if gallery_page\.gallery_captions/);
  assert.match(layout, /<template id="gallery-caption-data">/);
  assert.match(layout, /caption\[0\] \| escape/);
  assert.match(layout, /caption\[1\] \| escape/);
  assert.match(layout, /gallery-captions\.css\?v=1/);
  assert.match(layout, /gallery-captions\.js\?v=1/);
});

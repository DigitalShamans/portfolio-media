'use strict';

const GalleryMapData = (() => {
  const filename = 'gallery-map.json';
  const imageName = name => typeof name === 'string' && !/[\\/\x00-\x1f]/.test(name) && /\.(jpe?g|png|webp|avif|gif)$/i.test(name);
  const object = value => value && typeof value === 'object' && !Array.isArray(value);

  function parse(text, availableFiles) {
    let map;
    try { map = JSON.parse(text); }
    catch { throw new Error(filename + ' is not valid JSON.'); }
    if (!object(map) || map.version !== 1) throw new Error(filename + ' must use version 1.');
    function image(name, context) {
      if (!imageName(name)) throw new Error(context + ': choose an image filename from this gallery.');
      if (availableFiles && !availableFiles.has(name)) throw new Error(context + ': image is not in gallery.json: ' + name);
      return name;
    }
    function label(value, context) {
      if (typeof value !== 'string' || !value.trim()) throw new Error(context + ' needs a description.');
      return value.trim();
    }
    if (!object(map.overview)) throw new Error('Choose an overview image.');
    const overview = { image: image(map.overview.image, 'Overview'), alt: label(map.overview.alt, 'Overview') };
    if (!Array.isArray(map.regions) || !map.regions.length) throw new Error('Add at least one screenshot to the map.');
    const used = new Set();
    const regions = map.regions.map((region, index) => {
      const context = 'Screenshot ' + (index + 1);
      if (!object(region)) throw new Error(context + ' must describe an image and its position.');
      const name = image(region.image, context);
      if (used.has(name)) throw new Error('Screenshot appears more than once: ' + name);
      used.add(name);
      for (const axis of ['x', 'y']) {
        if (!Number.isFinite(region[axis]) || region[axis] < 0 || region[axis] > 100) {
          throw new Error(context + ' (' + name + '): ' + axis + ' must be a number between 0 and 100.');
        }
      }
      return { image: name, label: label(region.label, context), x: region.x, y: region.y };
    });
    return { version: 1, overview, regions };
  }

  function position(x, y) {
    const clamp = number => Math.round(Math.max(10, Math.min(90, number)) * 100) / 100;
    return { x: clamp(x), y: clamp(y) };
  }

  return { filename, parse, position };
})();

if (typeof module !== 'undefined') module.exports = GalleryMapData;

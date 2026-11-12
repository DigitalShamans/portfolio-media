'use strict';

const GalleryData = (() => {
  function isImageName(name) {
    return typeof name === 'string' &&
      !/[\\/\x00-\x1f]/.test(name) &&
      /\.(jpe?g|png|webp|avif|gif)$/i.test(name);
  }

  function images(entry) {
    const names = [entry.image];
    if (entry.compare !== undefined) names.push(entry.compare);
    return names.concat(entry.additionalImages ?? []);
  }

  function parse(text, availableFiles) {
    let entries;
    try {
      entries = JSON.parse(text);
    } catch {
      throw new Error('gallery.json is not valid JSON.');
    }
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error('gallery.json must contain at least one image.');
    }

    const used = new Set();
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new Error('Each gallery entry must contain an image filename.');
      }
      const additional = entry.additionalImages ?? [];
      if (!Array.isArray(additional) || (additional.length > 0 && entry.compare === undefined)) {
        throw new Error('List additional images in order after the primary and comparison images.');
      }
      for (const name of images(entry)) {
        if (!isImageName(name)) throw new Error('Use image filenames from this gallery folder.');
        if (used.has(name)) throw new Error('Image appears more than once: ' + name);
        if (availableFiles && !availableFiles.has(name)) throw new Error('Missing gallery image: ' + name);
        used.add(name);
      }
    }
    return entries;
  }

  return { isImageName, images, parse };
})();

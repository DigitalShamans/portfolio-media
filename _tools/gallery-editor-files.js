'use strict';

const GalleryEditorFiles = (() => {
  function collect(originals, reduced, manifest) {
    const files = new Map(originals.filter(file => GalleryData.isImageName(file.name)).map(file => [file.name, file]));
    const previews = new Map(reduced.map(file => [file.name, file]));
    if (manifest !== null) {
      for (const name of GalleryData.parse(manifest).flatMap(GalleryData.images)) {
        const preview = previews.get(name.replace(/\.[^.]+$/, '.webp'));
        if (!files.has(name) && preview) files.set(name, preview);
      }
    }
    if (!files.size && manifest === null) throw new Error('This folder has no gallery images or matching 1440p WebPs.');
    const entries = manifest === null
      ? [...files.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map(image => ({ image }))
      : GalleryData.parse(manifest, files);
    return { files, entries };
  }

  async function readText(directory, name) {
    try { return await (await (await directory.getFileHandle(name)).getFile()).text(); }
    catch (error) { if (error.name === 'NotFoundError') return null; throw error; }
  }

  async function writeText(directory, name, text, expected) {
    if (await readText(directory, name) !== expected) {
      throw new Error(name + ' changed outside the editor. Reopen the folder before saving.');
    }
    const file = await directory.getFileHandle(name, { create: true });
    const writer = await file.createWritable();
    try { await writer.write(text); await writer.close(); }
    catch (error) { await writer.abort().catch(() => {}); throw error; }
  }

  return { collect, readText, writeText };
})();

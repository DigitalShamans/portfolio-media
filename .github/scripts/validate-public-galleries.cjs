'use strict';

const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');

const root = resolve(__dirname, '../..');
const delivery = JSON.parse(readFileSync(resolve(root, '_data/gallery_delivery.json'), 'utf8'));
const serviceOrigin = new URL(delivery.service_origin);
if (serviceOrigin.protocol !== 'https:' || serviceOrigin.origin !== delivery.service_origin ||
    (delivery.revision !== null && !/^[a-f0-9]{40}$/.test(delivery.revision || ''))) {
  throw new Error('Gallery delivery requires an HTTPS service origin and an immutable revision or null.');
}
const remoteOriginals = delivery.revision !== null;
const approved = remoteOriginals
  ? JSON.parse(readFileSync(resolve(root, '_data/public-gallery-originals.json'), 'utf8')).galleries
  : null;
const parserPath = resolve(root, 'galleries/gallery-data.js');
const parserSource = readFileSync(parserPath, 'utf8');
const GalleryData = runInNewContext(parserSource + '\nGalleryData', {}, { filename: parserPath });
// Use Git's paths so a case-insensitive checkout cannot hide a spelling mismatch.
const trackedPaths = execFileSync('git', ['ls-tree', '-r', '-z', '--name-only', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).split('\0');
if (trackedPaths.some(path => /^(?:artur\/)?galleries\/hb-rzstart\/(?:.*\/)?(?:gallery\.json|.*\.(?:jpe?g|png|webp|avif|gif))$/i.test(path))) {
  throw new Error('Remove protected RZ Start gallery files from the public source.');
}
const pagePaths = trackedPaths.filter(path => /\.(?:html?|md|markdown|mkdown|mdown|mkdn|mkd)$/i.test(path));
const publicFolders = JSON.parse(execFileSync('ruby', [resolve(__dirname, 'public-gallery-folders.rb')], {
  cwd: root,
  input: pagePaths.join('\0'),
  encoding: 'utf8',
}));
if (delivery.gallery_revisions !== undefined) {
  const revisions = delivery.gallery_revisions;
  if (!revisions || typeof revisions !== 'object' || Array.isArray(revisions) ||
      Object.entries(revisions).some(([folder, revision]) =>
        !publicFolders.includes(folder) || !/^[a-f0-9]{40}$/.test(revision || ''))) {
    throw new Error('Gallery revision overrides must name a public gallery and an immutable 40-character revision.');
  }
}
const filesByFolder = new Map(publicFolders.map(folder => [folder, new Set()]));
const previewsByFolder = new Map(publicFolders.map(folder => [folder, new Set()]));
for (const path of trackedPaths) {
  const parts = path.split('/');
  if (parts.length === 3 && parts[0] === 'galleries') filesByFolder.get(parts[1])?.add(parts[2]);
  if (parts.length === 4 && parts[0] === 'galleries' && parts[2] === '1440p') {
    previewsByFolder.get(parts[1])?.add(parts[3]);
  }
}

function describeFailure(text, files, message) {
  const missing = 'Missing gallery image: ';
  if (message.startsWith(missing)) {
    const name = message.slice(missing.length);
    const caseMatch = [...files].find(file => file.toLowerCase() === name.toLowerCase());
    return caseMatch
      ? `${message}. Use the exact tracked filename "${caseMatch}" (case matters).`
      : `${message}. Correct the filename or add the image to Git in this gallery folder.`;
  }
  if (message.startsWith('Image appears more than once: ')) {
    return `${message}. Keep only one reference across primary images and variants.`;
  }

  // The shared parser reports the rule that failed. Locate an invalid entry for the build log.
  let entries;
  try {
    entries = JSON.parse(text);
  } catch (error) {
    return `${message} Fix the JSON syntax: ${error.message}`;
  }
  const index = Array.isArray(entries) ? entries.findIndex(entry => {
    try {
      GalleryData.parse(JSON.stringify([entry]), files);
      return false;
    } catch (error) {
      return error.message === message;
    }
  }) : -1;
  return index < 0 ? message : `Entry ${index + 1}: ${message}`;
}

let failures = 0;
if (approved && Object.keys(approved).some(folder => !filesByFolder.has(folder))) {
  throw new Error('The approved originals include a folder without a public gallery page.');
}
for (const [folder, files] of filesByFolder) {
  const manifest = `galleries/${folder}/gallery.json`;
  if (!files.has('gallery.json')) {
    console.error(`${manifest}: Add and commit the missing gallery.json manifest.`);
    failures++;
    continue;
  }

  let text;
  try {
    text = readFileSync(resolve(root, manifest), 'utf8').replace(/^\uFEFF/, '');
  } catch (error) {
    console.error(`${manifest}: Cannot read the tracked manifest (${error.code}). Restore it in the checkout.`);
    failures++;
    continue;
  }

  try {
    const entries = GalleryData.parse(text, remoteOriginals ? undefined : files);
    const filenames = entries.flatMap(GalleryData.images);
    const approvedFiles = remoteOriginals ? Object.keys(approved[folder] || {}) : undefined;
    if (approvedFiles && (approvedFiles.length !== filenames.length ||
        filenames.some(filename => !approvedFiles.includes(filename)))) {
      throw new Error('The gallery manifest and the approved originals for this media revision must match.');
    }
    const previewNames = new Set();
    for (const filename of filenames) {
      if (remoteOriginals && (!/^[a-z0-9-]+$/.test(folder) || !/^[A-Za-z0-9_.-]+\.jpe?g$/i.test(filename))) {
        throw new Error(`Use a delivery-compatible gallery and JPG filename: ${folder}/${filename}`);
      }
      const preview = filename.replace(/\.[^.]+$/, '.webp');
      if (previewNames.has(preview)) throw new Error(`More than one original maps to ${preview}.`);
      if (!previewsByFolder.get(folder).has(preview)) {
        throw new Error(`Add and commit the matching WebP at galleries/${folder}/1440p/${preview}.`);
      }
      previewNames.add(preview);
    }
    console.log(`Validated ${manifest} (${entries.length} entries).`);
  } catch (error) {
    console.error(`${manifest}: ${describeFailure(text, files, error.message)}`);
    failures++;
  }
}

if (failures) {
  console.error(`Gallery validation failed for ${failures} manifest(s). Correct the errors before publishing.`);
  process.exitCode = 1;
}

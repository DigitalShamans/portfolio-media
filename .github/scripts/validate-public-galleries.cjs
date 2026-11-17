'use strict';

const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');

const root = resolve(__dirname, '../..');
const parserPath = resolve(root, 'galleries/gallery-data.js');
const parserSource = readFileSync(parserPath, 'utf8');
const GalleryData = runInNewContext(parserSource + '\nGalleryData', {}, { filename: parserPath });
// Use Git's paths so a case-insensitive checkout cannot hide a spelling mismatch.
const trackedPaths = execFileSync('git', ['ls-tree', '-r', '-z', '--name-only', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).split('\0');
const pagePaths = trackedPaths.filter(path => /\.(?:html?|md|markdown|mkdown|mdown|mkdn|mkd)$/i.test(path));
const publicFolders = JSON.parse(execFileSync('ruby', [resolve(__dirname, 'public-gallery-folders.rb')], {
  cwd: root,
  input: pagePaths.join('\0'),
  encoding: 'utf8',
}));
const filesByFolder = new Map(publicFolders.map(folder => [folder, new Set()]));
for (const path of trackedPaths) {
  const parts = path.split('/');
  if (parts.length === 3 && parts[0] === 'galleries') filesByFolder.get(parts[1])?.add(parts[2]);
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
    const entries = GalleryData.parse(text, files);
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

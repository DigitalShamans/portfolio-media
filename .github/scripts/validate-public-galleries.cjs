'use strict';

const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { appendFileSync, existsSync, readFileSync, writeFileSync } = require('node:fs');
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
const localGalleries = delivery.local_galleries ?? {};
if (typeof localGalleries !== 'object' || Array.isArray(localGalleries) ||
    Object.entries(localGalleries).some(([folder, directory]) =>
      !publicFolders.includes(folder) || typeof directory !== 'string' ||
      !/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/i.test(directory))) {
  throw new Error('Local gallery sources must name a public gallery and a repository directory.');
}
const localImages = new Map();
for (const [folder, directory] of Object.entries(localGalleries)) {
  const names = new Set();
  const normalized = new Set();
  const ambiguous = new Set();
  for (const file of trackedPaths) {
    if (!file.startsWith(directory + '/')) continue;
    const name = file.split('/').pop();
    if (!GalleryData.isImageName(name)) continue;
    const key = name.toLowerCase();
    if (normalized.has(key)) ambiguous.add(key);
    normalized.add(key);
    names.add(name);
  }
  localImages.set(folder, { names, ambiguous });
}
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

function validateManifest(folder, files, text) {
  const local = localImages.get(folder);
  if (local) {
    const entries = GalleryData.parse(text, local.names);
    const conflict = entries.flatMap(GalleryData.images).find(name => local.ambiguous.has(name.toLowerCase()));
    if (conflict) throw new Error(`Ambiguous image filename in ${localGalleries[folder]}: ${conflict}.`);
    return entries;
  }
  const entries = GalleryData.parse(text, remoteOriginals ? undefined : files);
  const filenames = entries.flatMap(GalleryData.images);
  // Approval describes the available inventory while the manifest selects what to show.
  if (remoteOriginals) {
    const unavailable = filenames.filter(name => !Object.hasOwn(approved[folder] || {}, name));
    if (unavailable.length) {
      throw new Error(`The gallery references an image outside the approved originals for this media revision: ${unavailable.join(', ')}.`);
    }
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
  return entries;
}

async function readPublished(path) {
  const response = await fetch('https://digitalshamans.co.uk/' + path, {
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}.`);
  return Buffer.from(await response.arrayBuffer());
}

async function publishedManifest(folder) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(folder)) throw new Error('Invalid gallery path.');
  const page = await readPublished(`galleries/${folder}/?published-manifest=${Date.now()}`);
  const encoded = page.toString('utf8').match(/data-gallery-asset-versions="([^"]+)"/)?.[1] || '{}';
  const version = JSON.parse(encoded.replaceAll('&quot;', '"').replaceAll('&amp;', '&'))['gallery.json'];
  if (!/^[a-f0-9]{40}$/.test(version || '')) throw new Error('The live gallery does not identify a manifest.');
  const payload = await readPublished(`galleries/${folder}/gallery.json?v=${version}`);
  const blob = createHash('sha1').update(`blob ${payload.length}\0`).update(payload).digest('hex');
  if (blob !== version) throw new Error('The live manifest does not match the version advertised by the gallery.');
  return { payload, version };
}

async function main() {
  const keepPublished = process.argv.includes('--keep-published-galleries');
  const heldGalleries = {};
  let failures = 0;
  if (approved && Object.keys(approved).some(folder => !filesByFolder.has(folder))) {
    throw new Error('The approved originals include a folder without a public gallery page.');
  }
  for (const [folder, files] of filesByFolder) {
    const manifest = `galleries/${folder}/gallery.json`;
    const path = resolve(root, manifest);
    if (!files.has('gallery.json')) {
      console.error(`${manifest}: Add and commit the missing gallery.json manifest.`);
      failures++;
      continue;
    }

    let text;
    try {
      text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
    } catch (error) {
      console.error(`${manifest}: Cannot read the tracked manifest (${error.code}). Restore it in the checkout.`);
      failures++;
      continue;
    }

    try {
      const entries = validateManifest(folder, files, text);
      console.log(`Validated ${manifest} (${entries.length} entries).`);
    } catch (error) {
      const reason = describeFailure(text, localImages.get(folder)?.names || files, error.message);
      if (keepPublished) {
        try {
          const { payload, version } = await publishedManifest(folder);
          validateManifest(folder, files, payload.toString('utf8').replace(/^\uFEFF/, ''));
          writeFileSync(path, payload);
          heldGalleries[folder] = version;
          const message = `Kept the published gallery. The draft needs attention. ${reason}`;
          const annotation = message.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
          console.warn(`::warning file=${manifest}::${annotation}`);
          if (process.env.GITHUB_STEP_SUMMARY) {
            appendFileSync(process.env.GITHUB_STEP_SUMMARY, `- **${folder}** kept its published manifest. ${reason}\n`);
          }
          continue;
        } catch (fallbackError) {
          console.error(`${manifest}: Cannot reuse the published manifest. ${fallbackError.message}`);
        }
      }
      console.error(`${manifest}: ${reason}`);
      failures++;
    }
  }

  if (failures) {
    console.error(`Gallery validation failed for ${failures} manifest(s). Correct the errors before publishing.`);
    process.exitCode = 1;
    return;
  }
  const statePath = resolve(root, 'gallery-webp-state.json');
  if (keepPublished && existsSync(statePath)) {
    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    state.held_gallery_manifests = heldGalleries;
    writeFileSync(statePath, JSON.stringify(state) + '\n');
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});


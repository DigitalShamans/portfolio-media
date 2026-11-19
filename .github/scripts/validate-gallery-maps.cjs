'use strict';

const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');
const GalleryMapData = require('../../galleries/gallery-map-data.js');
const GalleryData = runInNewContext(readFileSync(resolve(__dirname, '../../galleries/gallery-data.js'), 'utf8') + '\nGalleryData');

function validate(root, tracked) {
  const paths = new Set(tracked);
  let failures = 0;
  for (const path of tracked.filter(name => name.endsWith('/gallery-map.json'))) {
    try {
      const match = /^galleries\/(hb-[a-z0-9-]+)\/gallery-map\.json$/.exec(path);
      if (!match || match[1] === 'hb-rzstart') throw new Error('Maps must belong to a public gallery; protected galleries cannot publish map data.');
      const folder = 'galleries/' + match[1];
      if (!paths.has(folder + '/gallery.json') || !paths.has(folder + '/index.html') ||
          !/^layout:\s*gallery\s*$/m.test(readFileSync(resolve(root, folder, 'index.html'), 'utf8'))) {
        throw new Error('This map needs an existing public gallery page and gallery.json.');
      }
      const manifest = GalleryData.parse(readFileSync(resolve(root, folder, 'gallery.json'), 'utf8').replace(/^\uFEFF/, ''));
      const allowed = new Set(manifest.flatMap(GalleryData.images));
      const map = GalleryMapData.parse(readFileSync(resolve(root, path), 'utf8').replace(/^\uFEFF/, ''), allowed);
      for (const name of [map.overview.image, ...map.regions.map(region => region.image)]) {
        const preview = folder + '/1440p/' + name.replace(/\.[^.]+$/, '.webp');
        if (!paths.has(preview)) throw new Error('Add the exact-case matching WebP to Git: ' + preview);
      }
      console.log('Validated ' + path + ' (' + map.regions.length + ' screenshots).');
    } catch (error) {
      failures++; console.error(path + ': ' + error.message + ' Correct the map in Gallery Editor before publishing.');
    }
  }
  return failures;
}

if (require.main === module) {
  const root = resolve(process.argv[2] || resolve(__dirname, '../..'));
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  process.exitCode = validate(root, tracked) ? 1 : 0;
}
module.exports = { validate };

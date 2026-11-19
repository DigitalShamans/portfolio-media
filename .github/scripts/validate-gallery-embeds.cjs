'use strict';

const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');

const root = resolve(__dirname, '../..');
const data = readFileSync(resolve(root, 'galleries/gallery-data.js'), 'utf8');
const source = readFileSync(resolve(root, 'galleries/gallery-embeds.js'), 'utf8');
const GalleryEmbeds = runInNewContext(data + '\n' + source + '\nGalleryEmbeds');
const approved = JSON.parse(readFileSync(resolve(root, '_data/public-gallery-originals.json'), 'utf8')).galleries;
const tracked = new Set(execFileSync('git', ['ls-tree', '-r', '--name-only', '-z', 'HEAD'],
  { cwd: root, encoding: 'utf8' }).split('\0'));
for (const path of tracked) {
  const match = path.match(/^galleries\/([^/]+)\/gallery-embeds\.json$/);
  if (!match) continue;
  const [, folder] = match;
  const embeds = GalleryEmbeds.parse(readFileSync(resolve(root, path), 'utf8'));
  for (const embed of embeds) {
    for (const anchor of [embed.after, embed.before].filter(Boolean)) {
      if (!Object.hasOwn(approved[folder] ?? {}, anchor) && !tracked.has(`galleries/${folder}/${anchor}`)) {
        throw new Error(`${path}: Unknown image anchor ${anchor}.`);
      }
    }
  }
  const page = readFileSync(resolve(root, path.replace('gallery-embeds.json', 'index.html')), 'utf8');
  if (!/^gallery_embeds: true$/m.test(page)) throw new Error(path + ': Enable gallery_embeds on the gallery page.');
  console.log(`Validated ${path} (${embeds.length} viewers).`);
}

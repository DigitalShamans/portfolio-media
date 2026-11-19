'use strict';

const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, join, resolve } = require('node:path');
const test = require('node:test');

test('unlisted galleries are validated once and remain covered by a personal route alone', t => {
  const root = resolve(__dirname, '../..');
  const cwd = mkdtempSync(join(tmpdir(), 'public-gallery-routes-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const write = (path, text) => {
    mkdirSync(join(cwd, dirname(path)), { recursive: true });
    writeFileSync(join(cwd, path), text);
  };
  const git = (...args) => execFileSync('git', args, { cwd });
  const commit = () => {
    git('add', '-A');
    git('-c', 'user.name=Gallery test', '-c', 'user.email=test@example.invalid',
      'commit', '-qm', 'Gallery fixture');
  };
  const validate = () => spawnSync(process.execPath, ['.github/scripts/validate-public-galleries.cjs'],
    { cwd, encoding: 'utf8' });

  git('init', '-q');
  for (const path of ['.github/scripts/validate-public-galleries.cjs',
    '.github/scripts/public-gallery-folders.rb', 'galleries/gallery-data.js']) {
    mkdirSync(join(cwd, dirname(path)), { recursive: true });
    copyFileSync(join(root, path), join(cwd, path));
  }
  const studio = 'galleries/hb-egypt/index.html';
  const manifest = 'galleries/hb-egypt/gallery.json';
  const preview = 'galleries/hb-egypt/1440p/first.webp';
  const configureDelivery = revision => write('_data/gallery_delivery.json', JSON.stringify({
    service_origin: 'https://images.example.test', revision,
  }));
  configureDelivery(null);
  write('_data/portfolio.json', '{"recent":[]}');
  write(studio, '---\nlayout: gallery\n---\n');
  write('artur/galleries/pyramids/index.html', '---\nlayout: gallery\nportfolio: personal\ngallery: hb-egypt\n---\n');
  write('rz-start.html', '---\nlayout: locked-gallery\npermalink: /galleries/hb-rzstart/\n---\n');
  write('galleries/hb-egypt/first.jpg', '');
  write(preview, '');
  write(manifest, '[{"image":"first.jpg"}]');
  commit();

  const valid = validate();
  assert.equal(valid.status, 0, valid.stderr);
  const validated = [...valid.stdout.matchAll(/^Validated (\S+) /gm)].map(match => match[1]);
  assert.deepEqual(validated, [manifest]);

  configureDelivery('a'.repeat(40));
  write('_data/public-gallery-originals.json',
    JSON.stringify({ galleries: { 'hb-egypt': { 'first.jpg': { blob: 'b'.repeat(40), size: 1 } } } }));
  rmSync(join(cwd, 'galleries/hb-egypt/first.jpg'));
  commit();
  const remote = validate();
  assert.equal(remote.status, 0, remote.stderr);

  write(manifest, '[{"image":"unapproved.jpg"}]');
  commit();
  const unapproved = validate();
  assert.equal(unapproved.status, 1, unapproved.stderr);
  assert.match(unapproved.stderr, /outside the approved originals for this media revision/);

  write(manifest, '[{"image":"first.jpg"}]');
  rmSync(join(cwd, preview));
  commit();
  const missingPreview = validate();
  assert.equal(missingPreview.status, 1, missingPreview.stderr);
  assert.match(missingPreview.stderr, /Add and commit the matching WebP/);
  write(preview, '');

  write(manifest, '{broken');
  commit();
  const invalid = validate();
  assert.equal(invalid.status, 1, invalid.stderr);
  assert.match(invalid.stderr, /galleries\/hb-egypt\/gallery\.json: gallery\.json is not valid JSON/);

  rmSync(join(cwd, studio));
  commit();
  const personalOnly = validate();
  assert.equal(personalOnly.status, 1, personalOnly.stderr);
  assert.match(personalOnly.stderr, /galleries\/hb-egypt\/gallery\.json: gallery\.json is not valid JSON/);
});

test('gallery editor selections use approved originals without rewriting the approval inventory', t => {
  const root = resolve(__dirname, '../..');
  const cwd = mkdtempSync(join(tmpdir(), 'gallery-editor-selection-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const write = (path, text) => {
    mkdirSync(join(cwd, dirname(path)), { recursive: true });
    writeFileSync(join(cwd, path), text);
  };
  const git = (...args) => execFileSync('git', args, { cwd });
  const commit = () => {
    git('add', '-A');
    git('-c', 'user.name=Gallery test', '-c', 'user.email=test@example.invalid',
      'commit', '-qm', 'Gallery selection fixture');
  };
  const validate = () => spawnSync(process.execPath, ['.github/scripts/validate-public-galleries.cjs'],
    { cwd, encoding: 'utf8' });
  git('init', '-q');
  for (const path of ['.github/scripts/validate-public-galleries.cjs',
    '.github/scripts/public-gallery-folders.rb', 'galleries/gallery-data.js']) {
    mkdirSync(join(cwd, dirname(path)), { recursive: true });
    copyFileSync(join(root, path), join(cwd, path));
  }
  const names = [4, 3, 2, 6, 5, 1].map(index =>
    `digital-shamans-nfs-unbound-announce-trailer-0${index}.jpg`);
  const manifest = 'galleries/nfs-unbound/gallery.json';
  const approvalPath = '_data/public-gallery-originals.json';
  const inventory = JSON.stringify({ galleries: { 'nfs-unbound': Object.fromEntries(
    names.map(name => [name, { blob: 'b'.repeat(40), size: 100 }])) } });
  write(approvalPath, inventory);
  write('_data/gallery_delivery.json', JSON.stringify({
    service_origin: 'https://images.example.test', revision: 'a'.repeat(40),
  }));
  write('galleries/nfs-unbound/index.html', '---\nlayout: gallery\n---\n');
  for (const name of names) write(`galleries/nfs-unbound/1440p/${name.replace(/\.jpg$/, '.webp')}`, '');
  const select = entries => {
    write(manifest, JSON.stringify(entries));
    commit();
    return validate();
  };
  for (const entries of [
    names.map(image => ({ image })),
    [...names].reverse().map(image => ({ image })),
    [{ image: names[0], compare: names[1], additionalImages: [names[2]] }, { image: names[5] }],
    [{ image: names[0] }],
    names.map(image => ({ image })),
  ]) {
    const result = select(entries);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(cwd, approvalPath), 'utf8'), inventory,
      'gallery selection must not rewrite approved original identities');
  }
  const empty = select([]);
  assert.equal(empty.status, 1, 'an empty gallery must still be rejected');
  write('galleries/nfs-unbound/1440p/unapproved.webp', '');
  const unknown = select([{ image: 'unapproved.jpg' }]);
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /outside the approved originals/);
  rmSync(join(cwd, `galleries/nfs-unbound/1440p/${names[0].replace(/\.jpg$/, '.webp')}`));
  const missingPreview = select([{ image: names[0] }]);
  assert.equal(missingPreview.status, 1);
  assert.match(missingPreview.stderr, /Add and commit the matching WebP/);
});


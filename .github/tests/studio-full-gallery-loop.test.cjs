'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const studio = JSON.parse(fs.readFileSync(path.join(root, '_data/portfolio.json'), 'utf8'));
const personal = JSON.parse(fs.readFileSync(path.join(root, '_data/personal_portfolio.json'), 'utf8'));
const navigation = fs.readFileSync(path.join(root, '_includes/gallery-navigation.html'), 'utf8');
const homepage = fs.readFileSync(path.join(root, '_layouts/portfolio.html'), 'utf8');

test('all twelve studio Full Portfolio cards link to existing local gallery pages', () => {
  assert.equal(studio.full.length, 12);
  assert.match(homepage, /for project in portfolio\.full/);
  assert.match(homepage, /project\.url \| default: studio_project_url/);
  const seen = new Set();
  for (const project of studio.full) {
    assert.match(project.url, /^\/galleries\/(?!hb-)[a-z0-9-]+\/$/, project.title);
    assert(!seen.has(project.url), 'duplicate studio gallery route: ' + project.url);
    seen.add(project.url);
    const stub = path.join(root, project.url.slice(1), 'index.html');
    assert(fs.existsSync(stub), 'studio gallery route does not exist: ' + stub);
    const source = fs.readFileSync(stub, 'utf8');
    assert.match(source, /layout:\s*["']?gallery["']?/);
    assert.doesNotMatch(source, /portfolio:\s*["']?personal["']?/);
  }
});

test('studio Full Portfolio follows card order and wraps Vegetation to NFS Unbound', () => {
  const list = studio.full;
  assert.equal(list[0].url, '/galleries/nfs-unbound/');
  assert.equal(list[1].url, '/galleries/vehicles-aircrafts/');
  assert.equal(list[list.length - 1].url, '/galleries/vegetation/');
  for (let i = 0; i < list.length; i++) {
    const previous = list[(i + list.length - 1) % list.length];
    const next = list[(i + 1) % list.length];
    assert.match(previous.url, /^\/galleries\//);
    assert.match(next.url, /^\/galleries\//);
    assert.notEqual(previous.url, list[i].url);
    assert.notEqual(next.url, list[i].url);
  }
  assert.match(navigation, /for studio_project in site\.data\.portfolio\.full/);
  assert.match(navigation, /studio_project\.url == current_gallery_route/);
  assert.match(navigation, /navigation_items = site\.data\.portfolio\.full/);
  assert.match(navigation, /navigation_previous\.url/);
  assert.match(navigation, /navigation_next\.url/);
  assert.match(navigation, /data-gallery-loop="{{ navigation_loop }}"/);
});

test('studio, personal and Hard Bullet loops remain mutually independent', () => {
  assert.equal(studio.recent.length, 8);
  const recent = studio.recent.map(project => '/galleries/' + project.folder + '/');
  const studioFull = new Set(studio.full.map(project => project.url));
  const personalFull = new Set(personal.full.map(project => project.url));
  assert(recent.every(url => /^\/galleries\/hb-/.test(url)));
  assert(recent.every(url => !studioFull.has(url)));
  assert([...studioFull].every(url => !personalFull.has(url)));
  assert.match(navigation, /navigation_items = site\.data\.portfolio\.recent/);
  assert.match(navigation, /navigation_items = site\.data\.personal_portfolio\.full/);
  assert.match(navigation, /navigation_loop = 'hard-bullet'/);
  assert.match(navigation, /navigation_loop = 'full'/);
});

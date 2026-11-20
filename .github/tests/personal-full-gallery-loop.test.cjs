'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const personal = JSON.parse(fs.readFileSync(path.join(root, '_data/personal_portfolio.json'), 'utf8'));
const recent = JSON.parse(fs.readFileSync(path.join(root, '_data/portfolio.json'), 'utf8')).recent;
const navigation = fs.readFileSync(path.join(root, '_includes/gallery-navigation.html'), 'utf8');
const homepage = fs.readFileSync(path.join(root, '_layouts/portfolio.html'), 'utf8');

test('all 12 Full Portfolio cards resolve to existing personal gallery pages', () => {
  assert.equal(personal.full.length, 12);
  assert.match(homepage, /for project in portfolio\.full/);
  assert.match(homepage, /project\.url \| default: studio_project_url/);
  const paths = new Set();
  for (const item of personal.full) {
    assert.match(item.url, /^\/artur\/galleries\/(?!hb-)[a-z0-9-]+\/$/);
    assert(!paths.has(item.url), 'each Full Portfolio gallery must be unique: ' + item.url);
    paths.add(item.url);
    const stub = path.join(root, item.url.slice(1), 'index.html');
    assert(fs.existsSync(stub), 'missing local gallery route: ' + stub);
    const content = fs.readFileSync(stub, 'utf8');
    assert.match(content, /layout:\s*["']?gallery["']?/);
    assert.match(content, /portfolio:\s*["']?personal["']?/);
  }
});

test('each Full Portfolio page has precisely one previous and next in tile order', () => {
  const list = personal.full;
  for (let i = 0; i < list.length; i++) {
    const previous = list[(i + list.length - 1) % list.length];
    const next = list[(i + 1) % list.length];
    assert.notEqual(previous.url, list[i].url);
    assert.notEqual(next.url, list[i].url);
    assert.match(previous.url, /^\/artur\/galleries\//);
    assert.match(next.url, /^\/artur\/galleries\//);
  }
  assert.equal(list.at(-1).url, '/artur/galleries/high-poly-models/');
  assert.equal(list[0].url, '/artur/galleries/nfs-unbound/');
  assert.equal(list[1].url, '/artur/galleries/phantom-covert-ops/');
  // The template derives the loop directly from the homepage card order.
  assert.match(navigation, /for personal_project in site\.data\.personal_portfolio\.full/);
  assert.match(navigation, /personal_project\.url == current_gallery_route/);
  assert.match(navigation, /navigation_items = site\.data\.personal_portfolio\.full/);
  assert.match(navigation, /navigation_previous\.url/);
  assert.match(navigation, /navigation_next\.url/);
});

test('the existing eight Hard Bullet galleries remain independent', () => {
  assert.equal(recent.length, 8);
  const hardBullet = recent.map(item => '/artur/galleries/' + item.folder + '/');
  assert(hardBullet.every(url => /^\/artur\/galleries\/hb-/.test(url)));
  const full = new Set(personal.full.map(item => item.url));
  assert(hardBullet.every(url => !full.has(url)));
  assert.match(navigation, /navigation_items = site\.data\.portfolio\.recent/);
  assert.match(navigation, /page\.portfolio == 'personal'/);
  assert.match(navigation, /navigation_loop = 'hard-bullet'/);
  assert.match(navigation, /navigation_loop = 'full'/);
  assert.match(navigation, /data-gallery-loop="{{ navigation_loop }}"/);
});

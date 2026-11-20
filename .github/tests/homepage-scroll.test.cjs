'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const css = fs.readFileSync(path.join(root, 'assets/portfolio.css'), 'utf8');
const layout = fs.readFileSync(path.join(root, '_layouts/portfolio.html'), 'utf8');
const studio = JSON.parse(fs.readFileSync(path.join(root, '_data/portfolio.json'), 'utf8'));
const preload = fs.readFileSync(path.join(root, 'assets/portfolio-preload.js'), 'utf8');
const home = fs.readFileSync(path.join(root, 'assets/home-sections.js'), 'utf8');

test('Recent Work banners do not intercept wheel movement with a hidden nested scrollbar', () => {
  const region = css.match(/\.recent-galleries\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.ok(region.includes('--banner-gap'), 'banner spacing remains intact');
  assert.doesNotMatch(region, /(?:max-)?(?:block-size|height)\s*:/i,
    'the banner region must grow with all its children');
  assert.doesNotMatch(region, /(?:overflow(?:-[xy])?|scrollbar-width)\s*:/i,
    'Recent Work must not establish a second scroll container');
  assert.doesNotMatch(css, /\.recent-galleries::-(?:webkit|moz)-scrollbar/i);
  assert.doesNotMatch(css, /#recent-work\s*\{[^}]*container-type:/i,
    'the old cqi height cap is gone');
});

test('both homepages use the native document scroll and still display all gallery banners', () => {
  assert.match(layout, /portfolio\.css' \| relative_url }}\?v=8/);
  assert.match(layout, /<div class="recent-galleries" role="region" aria-label="Gallery banners">/);
  assert.doesNotMatch(layout, /recent-galleries"[^>]*tabindex=/);
  assert.match(layout, /for gallery in site\.data\.portfolio\.recent/);
  assert.match(layout, /for project in portfolio\.full/);
  assert.match(layout, /include site-header\.html/);
  assert.equal(studio.recent.length, 8);
  assert.match(css, /\.recent-gallery-list\s*\{[^}]*display:\s*grid/s);
  assert.match(css, /\.recent-gallery img\s*\{[^}]*width:\s*100%/s);
});

test('preloading and homepage navigation observe the page without swallowing wheel events', () => {
  for (const script of [preload, home]) {
    assert.doesNotMatch(script, /addEventListener\(['"]wheel['"]/);
    assert.doesNotMatch(script, /preventDefault\s*\(/);
    assert.doesNotMatch(script, /normalizeScroll\s*\(/);
  }
  assert.match(home, /addEventListener\(['"]scroll['"], scheduleNavigation, \{ passive: true \}\)/);
});

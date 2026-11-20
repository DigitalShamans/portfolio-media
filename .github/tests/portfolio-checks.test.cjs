'use strict';

const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, join, resolve } = require('node:path');
const test = require('node:test');

const root = resolve(__dirname, '../..');

function fixture(t, changes = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'portfolio-checks-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const write = (path, content) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), content);
  };
  mkdirSync(join(cwd, '.github/scripts'), { recursive: true });
  copyFileSync(join(root, '.github/scripts/check-portfolio.py'), join(cwd, '.github/scripts/check-portfolio.py'));
  const files = {
    'assets/nested/script with spaces.js': 'const valid = true;',
    'assets/example.cjs': "module.exports = 'fixture';",
    'assets/example.mjs': 'export const valid = true;',
    '_data/example.json': '{"valid":true}',
    '.github/tests/fixture.test.cjs': "require('node:test')('offline CJS fixture', () => {});",
    '.github/tests/gallery-browser-check.test.mjs': "import test from 'node:test'; test('offline MJS fixture', () => {});",
    '.github/tests/excluded.browser.test.cjs': "throw new Error('BROWSER_SHOULD_NOT_RUN');",
    '.github/tests/test_fixture.py': 'import unittest\nclass Fixture(unittest.TestCase):\n    def test_valid(self): self.assertTrue(True)\n',
  };
  for (const name of ['public-galleries', 'gallery-embeds', 'gallery-maps']) {
    files[`.github/scripts/validate-${name}.cjs`] = `console.log('VALIDATOR:${name}');`;
  }
  for (const [path, content] of Object.entries({ ...files, ...changes })) write(path, content);
  execFileSync('git', ['init', '-q'], { cwd });
  execFileSync('git', ['add', '-A'], { cwd });
  const env = { ...process.env };
  // The fixture starts a separate Node test run, outside this test worker.
  delete env.NODE_TEST_CONTEXT;
  return spawnSync('python3', ['.github/scripts/check-portfolio.py'], { cwd, env, encoding: 'utf8' });
}

test('shared checks discover nested source and offline tests while excluding browser execution', t => {
  const result = fixture(t);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Source syntax passed:/);
  assert.match(result.stdout, /offline CJS fixture/);
  assert.match(result.stdout, /offline MJS fixture/);
  assert.doesNotMatch(result.stdout + result.stderr, /BROWSER_SHOULD_NOT_RUN/);
  for (const name of ['public-galleries', 'gallery-embeds', 'gallery-maps']) {
    assert.match(result.stdout, new RegExp('VALIDATOR:' + name));
  }
  assert.match(result.stderr, /Ran 1 test/);
});

test('syntax failures anywhere in tracked JS, JSON or Python fail the shared checks', t => {
  for (const [path, content] of [
    ['assets/nested/broken script.js', 'const broken = ;'],
    ['assets/broken.cjs', 'const broken = ;'],
    ['assets/broken.mjs', 'export const broken = ;'],
    ['_data/example.json', '{"duplicate":1,"duplicate":2}'],
    ['_data/example.json', '{"value":NaN}'],
    ['_data/example.json', '{broken json'],
    ['.github/scripts/broken.py', 'def broken(:\n'],
    ['.github/scripts/broken.py', 'return\n'],
  ]) {
    const result = fixture(t, { [path]: content });
    assert.notEqual(result.status, 0, path);
    assert.match(result.stderr, /Portfolio checks failed:/, path);
    assert.ok((result.stdout + result.stderr).includes(path), path);
    assert.doesNotMatch(result.stdout, /VALIDATOR:/, path);
  }
});

test('regression and manifest validation failures cannot pass the shared checks', t => {
  for (const [path, content] of [
    ['.github/tests/fixture.test.cjs', "require('node:test')('failure', () => { throw new Error('fixture failure'); });"],
    ['.github/tests/test_fixture.py', 'import unittest\nclass Fixture(unittest.TestCase):\n    def test_invalid(self): self.fail("fixture failure")\n'],
    ['.github/scripts/validate-public-galleries.cjs', 'process.exit(1);'],
  ]) {
    const result = fixture(t, { [path]: content });
    assert.notEqual(result.status, 0, path);
    assert.match(result.stderr, /Portfolio checks failed:/, path);
    assert.doesNotMatch(result.stdout, /VALIDATOR:gallery-maps/, path);
  }
});

test('every pull request and publication use the same validation action', () => {
  const read = path => readFileSync(join(root, path), 'utf8');
  const pr = read('.github/workflows/gallery-navigation-checks.yml');
  const publication = read('.github/workflows/publish-pages.yml');
  const action = read('.github/actions/validate-portfolio/action.yml');
  assert.match(pr, /pull_request:/);
  assert.doesNotMatch(pr, /pull_request_target|paths(?:-ignore)?:|branches(?:-ignore)?:/);
  assert.match(pr, /contents: read/);
  assert.match(pr, /persist-credentials: false/);
  assert.doesNotMatch(pr, /pages: write|id-token: write|secrets\.|deploy-pages|upload-pages-artifact/);
  for (const workflow of [pr, publication]) assert.match(workflow, /uses: \.\/\.github\/actions\/validate-portfolio/);
  for (const command of ['check-portfolio.py', 'generate-gallery-asset-versions.py',
    'actions/jekyll-build-pages@v1', 'prune-unpublished-gallery-images.py', 'validate-homepage-gallery-links.py']) {
    assert.ok(action.includes(command), command);
  }
});

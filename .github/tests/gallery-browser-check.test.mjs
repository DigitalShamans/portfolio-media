import test from 'node:test';
import assert from 'node:assert/strict';
import { CHECK_TIMEOUT_MS, FALLBACK_TIMEOUT_MS, runGalleryBrowserCheck,
  withBrowserCheckTimeout, BrowserCheckTimeout } from '../scripts/gallery-browser-check.mjs';

test('in-app success never calls a fallback', async () => {
  const result = await runGalleryBrowserCheck({ inApp: async () => ({ passed: true }),
    deliveryFallback: () => { throw Error('Should not run'); } });
  assert.equal(result.status, 'interactive-verified');
  assert.equal(result.attempts.length, 1);
  assert.equal(CHECK_TIMEOUT_MS, 5000);
  assert.equal(FALLBACK_TIMEOUT_MS, 2000);
});

test('a stalled in-app read automatically reaches a fresh-tab retry', async () => {
  const result = await runGalleryBrowserCheck({ inApp: () => new Promise(() => {}),
    retryInApp: async () => ({ passed: true }), timeoutMs: 15 });
  assert.equal(result.attempts[0].reason, 'timeout');
  assert.equal(result.attempts[1].backend, 'fresh-in-app');
  assert.equal(result.interactivePassed, true);
});

test('two stalled reads fall back without claiming interaction passed', async () => {
  const never = () => new Promise(() => {});
  const result = await runGalleryBrowserCheck({ inApp: never, retryInApp: never,
    deliveryFallback: async () => ({ passed: true }), timeoutMs: 10 });
  assert.equal(result.status, 'delivery-only');
  assert.equal(result.needsInteractiveVerification, true);
  assert.equal(result.interactivePassed, false);
  assert.deepEqual(result.attempts.map(a => a.backend), ['in-app', 'fresh-in-app', 'delivery']);
});

test('fallback also has a deadline and no unbounded retry loop', async () => {
  const result = await runGalleryBrowserCheck({ inApp: async () => { throw Error('driver failed'); },
    deliveryFallback: () => new Promise(() => {}), fallbackTimeoutMs: 10 });
  assert.equal(result.status, 'unverified');
  assert.equal(result.attempts.length, 2);
  assert.equal(result.attempts[1].reason, 'timeout');
});

test('late success cannot replace a timeout result', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const result = await runGalleryBrowserCheck({ inApp: () => pending,
    deliveryFallback: async () => ({ passed: true }), timeoutMs: 10 });
  finish({ passed: true });
  await Promise.resolve();
  assert.equal(result.status, 'delivery-only');
  assert.equal(result.interactivePassed, false);
});

test('false or missing assertions cannot silently pass', async () => {
  const result = await runGalleryBrowserCheck({ inApp: async () => ({ passed: false }),
    retryInApp: async () => undefined });
  assert.equal(result.status, 'unverified');
});

test('timeouts reject locally and configuration cannot widen the limits', async () => {
  await assert.rejects(withBrowserCheckTimeout(() => new Promise(() => {}), 10), BrowserCheckTimeout);
  await assert.rejects(runGalleryBrowserCheck({ inApp: () => {}, timeoutMs: 30000 }), TypeError);
  await assert.rejects(runGalleryBrowserCheck({ inApp: () => {}, fallbackTimeoutMs: 10000 }), TypeError);
});

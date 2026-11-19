// Observation/check callbacks only. A deadline cannot cancel an underlying UI input.
export const CHECK_TIMEOUT_MS = 5_000;
export const FALLBACK_TIMEOUT_MS = 2_000;

export class BrowserCheckTimeout extends Error {
  constructor(label, milliseconds) {
    super(`${label} exceeded ${milliseconds}ms`);
    this.name = 'BrowserCheckTimeout';
  }
}

export async function withBrowserCheckTimeout(check, milliseconds = CHECK_TIMEOUT_MS) {
  if (typeof check !== 'function' || !Number.isInteger(milliseconds) ||
      milliseconds < 1 || milliseconds > CHECK_TIMEOUT_MS) {
    throw new TypeError('Provide a check and a deadline of 1â€“10000ms.');
  }
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(check),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new BrowserCheckTimeout('Browser check', milliseconds)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// After one in-app attempt and optional fresh-tab retry, automatically use the
// independent delivery check. HTTP success never becomes interactive acceptance.
export async function runGalleryBrowserCheck({ inApp, retryInApp, deliveryFallback,
  timeoutMs = CHECK_TIMEOUT_MS, fallbackTimeoutMs = FALLBACK_TIMEOUT_MS }) {
  if (typeof inApp !== 'function' ||
      (retryInApp !== undefined && typeof retryInApp !== 'function') ||
      (deliveryFallback !== undefined && typeof deliveryFallback !== 'function') ||
      !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > CHECK_TIMEOUT_MS ||
      !Number.isInteger(fallbackTimeoutMs) || fallbackTimeoutMs < 1 || fallbackTimeoutMs > FALLBACK_TIMEOUT_MS) {
    throw new TypeError('Invalid browser-check callbacks or deadline.');
  }
  const attempts = [];
  for (const [backend, check, deadline] of [
    ['in-app', inApp, timeoutMs],
    ['fresh-in-app', retryInApp, timeoutMs],
    ['delivery', deliveryFallback, fallbackTimeoutMs],
  ]) {
    if (!check) continue;
    const started = Date.now();
    try {
      const value = await withBrowserCheckTimeout(check, deadline);
      const passed = value?.passed === true;
      attempts.push({ backend, passed, elapsedMs: Date.now() - started });
      if (!passed) continue;
      return { status: backend === 'delivery' ? 'delivery-only' : 'interactive-verified',
        interactivePassed: backend !== 'delivery', needsInteractiveVerification: backend === 'delivery',
        attempts, value };
    } catch (error) {
      // Raw driver errors can contain temporary URLs. Keep only a bounded reason.
      attempts.push({ backend, passed: false, elapsedMs: Date.now() - started,
        reason: error instanceof BrowserCheckTimeout ? 'timeout' : 'check-failed' });
    }
  }
  return { status: 'unverified', interactivePassed: false, needsInteractiveVerification: true, attempts };
}

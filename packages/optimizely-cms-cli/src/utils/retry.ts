export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  retryableStatusCodes?: number[];
}

const DEFAULTS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  retryableStatusCodes: [429, 500, 502, 503, 504],
};

/**
 * Wraps an async function with retry logic using exponential backoff.
 * Retries on transient HTTP errors (429, 5xx) by default.
 */
export async function withRetry<T extends { response: Response }>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const { maxRetries, baseDelayMs, retryableStatusCodes } = {
    ...DEFAULTS,
    ...options,
  };

  let lastResult: T | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    lastResult = await fn();

    if (
      lastResult.response.ok ||
      !retryableStatusCodes.includes(lastResult.response.status)
    ) {
      return lastResult;
    }

    if (attempt < maxRetries) {
      const delay = baseDelayMs * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  return lastResult!;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

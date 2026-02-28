import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../utils/retry.js';

function mockResponse(status: number, ok?: boolean) {
  return {
    response: {
      status,
      ok: ok ?? (status >= 200 && status < 300),
    } as Response,
  };
}

describe('withRetry', () => {
  it('should return immediately on success', async () => {
    const fn = vi.fn().mockResolvedValue(mockResponse(200));
    const result = await withRetry(fn, { baseDelayMs: 1 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result.response.status).toBe(200);
  });

  it('should return immediately on non-retryable error', async () => {
    const fn = vi.fn().mockResolvedValue(mockResponse(400));
    const result = await withRetry(fn, { baseDelayMs: 1 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result.response.status).toBe(400);
  });

  it('should retry on 429 and eventually succeed', async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(429))
      .mockResolvedValueOnce(mockResponse(200));

    const result = await withRetry(fn, { baseDelayMs: 1 });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(result.response.status).toBe(200);
  });

  it('should retry on 500 and eventually succeed', async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(500))
      .mockResolvedValueOnce(mockResponse(503))
      .mockResolvedValueOnce(mockResponse(200));

    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 1 });
    expect(fn).toHaveBeenCalledTimes(3);
    expect(result.response.status).toBe(200);
  });

  it('should stop after maxRetries and return last result', async () => {
    const fn = vi.fn().mockResolvedValue(mockResponse(500));
    const result = await withRetry(fn, { maxRetries: 2, baseDelayMs: 1 });
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    expect(result.response.status).toBe(500);
  });

  it('should use custom retryable status codes', async () => {
    const fn = vi.fn().mockResolvedValue(mockResponse(418));
    const result = await withRetry(fn, {
      baseDelayMs: 1,
      retryableStatusCodes: [418],
      maxRetries: 1,
    });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(result.response.status).toBe(418);
  });
});

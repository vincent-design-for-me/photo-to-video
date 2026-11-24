export type FetchRetryOptions = {
  /** Per-attempt timeout in milliseconds. Defaults to 60_000 (60s). */
  timeoutMs?: number;
  /** Maximum number of attempts (including the initial attempt). Defaults to 3. */
  maxAttempts?: number;
  /** Initial backoff delay in ms before the first retry. Defaults to 1500. */
  baseDelayMs?: number;
  /** Upper bound for backoff delay in ms. Defaults to 15_000. */
  maxDelayMs?: number;
  /** HTTP status codes that should be retried. */
  retryOnStatuses?: readonly number[];
  /** Label used in diagnostic logs. */
  label?: string;
  /** Optional custom fetch implementation (useful for testing). */
  fetchImpl?: typeof fetch;
  /** Optional custom sleep implementation (useful for testing). */
  sleepImpl?: (ms: number) => Promise<void>;
};

export const DEFAULT_RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504] as const;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }
  const dateMs = Date.parse(header);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return null;
}

function computeBackoffMs(attempt: number, baseDelayMs: number, maxDelayMs: number, retryAfterHeader: string | null): number {
  const retryAfter = parseRetryAfterMs(retryAfterHeader);
  if (retryAfter !== null) {
    return Math.min(maxDelayMs, Math.max(250, retryAfter));
  }
  const exponential = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
  const jitter = Math.round(exponential * (0.75 + Math.random() * 0.5));
  return Math.min(maxDelayMs, jitter);
}

export function isTransientFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "AbortError" || error.name === "TimeoutError") return true;
  if (error.name === "TypeError") return true; // undici network errors surface as TypeError
  const code = (error as { code?: string; cause?: { code?: string } }).code
    ?? (error as { cause?: { code?: string } }).cause?.code;
  if (code && ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EPIPE", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT", "UND_ERR_SOCKET"].includes(code)) {
    return true;
  }
  return /fetch failed|network|socket|timeout|timed out|econnreset|etimedout/i.test(error.message);
}

/**
 * Fetch wrapper with per-attempt timeout, exponential backoff + jitter,
 * Retry-After handling, and retry on both transient HTTP statuses and network errors.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: FetchRetryOptions = {}
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const baseDelayMs = options.baseDelayMs ?? 1500;
  const maxDelayMs = options.maxDelayMs ?? 15_000;
  const retryStatuses = options.retryOnStatuses ?? DEFAULT_RETRYABLE_STATUSES;
  const label = options.label ?? "http";
  const fetchFn = options.fetchImpl ?? fetch;
  const sleepFn = options.sleepImpl ?? defaultSleep;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = init.signal
      ? AbortSignal.any([init.signal, timeoutSignal])
      : timeoutSignal;

    try {
      const response = await fetchFn(url, { ...init, signal });
      if (response.ok || !retryStatuses.includes(response.status) || attempt === maxAttempts) {
        return response;
      }

      const delay = computeBackoffMs(attempt, baseDelayMs, maxDelayMs, response.headers.get("retry-after"));
      // Drain body so the underlying connection can be reused cleanly.
      await response.arrayBuffer().catch(() => {});
      console.warn(`[${label}] attempt ${attempt}/${maxAttempts} returned HTTP ${response.status}; retrying in ${delay}ms`);
      await sleepFn(delay);
    } catch (error) {
      lastError = error;
      // Do not retry if the caller's own signal aborted.
      if (init.signal?.aborted) {
        throw error;
      }
      if (!isTransientFetchError(error) || attempt === maxAttempts) {
        throw error;
      }
      const delay = computeBackoffMs(attempt, baseDelayMs, maxDelayMs, null);
      console.warn(
        `[${label}] attempt ${attempt}/${maxAttempts} failed (${error instanceof Error ? error.message : String(error)}); retrying in ${delay}ms`
      );
      await sleepFn(delay);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`[${label}] request failed after ${maxAttempts} attempts`);
}

/**
 * Run async work over `items` with a fixed concurrency cap while preserving order.
 */
export async function runWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const runners = Array.from({ length: limit }, async () => {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) return;
      results[current] = await worker(items[current], current);
    }
  });

  await Promise.all(runners);
  return results;
}

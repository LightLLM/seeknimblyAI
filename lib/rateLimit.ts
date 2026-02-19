/**
 * Simple in-memory rate limiter per key (e.g. IP + route).
 * For MVP only; replace with Redis or similar for production scale.
 */

const store = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS = 20;

/**
 * Returns true if the request is allowed, false if rate limited.
 * Call check() first; if true, then call record() to count the request.
 */
export function check(key: string): boolean {
  const entry = store.get(key);
  if (!entry) return true;
  if (Date.now() > entry.resetAt) {
    store.delete(key);
    return true;
  }
  return entry.count < MAX_REQUESTS;
}

/**
 * Records one request for the given key. Call after check() returns true.
 */
export function record(key: string): void {
  const entry = store.get(key);
  const now = Date.now();
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
}

/**
 * Build rate limit key from IP and route path.
 */
export function rateLimitKey(ip: string, route: string): string {
  return `hr:${route}:${ip}`;
}

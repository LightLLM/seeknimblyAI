/**
 * Rate limiter: in-memory by default; durable via Supabase `rate_limits` when
 * configured so limits survive across Vercel serverless instances.
 */

import { isSupabaseConfigured } from "@/lib/store";

const memory = new Map<string, { count: number; resetAt: number }>();

export const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
export const MAX_REQUESTS = 20;

/**
 * Returns true if the request is allowed, false if rate limited.
 * Call check() first; if true, then call record() to count the request.
 * Prefer allowRequest() in async route handlers.
 */
export function check(key: string): boolean {
  const entry = memory.get(key);
  if (!entry) return true;
  if (Date.now() > entry.resetAt) {
    memory.delete(key);
    return true;
  }
  return entry.count < MAX_REQUESTS;
}

/**
 * Records one request for the given key. Call after check() returns true.
 */
export function record(key: string): void {
  const entry = memory.get(key);
  const now = Date.now();
  if (!entry || now > entry.resetAt) {
    memory.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export function rateLimitKey(ip: string, route: string): string {
  return `hr:${route}:${ip}`;
}

/** Clear in-memory buckets (tests). */
export function clearRateLimitMemory(): void {
  memory.clear();
}

/**
 * Atomic-ish allow: check + record. Uses Supabase when configured so the
 * limit is shared across instances; falls back to in-memory otherwise.
 */
export async function allowRequest(key: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    if (!check(key)) return false;
    record(key);
    return true;
  }
  try {
    const { getSupabaseAdmin } = await import("@/lib/supabase");
    const sb = getSupabaseAdmin();
    const now = Date.now();
    const { data: row } = await sb.from("rate_limits").select("*").eq("key", key).maybeSingle();
    const resetAt = row?.reset_at ? new Date(String(row.reset_at)).getTime() : 0;
    if (!row || now > resetAt) {
      const { error } = await sb.from("rate_limits").upsert({
        key,
        count: 1,
        reset_at: new Date(now + WINDOW_MS).toISOString(),
      });
      if (error) {
        // Fallback to memory if table missing / misconfigured
        if (!check(key)) return false;
        record(key);
        return true;
      }
      return true;
    }
    const count = Number(row.count ?? 0);
    if (count >= MAX_REQUESTS) return false;
    const { error } = await sb
      .from("rate_limits")
      .update({ count: count + 1 })
      .eq("key", key);
    if (error) {
      if (!check(key)) return false;
      record(key);
      return true;
    }
    return true;
  } catch {
    if (!check(key)) return false;
    record(key);
    return true;
  }
}

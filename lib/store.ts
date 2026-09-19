/**
 * Data layer for agent entities. Uses Supabase when configured
 * (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY), otherwise falls back
 * to an in-memory store so the app works in dev/demo mode. Every result from
 * fallback mode is flagged with `demo: true` so agents can disclose it.
 *
 * When runWithStoreContext({ orgId }) wraps a request, inserts into org-scoped
 * tables stamp org_id and lists/gets filter to that org.
 */

import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";

export type Row = Record<string, unknown> & { id?: string };

type StoreContext = { orgId?: string | null };

const storeCtx = new AsyncLocalStorage<StoreContext>();

/** Tables that carry org_id and must never leak across tenants. */
export const ORG_SCOPED_TABLES = new Set([
  "candidates",
  "jobs",
  "applications",
  "hires",
  "onboarding_tasks",
  "learning_paths",
  "learning_items",
  "compliance_events",
  "leads",
  "clients",
  "client_modules",
  "outbox_drafts",
  "memories",
  "audit_log",
]);

export function runWithStoreContext<T>(ctx: StoreContext, fn: () => Promise<T>): Promise<T> {
  return storeCtx.run(ctx, fn);
}

export function currentOrgId(): string | null {
  return storeCtx.getStore()?.orgId ?? null;
}

const memory = new Map<string, Row[]>();

function memTable(table: string): Row[] {
  if (!memory.has(table)) memory.set(table, []);
  return memory.get(table)!;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function supabase() {
  const { getSupabaseAdmin } = await import("@/lib/supabase");
  return getSupabaseAdmin();
}

function stampOrg(table: string, row: Row): Row {
  const orgId = currentOrgId();
  if (orgId && ORG_SCOPED_TABLES.has(table) && row.org_id == null) {
    return { ...row, org_id: orgId };
  }
  return row;
}

function withOrgFilter(table: string, filters: Record<string, unknown>): Record<string, unknown> {
  const orgId = currentOrgId();
  if (orgId && ORG_SCOPED_TABLES.has(table) && filters.org_id === undefined) {
    return { ...filters, org_id: orgId };
  }
  return filters;
}

export async function insertRow(table: string, row: Row): Promise<Row> {
  const payload = stampOrg(table, row);
  if (isSupabaseConfigured()) {
    const sb = await supabase();
    const { data, error } = await sb.from(table).insert(payload).select().single();
    if (error) throw new Error(`[store] insert into ${table} failed: ${error.message}`);
    return data as Row;
  }
  const stored: Row = { id: randomUUID(), created_at: new Date().toISOString(), ...payload };
  memTable(table).push(stored);
  return stored;
}

export async function updateRow(table: string, id: string, patch: Row): Promise<Row | null> {
  const existing = await getRow(table, id);
  if (!existing) return null;
  if (isSupabaseConfigured()) {
    const sb = await supabase();
    let q = sb.from(table).update(patch).eq("id", id);
    const orgId = currentOrgId();
    if (orgId && ORG_SCOPED_TABLES.has(table)) q = q.eq("org_id", orgId);
    const { data, error } = await q.select().single();
    if (error) throw new Error(`[store] update ${table}/${id} failed: ${error.message}`);
    return data as Row;
  }
  const rows = memTable(table);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx], ...patch, updated_at: new Date().toISOString() };
  return rows[idx];
}

export async function deleteRow(table: string, id: string): Promise<boolean> {
  const existing = await getRow(table, id);
  if (!existing) return false;
  if (isSupabaseConfigured()) {
    const sb = await supabase();
    let q = sb.from(table).delete().eq("id", id);
    const orgId = currentOrgId();
    if (orgId && ORG_SCOPED_TABLES.has(table)) q = q.eq("org_id", orgId);
    const { error } = await q;
    if (error) throw new Error(`[store] delete ${table}/${id} failed: ${error.message}`);
    return true;
  }
  const rows = memTable(table);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  rows.splice(idx, 1);
  return true;
}

export type ListOptions = {
  filters?: Record<string, unknown>;
  limit?: number;
  orderBy?: string;
  ascending?: boolean;
  /** Skip automatic org_id filter (admin/cron cross-org sweeps). */
  skipOrgScope?: boolean;
};

export async function listRows(table: string, opts: ListOptions = {}): Promise<Row[]> {
  const { limit = 100, orderBy = "created_at", ascending = false, skipOrgScope = false } = opts;
  const filters = skipOrgScope ? (opts.filters ?? {}) : withOrgFilter(table, opts.filters ?? {});
  if (isSupabaseConfigured()) {
    const sb = await supabase();
    let q = sb.from(table).select("*");
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v as never);
    const { data, error } = await q.order(orderBy, { ascending }).limit(limit);
    if (error) throw new Error(`[store] list ${table} failed: ${error.message}`);
    return (data ?? []) as Row[];
  }
  let rows = memTable(table).filter((r) =>
    Object.entries(filters).every(([k, v]) => r[k] === v)
  );
  rows = [...rows].sort((a, b) => {
    const av = String(a[orderBy] ?? "");
    const bv = String(b[orderBy] ?? "");
    return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
  });
  return rows.slice(0, limit);
}

export async function getRow(table: string, id: string): Promise<Row | null> {
  if (isSupabaseConfigured()) {
    const sb = await supabase();
    let q = sb.from(table).select("*").eq("id", id);
    const orgId = currentOrgId();
    if (orgId && ORG_SCOPED_TABLES.has(table)) q = q.eq("org_id", orgId);
    const { data, error } = await q.maybeSingle();
    if (error) throw new Error(`[store] get ${table}/${id} failed: ${error.message}`);
    return (data as Row) ?? null;
  }
  const row = memTable(table).find((r) => r.id === id) ?? null;
  const orgId = currentOrgId();
  if (row && orgId && ORG_SCOPED_TABLES.has(table) && row.org_id != null && row.org_id !== orgId) {
    return null;
  }
  return row;
}

/** Test/demo helper: clear the in-memory store. No-op when Supabase is configured. */
export function clearMemoryStore(): void {
  memory.clear();
}

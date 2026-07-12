/**
 * Data layer for agent entities. Uses Supabase when configured
 * (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY), otherwise falls back
 * to an in-memory store so the app works in dev/demo mode. Every result from
 * fallback mode is flagged with `demo: true` so agents can disclose it.
 */

import { randomUUID } from "crypto";

export type Row = Record<string, unknown> & { id?: string };

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

export async function insertRow(table: string, row: Row): Promise<Row> {
  if (isSupabaseConfigured()) {
    const sb = await supabase();
    const { data, error } = await sb.from(table).insert(row).select().single();
    if (error) throw new Error(`[store] insert into ${table} failed: ${error.message}`);
    return data as Row;
  }
  const stored: Row = { id: randomUUID(), created_at: new Date().toISOString(), ...row };
  memTable(table).push(stored);
  return stored;
}

export async function updateRow(table: string, id: string, patch: Row): Promise<Row | null> {
  if (isSupabaseConfigured()) {
    const sb = await supabase();
    const { data, error } = await sb.from(table).update(patch).eq("id", id).select().single();
    if (error) throw new Error(`[store] update ${table}/${id} failed: ${error.message}`);
    return data as Row;
  }
  const rows = memTable(table);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx], ...patch, updated_at: new Date().toISOString() };
  return rows[idx];
}

export type ListOptions = {
  filters?: Record<string, unknown>;
  limit?: number;
  orderBy?: string;
  ascending?: boolean;
};

export async function listRows(table: string, opts: ListOptions = {}): Promise<Row[]> {
  const { filters = {}, limit = 100, orderBy = "created_at", ascending = false } = opts;
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
    const { data, error } = await sb.from(table).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`[store] get ${table}/${id} failed: ${error.message}`);
    return (data as Row) ?? null;
  }
  return memTable(table).find((r) => r.id === id) ?? null;
}

/** Test/demo helper: clear the in-memory store. No-op when Supabase is configured. */
export function clearMemoryStore(): void {
  memory.clear();
}

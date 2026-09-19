/**
 * Data retention: purge stale rate-limit rows, trim old conversation
 * message payloads, and soft-purge aged memories. Audit log stays
 * append-only (SOC2) — we never mutate those rows.
 */

import { listRows, updateRow, isSupabaseConfigured } from "@/lib/store";
import { logAudit } from "@/lib/audit";

export type RetentionResult = {
  ok: boolean;
  rate_limits_cleared: number;
  conversations_trimmed: number;
  memories_purged: number;
  summary: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function olderThan(iso: unknown, days: number): boolean {
  if (!iso) return false;
  const t = new Date(String(iso)).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t > days * DAY_MS;
}

export async function runDataRetention(): Promise<RetentionResult> {
  let rate_limits_cleared = 0;
  let conversations_trimmed = 0;
  let memories_purged = 0;

  if (isSupabaseConfigured()) {
    try {
      const { getSupabaseAdmin } = await import("@/lib/supabase");
      const sb = getSupabaseAdmin();
      const { data, error } = await sb
        .from("rate_limits")
        .delete()
        .lt("reset_at", new Date().toISOString())
        .select("key");
      if (!error) rate_limits_cleared = data?.length ?? 0;
    } catch {
      // table may not exist yet
    }
  }

  const conversations = await listRows("conversations", {
    limit: 200,
    skipOrgScope: true,
    orderBy: "updated_at",
    ascending: true,
  });
  for (const c of conversations) {
    if (!olderThan(c.updated_at ?? c.created_at, 180)) continue;
    const msgs = Array.isArray(c.messages) ? c.messages : [];
    if (msgs.length === 0) continue;
    await updateRow("conversations", String(c.id), {
      messages: [],
      title: String(c.title ?? "Archived session"),
    });
    conversations_trimmed++;
  }

  const memories = await listRows("memories", {
    limit: 500,
    skipOrgScope: true,
    orderBy: "created_at",
    ascending: true,
  });
  for (const m of memories) {
    if (!olderThan(m.created_at, 365)) continue;
    if (String(m.content ?? "").startsWith("[purged")) continue;
    await updateRow("memories", String(m.id), {
      content: "[purged under data retention policy]",
      subject: m.subject ?? null,
    });
    memories_purged++;
  }

  const summary = `retention: ${rate_limits_cleared} rate keys, ${conversations_trimmed} chats trimmed, ${memories_purged} memories purged`;
  await logAudit({
    agent: "system",
    action: "data_retention_run",
    detail: summary,
  });

  return {
    ok: true,
    rate_limits_cleared,
    conversations_trimmed,
    memories_purged,
    summary,
  };
}

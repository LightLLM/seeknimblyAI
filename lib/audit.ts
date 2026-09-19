/**
 * Append-only audit log. Every tool execution, approval decision, and
 * client-facing action writes a row (hard rule #4 in AGENTS.md).
 * Audit failures never break the agent run, but are logged server-side.
 */

import { insertRow, listRows, type Row } from "@/lib/store";

export type AuditEntry = {
  agent: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  actor?: string; // 'agent' | user email
  status?: "ok" | "pending_approval" | "approved" | "rejected" | "error";
  detail?: string;
};

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    // PII hygiene: truncate detail aggressively; never log full resumes.
    const detail = entry.detail
      ? entry.detail
          .replace(/\b[\w.+-]+@[\w.-]+\.\w+\b/g, "[email]")
          .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[phone]")
          .slice(0, 800)
      : null;
    await insertRow("audit_log", {
      ts: new Date().toISOString(),
      agent: entry.agent,
      action: entry.action,
      entity_type: entry.entity_type ?? null,
      entity_id: entry.entity_id ?? null,
      actor: entry.actor ?? "agent",
      status: entry.status ?? "ok",
      detail,
    });
  } catch (e) {
    console.error("[audit] failed to write audit log:", e);
  }
}

export async function listAudit(limit = 200): Promise<Row[]> {
  return listRows("audit_log", { limit, orderBy: "ts", ascending: false });
}

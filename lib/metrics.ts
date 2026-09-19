/**
 * Headline product metrics — instrumented from existing tables.
 * Per REQUIREMENTS.md success metrics and IMPROVEMENTS #15.
 */

import { listRows, type Row } from "@/lib/store";

function hoursBetween(a?: string | null, b?: string | null): number | null {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms / (1000 * 60 * 60);
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export type MetricsSnapshot = {
  compliance_events_caught: number;
  open_compliance_events: number;
  applications_total: number;
  applications_screened: number;
  time_to_shortlist_hours_median: number | null;
  drafts_pending: number;
  drafts_approved_or_sent: number;
  approval_turnaround_hours_median: number | null;
  hires_total: number;
  retained_90d: number;
  retention_90d_rate: number | null;
  leads_total: number;
  leads_closed_won: number;
  clients_live: number;
};

export async function computeMetrics(): Promise<MetricsSnapshot> {
  const [
    events,
    applications,
    drafts,
    hires,
    leads,
    clients,
  ] = await Promise.all([
    listRows("compliance_events", { limit: 500 }),
    listRows("applications", { limit: 500 }),
    listRows("outbox_drafts", { limit: 500 }),
    listRows("hires", { limit: 500 }),
    listRows("leads", { limit: 500 }),
    listRows("clients", { limit: 200 }),
  ]);

  const screened = applications.filter((a) => {
    const s = String(a.status ?? "");
    return s === "screened" || s === "contacted" || s === "scheduled" || s === "offer" || s === "hired" || typeof a.score === "number";
  });

  const shortlistHours = screened
    .map((a) => hoursBetween(String(a.created_at ?? ""), String(a.updated_at ?? a.created_at ?? "")))
    .filter((n): n is number => n != null && n > 0);

  const decided = drafts.filter((d) => d.decided_at);
  const approvalHours = decided
    .map((d) => hoursBetween(String(d.created_at ?? ""), String(d.decided_at ?? "")))
    .filter((n): n is number => n != null);

  const retained = hires.filter((h) => String(h.status) === "retained_90d");
  const exitedOrRetained = hires.filter((h) => ["retained_90d", "exited"].includes(String(h.status)));

  return {
    compliance_events_caught: events.length,
    open_compliance_events: events.filter((e) => e.status === "open").length,
    applications_total: applications.length,
    applications_screened: screened.length,
    time_to_shortlist_hours_median: median(shortlistHours),
    drafts_pending: drafts.filter((d) => d.status === "pending").length,
    drafts_approved_or_sent: drafts.filter((d) => d.status === "approved" || d.status === "sent").length,
    approval_turnaround_hours_median: median(approvalHours),
    hires_total: hires.length,
    retained_90d: retained.length,
    retention_90d_rate:
      exitedOrRetained.length > 0 ? retained.length / exitedOrRetained.length : null,
    leads_total: leads.length,
    leads_closed_won: leads.filter((l) => l.stage === "closed_won").length,
    clients_live: clients.filter((c) => c.status === "live").length,
  };
}

export const ATS_STATUSES = ["new", "screened", "contacted", "scheduled", "offer", "hired", "rejected"] as const;
export const CRM_STAGES = [
  "new",
  "contacted",
  "replied",
  "call_booked",
  "proposal",
  "negotiating",
  "closed_won",
  "closed_lost",
  "dormant",
] as const;

export function countBy(rows: Row[], key: string, values: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) out[v] = 0;
  for (const r of rows) {
    const v = String(r[key] ?? "");
    if (v in out) out[v]++;
    else out[v] = (out[v] ?? 0) + 1;
  }
  return out;
}

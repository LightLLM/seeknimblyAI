"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type MetricsSnapshot = {
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

function fmtHours(n: number | null): string {
  if (n == null) return "—";
  if (n < 1) return `${Math.round(n * 60)}m`;
  if (n < 48) return `${n.toFixed(1)}h`;
  return `${(n / 24).toFixed(1)}d`;
}

function fmtRate(n: number | null): string {
  if (n == null) return "—";
  return `${Math.round(n * 100)}%`;
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/metrics")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? "Could not load metrics.");
        return r.json();
      })
      .then((d: { metrics: MetricsSnapshot }) => setMetrics(d.metrics))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const cards: { label: string; value: string; hint: string }[] = metrics
    ? [
        {
          label: "Compliance events caught",
          value: String(metrics.compliance_events_caught),
          hint: `${metrics.open_compliance_events} still open`,
        },
        {
          label: "Time to shortlist",
          value: fmtHours(metrics.time_to_shortlist_hours_median),
          hint: `${metrics.applications_screened} screened of ${metrics.applications_total}`,
        },
        {
          label: "Approval turnaround",
          value: fmtHours(metrics.approval_turnaround_hours_median),
          hint: `${metrics.drafts_pending} pending · ${metrics.drafts_approved_or_sent} approved/sent`,
        },
        {
          label: "90-day retention",
          value: fmtRate(metrics.retention_90d_rate),
          hint: `${metrics.retained_90d} retained · ${metrics.hires_total} hires`,
        },
        {
          label: "Closed-won leads",
          value: String(metrics.leads_closed_won),
          hint: `${metrics.leads_total} total leads`,
        },
        {
          label: "Live clients",
          value: String(metrics.clients_live),
          hint: "Client onboarding → live",
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] px-4 sm:px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/app" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)]">
          ← Chat
        </Link>
        <h1 className="text-[16px] sm:text-[17px] font-semibold flex-1 min-w-[120px]">Metrics</h1>
        <span className="text-[12px] text-[var(--text-tertiary)]">Org-scoped headline numbers</span>
      </header>
      <main className="max-w-4xl mx-auto px-4 sm:px-5 py-6">
        <p className="text-[14px] text-[var(--text-secondary)] mb-6 max-w-2xl">
          Compliance events caught, time-to-shortlist, approval turnaround, and 90-day retention — the numbers that
          prove the product works.
        </p>
        {error && <p className="text-[13px] text-amber-500 mb-4">{error}</p>}
        {loading ? (
          <p className="text-[var(--text-tertiary)] text-[14px]">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cards.map((c) => (
              <div key={c.label} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wider">{c.label}</p>
                <p className="mt-2 text-[28px] font-semibold tabular-nums tracking-tight">{c.value}</p>
                <p className="mt-1 text-[12.5px] text-[var(--text-secondary)]">{c.hint}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

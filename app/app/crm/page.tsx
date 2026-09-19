"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Lead = {
  id: string;
  company?: string;
  contact_name?: string | null;
  stage?: string;
  score?: number | null;
  province?: string | null;
  vertical?: string | null;
  won_lost_reason?: string | null;
};

const STAGES = ["new", "contacted", "replied", "call_booked", "proposal", "negotiating", "closed_won", "closed_lost", "dormant"];

export default function CrmPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [byStage, setByStage] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/crm")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? "Could not load CRM.");
        return r.json();
      })
      .then((d: { leads: Lead[]; by_stage: Record<string, number> }) => {
        setLeads(d.leads ?? []);
        setByStage(d.by_stage ?? {});
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const rows = filter === "all" ? leads : leads.filter((l) => l.stage === filter);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] px-4 sm:px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/app" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)]">← Chat</Link>
        <h1 className="text-[16px] sm:text-[17px] font-semibold flex-1 min-w-[120px]">CRM Pipeline</h1>
        <span className="text-[12px] text-[var(--text-tertiary)]">{leads.length} leads</span>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-5 py-6">
        <div className="flex flex-wrap gap-2 mb-5">
          {STAGES.map((s) => (
            <div key={s} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 min-w-[72px]">
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">{s.replace("_", " ")}</p>
              <p className="text-[18px] font-semibold tabular-nums">{byStage[s] ?? 0}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 flex-wrap mb-4">
          <button type="button" onClick={() => setFilter("all")} className={`h-8 px-3 rounded-lg text-[13px] ${filter === "all" ? "bg-[var(--surface-hover)]" : "text-[var(--text-secondary)]"}`}>All</button>
          {STAGES.map((s) => (
            <button key={s} type="button" onClick={() => setFilter(s)} className={`h-8 px-3 rounded-lg text-[13px] ${filter === s ? "bg-[var(--surface-hover)]" : "text-[var(--text-secondary)]"}`}>{s.replace("_", " ")}</button>
          ))}
        </div>
        {error && <p className="text-[13px] text-amber-500 mb-4">{error}</p>}
        {loading ? (
          <p className="text-[var(--text-tertiary)] text-[14px]">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-[var(--text-tertiary)] text-[14px]">No leads yet. Ask Lead Gen to add and score prospects.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((l) => (
              <li key={l.id} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium truncate">{l.company || "Company"}</p>
                  <p className="text-[12.5px] text-[var(--text-tertiary)]">
                    {[l.contact_name, l.province, l.vertical, typeof l.score === "number" ? `score ${l.score}` : null].filter(Boolean).join(" · ")}
                  </p>
                  {l.won_lost_reason && <p className="mt-1 text-[12.5px] text-[var(--text-secondary)]">{l.won_lost_reason}</p>}
                </div>
                <span className="shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)]">{String(l.stage).replace("_", " ")}</span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

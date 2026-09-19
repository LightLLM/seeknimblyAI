"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type AppRow = {
  id: string;
  candidate_name?: string | null;
  candidate_email?: string | null;
  job_title?: string | null;
  status?: string;
  score?: number | null;
  score_rationale?: string | null;
  updated_at?: string;
  created_at?: string;
};

type JobRow = { id: string; title: string; province?: string | null; status?: string };

const STATUSES = ["new", "screened", "contacted", "scheduled", "offer", "hired", "rejected"];

export default function PipelinePage() {
  const [applications, setApplications] = useState<AppRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [byStatus, setByStatus] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/pipeline")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? "Could not load pipeline.");
        return r.json();
      })
      .then((d: { applications: AppRow[]; jobs: JobRow[]; by_status: Record<string, number> }) => {
        setApplications(d.applications ?? []);
        setJobs(d.jobs ?? []);
        setByStatus(d.by_status ?? {});
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const rows = filter === "all" ? applications : applications.filter((a) => a.status === filter);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] px-4 sm:px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/app" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)]">← Chat</Link>
        <h1 className="text-[16px] sm:text-[17px] font-semibold flex-1 min-w-[120px]">ATS Pipeline</h1>
        <span className="text-[12px] text-[var(--text-tertiary)]">{applications.length} applications · {jobs.length} jobs</span>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-5 py-6">
        <div className="flex flex-wrap gap-2 mb-5">
          {STATUSES.map((s) => (
            <div key={s} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 min-w-[88px]">
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">{s}</p>
              <p className="text-[18px] font-semibold tabular-nums">{byStatus[s] ?? 0}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 flex-wrap mb-4">
          <button type="button" onClick={() => setFilter("all")} className={`h-8 px-3 rounded-lg text-[13px] ${filter === "all" ? "bg-[var(--surface-hover)]" : "text-[var(--text-secondary)]"}`}>All</button>
          {STATUSES.map((s) => (
            <button key={s} type="button" onClick={() => setFilter(s)} className={`h-8 px-3 rounded-lg text-[13px] capitalize ${filter === s ? "bg-[var(--surface-hover)]" : "text-[var(--text-secondary)]"}`}>{s}</button>
          ))}
        </div>
        {error && <p className="text-[13px] text-amber-500 mb-4">{error}</p>}
        {loading ? (
          <p className="text-[var(--text-tertiary)] text-[14px]">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-[var(--text-tertiary)] text-[14px]">No applications yet. Ask the Recruiting agent to screen resumes or update the ATS.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((a) => (
              <li key={a.id} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium truncate">{a.candidate_name || a.candidate_email || "Candidate"}</p>
                    <p className="text-[12.5px] text-[var(--text-tertiary)] truncate">{a.job_title || "Untitled role"}{typeof a.score === "number" ? ` · score ${a.score}` : ""}</p>
                    {a.score_rationale && <p className="mt-1 text-[12.5px] text-[var(--text-secondary)] line-clamp-2">{a.score_rationale}</p>}
                  </div>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)]">{a.status}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {jobs.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">Open jobs</h2>
            <ul className="space-y-1.5">
              {jobs.map((j) => (
                <li key={j.id} className="text-[13px] text-[var(--text-secondary)] flex gap-2">
                  <span className="text-[var(--text)]">{j.title}</span>
                  <span className="text-[var(--text-tertiary)]">{[j.province, j.status].filter(Boolean).join(" · ")}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

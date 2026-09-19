"use client";

import { useState } from "react";
import Link from "next/link";

type Gap = { id: string; severity: string; title: string; detail: string; fix: string };
type Snapshot = {
  score: number;
  pass: number;
  gap: number;
  unknown: number;
  gaps: Gap[];
  headline: string;
  disclaimer: string;
};

const PROVINCES = ["ON", "BC", "AB", "QC"] as const;

export default function DemoPage() {
  const [province, setProvince] = useState<(typeof PROVINCES)[number]>("ON");
  const [count, setCount] = useState(25);
  const [industry, setIndustry] = useState("restaurant");
  const [hasHandbook, setHasHandbook] = useState(false);
  const [usesContractors, setUsesContractors] = useState(true);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/demo/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          province,
          employee_count: count,
          industry,
          has_handbook: hasHandbook,
          uses_contractors: usesContractors,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSnapshot(data.snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] px-4 sm:px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)]">
          ← Seeknimbly
        </Link>
        <h1 className="text-[16px] sm:text-[17px] font-semibold flex-1 min-w-[120px]">Day-1 Compliance Snapshot</h1>
        <Link href="/login" className="text-[13px] text-[var(--accent)] hover:underline">
          Start free trial
        </Link>
      </header>
      <main className="max-w-2xl mx-auto px-4 sm:px-5 py-8">
        <p className="text-[15px] text-[var(--text-secondary)] mb-6">
          No signup. Enter your province and headcount — get a scored snapshot with at least one real gap your team should close first.
        </p>
        <form onSubmit={run} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4 mb-8">
          <label className="block">
            <span className="text-[12px] uppercase tracking-wider text-[var(--text-tertiary)]">Province</span>
            <select
              value={province}
              onChange={(e) => setProvince(e.target.value as (typeof PROVINCES)[number])}
              className="mt-1 w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[14px]"
            >
              {PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] uppercase tracking-wider text-[var(--text-tertiary)]">Employees</span>
            <input
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={(e) => setCount(Number(e.target.value) || 1)}
              className="mt-1 w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[14px]"
            />
          </label>
          <label className="block">
            <span className="text-[12px] uppercase tracking-wider text-[var(--text-tertiary)]">Industry</span>
            <input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="restaurant, retail, clinic…"
              className="mt-1 w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[14px]"
            />
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={hasHandbook} onChange={(e) => setHasHandbook(e.target.checked)} />
            We have a current employee handbook
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={usesContractors} onChange={(e) => setUsesContractors(e.target.checked)} />
            We use independent contractors
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg bg-[var(--accent)] text-white text-[14px] font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {loading ? "Running snapshot…" : "Get Day-1 Snapshot"}
          </button>
          {error && <p className="text-[13px] text-amber-500">{error}</p>}
        </form>

        {snapshot && (
          <section className="space-y-4">
            <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5">
              <p className="text-[28px] font-semibold tabular-nums">{snapshot.score}</p>
              <p className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wider">Checklist score</p>
              <p className="mt-2 text-[14px] text-[var(--text-secondary)]">{snapshot.headline}</p>
              <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">
                {snapshot.pass} pass · {snapshot.gap} gap · {snapshot.unknown} unknown
              </p>
            </div>
            <ul className="space-y-3">
              {snapshot.gaps.map((g) => (
                <li key={g.id} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        g.severity === "high" ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-500"
                      }`}
                    >
                      {g.severity}
                    </span>
                    <p className="text-[14px] font-medium">{g.title}</p>
                  </div>
                  <p className="text-[13px] text-[var(--text-secondary)]">{g.detail}</p>
                  <p className="mt-2 text-[13px] text-[var(--text)]">
                    <span className="text-[var(--text-tertiary)]">Fix: </span>
                    {g.fix}
                  </p>
                </li>
              ))}
            </ul>
            <p className="text-[12px] text-[var(--text-tertiary)]">{snapshot.disclaimer}</p>
            <Link
              href="/login"
              className="inline-flex h-10 px-4 items-center rounded-lg bg-[var(--accent)] text-white text-[13px] font-medium hover:bg-[var(--accent-hover)]"
            >
              Close these gaps with Seeknimbly →
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}

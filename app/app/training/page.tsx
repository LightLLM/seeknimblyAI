"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Item = { id: string; title?: string; status?: string; due_date?: string | null };
type Path = {
  id: string;
  person_name?: string | null;
  role?: string | null;
  goal?: string | null;
  items: Item[];
};

export default function TrainingPage() {
  const [paths, setPaths] = useState<Path[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/training")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? "Failed");
        return r.json();
      })
      .then((d) => setPaths(d.paths ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] px-4 sm:px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/app" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)]">
          ← Chat
        </Link>
        <h1 className="text-[16px] sm:text-[17px] font-semibold flex-1 min-w-[120px]">Training & L&D</h1>
        <span className="text-[12px] text-[var(--text-tertiary)]">{paths.length} paths</span>
      </header>
      <main className="max-w-4xl mx-auto px-4 sm:px-5 py-6">
        <p className="text-[13px] text-[var(--text-tertiary)] mb-4">
          Role-based learning paths and certification tracking from the Training agent.
        </p>
        {error && <p className="text-[13px] text-amber-500 mb-4">{error}</p>}
        {loading ? (
          <p className="text-[var(--text-tertiary)] text-[14px]">Loading…</p>
        ) : paths.length === 0 ? (
          <p className="text-[14px] text-[var(--text-tertiary)]">
            No learning paths yet. Ask Training & Development to build one for a hire.
          </p>
        ) : (
          <ul className="space-y-3">
            {paths.map((p) => (
              <li key={p.id} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-[14px] font-medium">{p.person_name || "Learner"}</p>
                <p className="text-[12.5px] text-[var(--text-tertiary)]">
                  {[p.role, p.goal].filter(Boolean).join(" · ")}
                </p>
                <ul className="mt-2 space-y-1">
                  {p.items.map((i) => (
                    <li key={i.id} className="text-[13px] flex gap-2">
                      <span className={i.status === "done" || i.status === "completed" ? "text-[var(--text-tertiary)] line-through" : ""}>
                        {i.title || "Item"}
                      </span>
                      <span className="text-[11px] text-[var(--text-tertiary)] ml-auto">{i.status}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

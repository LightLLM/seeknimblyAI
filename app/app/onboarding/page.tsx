"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Task = {
  id: string;
  title: string;
  category?: string;
  due_date?: string | null;
  status?: string;
};

type Hire = {
  id: string;
  name: string;
  role?: string | null;
  province?: string | null;
  start_date?: string | null;
  status?: string;
  tasks: Task[];
};

export default function OnboardingDashPage() {
  const [hires, setHires] = useState<Hire[]>([]);
  const [overdue, setOverdue] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding");
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Failed to load.");
      const d = await res.json();
      setHires(d.hires ?? []);
      setOverdue(d.overdue ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleTask(task: Task) {
    const next = task.status === "done" ? "pending" : "done";
    await fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: task.id, status: next }),
    });
    await load();
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] px-4 sm:px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/app" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)]">
          ← Chat
        </Link>
        <h1 className="text-[16px] sm:text-[17px] font-semibold flex-1 min-w-[120px]">Onboarding</h1>
        <Link href="/app/checklist" className="text-[13px] text-[var(--accent)] hover:underline">
          Personal checklist
        </Link>
        <span className="text-[12px] text-[var(--text-tertiary)]">{hires.length} hires</span>
      </header>
      <main className="max-w-4xl mx-auto px-4 sm:px-5 py-6 space-y-5">
        {overdue.length > 0 && (
          <div className="rounded-[var(--radius)] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px]">
            {overdue.length} overdue task{overdue.length === 1 ? "" : "s"} across hires
          </div>
        )}
        {error && <p className="text-[13px] text-amber-500">{error}</p>}
        {loading ? (
          <p className="text-[var(--text-tertiary)] text-[14px]">Loading…</p>
        ) : hires.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] p-8 text-center">
            <p className="text-[14px] text-[var(--text-secondary)]">No hires yet.</p>
            <p className="mt-1 text-[13px] text-[var(--text-tertiary)]">
              Use Intake → New hire, or ask the Onboarding agent to create_hire.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {hires.map((h) => {
              const done = h.tasks.filter((t) => t.status === "done").length;
              const open = openId === h.id;
              return (
                <li key={h.id} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
                  <button
                    type="button"
                    className="w-full text-left px-4 py-3 flex items-center gap-3"
                    onClick={() => setOpenId(open ? null : h.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium truncate">{h.name}</p>
                      <p className="text-[12px] text-[var(--text-tertiary)]">
                        {[h.role, h.province, h.start_date, h.status].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span className="text-[12px] text-[var(--text-tertiary)] tabular-nums">
                      {done}/{h.tasks.length}
                    </span>
                  </button>
                  {open && (
                    <ul className="border-t border-[var(--border)] px-4 py-2 space-y-1">
                      {h.tasks.length === 0 ? (
                        <li className="text-[13px] text-[var(--text-tertiary)] py-2">No tasks seeded.</li>
                      ) : (
                        h.tasks.map((t) => (
                          <li key={t.id} className="flex items-center gap-2 py-1.5 text-[13px]">
                            <input
                              type="checkbox"
                              checked={t.status === "done"}
                              onChange={() => toggleTask(t)}
                            />
                            <span className={t.status === "done" ? "line-through text-[var(--text-tertiary)]" : ""}>
                              {t.title}
                            </span>
                            <span className="ml-auto text-[11px] text-[var(--text-tertiary)]">
                              {[t.category, t.due_date].filter(Boolean).join(" · ")}
                            </span>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

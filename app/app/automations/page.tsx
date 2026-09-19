"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { agentLabel } from "@/lib/agents/meta";

type Automation = {
  id: string;
  label: string;
  description: string;
  cron: string;
  cadence: string;
  agent: string;
  enabled: boolean;
  last_run: { status: string; summary: string; created_at?: string } | null;
};

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/automations");
      if (!res.ok) {
        setError((await res.json().catch(() => ({})))?.error ?? "Could not load automations. Are you signed in?");
        return;
      }
      const data = (await res.json()) as { automations: Automation[] };
      setAutomations(data.automations ?? []);
      setError(null);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (id: string, enabled: boolean) => {
    setBusy(id);
    try {
      await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const runNow = async (id: string) => {
    setBusy(id);
    setRunResult((p) => ({ ...p, [id]: "Running…" }));
    try {
      const res = await fetch("/api/automations/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await res.json()) as { status?: string; summary?: string; error?: string };
      setRunResult((p) => ({ ...p, [id]: data.error ?? `${data.status}: ${data.summary ?? ""}`.slice(0, 400) }));
      await load();
    } catch {
      setRunResult((p) => ({ ...p, [id]: "Network error." }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] px-4 sm:px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/app" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)]">← Chat</Link>
        <h1 className="text-[16px] sm:text-[17px] font-semibold flex-1 min-w-[120px]">Automations</h1>
        <span className="text-[12px] text-[var(--text-tertiary)]">Cron-driven agent work</span>
      </header>
      <main className="max-w-4xl mx-auto px-4 sm:px-5 py-6">
        <p className="text-[13px] text-[var(--text-tertiary)] mb-4">
          Recurring agent runs. Outputs follow the same rails as chat: drafts land in the{" "}
          <Link href="/app/approvals" className="text-[var(--accent)] hover:underline">outbox</Link>, every action is{" "}
          <Link href="/app/audit" className="text-[var(--accent)] hover:underline">audited</Link>. Scheduled execution needs
          CRON_SECRET + the crons in vercel.json; &quot;Run now&quot; works anytime.
        </p>
        {error && <p className="text-[13px] text-amber-500 mb-4">{error}</p>}
        {loading ? (
          <p className="text-[var(--text-tertiary)] text-[14px]">Loading…</p>
        ) : (
          <ul className="space-y-3">
            {automations.map((a) => (
              <li key={a.id} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[15px] font-medium">{a.label}</p>
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--surface-hover)] text-[var(--text-secondary)]">{agentLabel(a.agent)}</span>
                      <span className="text-[11px] text-[var(--text-tertiary)]">{a.cadence} · cron {a.cron}</span>
                    </div>
                    <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{a.description}</p>
                    {a.last_run && (
                      <p className="mt-1.5 text-[12px] text-[var(--text-tertiary)]">
                        Last run: <span className={a.last_run.status === "error" ? "text-red-400" : a.last_run.status === "needs_approval" ? "text-amber-500" : "text-emerald-500"}>{a.last_run.status}</span>
                        {" — "}<span className="line-clamp-1 inline">{a.last_run.summary}</span>
                      </p>
                    )}
                    {runResult[a.id] && <p className="mt-1.5 text-[12px] text-[var(--text-secondary)] whitespace-pre-wrap">{runResult[a.id]}</p>}
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={a.enabled}
                      disabled={busy === a.id}
                      onClick={() => toggle(a.id, !a.enabled)}
                      className={`relative w-9 h-5 rounded-full transition-colors disabled:opacity-50 ${a.enabled ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]"}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${a.enabled ? "left-[18px]" : "left-0.5"}`} />
                    </button>
                    <button
                      type="button"
                      disabled={busy === a.id}
                      onClick={() => runNow(a.id)}
                      className="h-7 px-2.5 rounded-md border border-[var(--border)] text-[12px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
                    >
                      {busy === a.id ? "Running…" : "Run now"}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

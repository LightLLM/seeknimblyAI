"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { agentLabel } from "@/lib/agents/meta";

type Draft = {
  id: string;
  agent: string;
  channel: string;
  recipient: string | null;
  subject: string | null;
  body: string;
  status: string;
  decided_by?: string | null;
  created_at?: string;
};

export default function ApprovalsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [status, setStatus] = useState<string>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (s: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/approvals?status=${s}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Could not load drafts. Are you signed in?");
        setDrafts([]);
      } else {
        const data = (await res.json()) as { drafts: Draft[] };
        setDrafts(data.drafts ?? []);
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(status);
  }, [status, load]);

  const decide = async (id: string, decision: "approve" | "reject") => {
    setBusy(id);
    try {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Decision failed.");
      } else {
        await load(status);
      }
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] px-5 py-3 flex items-center gap-4">
        <Link href="/app" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)]">← Chat</Link>
        <h1 className="text-[17px] font-semibold flex-1">Approvals outbox</h1>
        <Link href="/app/audit" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)]">Audit trail</Link>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-8 pl-3 pr-8 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[13px]"
          aria-label="Filter drafts by status"
        >
          {["pending", "approved", "rejected", "all"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </header>
      <main className="max-w-4xl mx-auto px-5 py-6">
        <p className="text-[13px] text-[var(--text-tertiary)] mb-4">
          Agents draft; you send. Nothing leaves the building until it is approved here — and approved drafts still need you (or an integration) to actually transmit them.
        </p>
        {error && <p className="text-[13px] text-amber-400/90 mb-4">{error}</p>}
        {loading ? (
          <p className="text-[var(--text-tertiary)] text-[14px]">Loading…</p>
        ) : drafts.length === 0 ? (
          <p className="text-[var(--text-tertiary)] text-[14px]">No {status === "all" ? "" : status + " "}drafts.</p>
        ) : (
          <ul className="space-y-3">
            {drafts.map((d) => (
              <li key={d.id} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--surface-hover)] text-[var(--text-secondary)]">{agentLabel(d.agent)}</span>
                  <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--surface-hover)] text-[var(--text-secondary)]">{d.channel}</span>
                  <span className={`text-[11px] uppercase tracking-wider px-2 py-0.5 rounded ${d.status === "pending" ? "bg-amber-500/15 text-amber-400" : d.status === "approved" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>{d.status}</span>
                  {d.recipient && <span className="text-[12px] text-[var(--text-tertiary)]">→ {d.recipient}</span>}
                </div>
                <p className="mt-2 text-[15px] font-medium">{d.subject ?? "(no subject)"}</p>
                <pre className={`mt-2 text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap font-sans ${expanded === d.id ? "" : "line-clamp-3"}`}>{d.body}</pre>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                    className="h-8 px-3 rounded-lg text-[13px] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--surface-hover)]"
                  >
                    {expanded === d.id ? "Collapse" : "View full"}
                  </button>
                  {d.status === "pending" && (
                    <>
                      <button
                        type="button"
                        disabled={busy === d.id}
                        onClick={() => decide(d.id, "approve")}
                        className="h-8 px-3 rounded-lg bg-[var(--accent)] text-white text-[13px] font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busy === d.id}
                        onClick={() => decide(d.id, "reject")}
                        className="h-8 px-3 rounded-lg border border-[var(--border)] text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {d.decided_by && <span className="text-[12px] text-[var(--text-tertiary)]">by {d.decided_by}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

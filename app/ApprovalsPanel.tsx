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
};

/**
 * Right-hand panel: pending outbox drafts with inline approve/reject.
 * refreshKey bumps whenever an agent turn finishes so new drafts appear.
 */
export function ApprovalsPanel({ refreshKey }: { refreshKey: number }) {
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/approvals?status=pending");
      if (!res.ok) {
        setDrafts(null);
        return;
      }
      const data = (await res.json()) as { drafts: Draft[] };
      setDrafts(data.drafts ?? []);
    } catch {
      setDrafts(null);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load, refreshKey]);

  const decide = async (id: string, decision: "approve" | "reject") => {
    setBusy(id);
    try {
      await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="h-12 px-4 flex items-center justify-between shrink-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
          Pending approvals
        </p>
        <Link href="/app/approvals" className="text-[11px] text-[var(--accent)] hover:underline">
          View all
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-4 min-h-0">
        {drafts === null ? (
          <p className="px-1 pt-24 text-center text-[11px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            Sign in to view approvals
          </p>
        ) : drafts.length === 0 ? (
          <p className="px-1 pt-24 text-center text-[11px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            No pending approvals
          </p>
        ) : (
          <ul className="space-y-2.5">
            {drafts.map((d) => (
              <li key={d.id} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-sm)]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--surface-hover)] text-[var(--text-secondary)]">
                    {agentLabel(d.agent)}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--surface-hover)] text-[var(--text-secondary)]">
                    {d.channel}
                  </span>
                </div>
                <p className="mt-1.5 text-[13px] font-medium leading-snug">{d.subject ?? "(no subject)"}</p>
                {d.recipient && <p className="text-[11px] text-[var(--text-tertiary)]">→ {d.recipient}</p>}
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                  className="mt-1 text-[11px] text-[var(--accent)] hover:underline"
                >
                  {expanded === d.id ? "Hide draft" : "Read draft"}
                </button>
                {expanded === d.id && (
                  <pre className="mt-1.5 text-[11px] text-[var(--text-secondary)] whitespace-pre-wrap font-sans max-h-48 overflow-y-auto">{d.body}</pre>
                )}
                <div className="mt-2 flex gap-1.5">
                  <button
                    type="button"
                    disabled={busy === d.id}
                    onClick={() => decide(d.id, "approve")}
                    className="h-7 px-2.5 rounded-md bg-[var(--accent)] text-white text-[11px] font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy === d.id}
                    onClick={() => decide(d.id, "reject")}
                    className="h-7 px-2.5 rounded-md border border-[var(--border)] text-[11px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

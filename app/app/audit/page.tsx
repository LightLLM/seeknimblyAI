"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { agentLabel } from "@/lib/agents/meta";

type Entry = {
  id: string;
  ts: string;
  agent: string;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  actor: string;
  status: string;
  detail?: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  ok: "text-[var(--text-secondary)]",
  pending_approval: "text-amber-400",
  approved: "text-emerald-400",
  rejected: "text-red-400",
  error: "text-red-400",
};

export default function AuditPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/audit")
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error ?? "Could not load the audit trail. Are you signed in?");
        }
        return res.json();
      })
      .then((data: { entries: Entry[] }) => setEntries(data.entries ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] px-5 py-3 flex items-center gap-4">
        <Link href="/app" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)]">← Chat</Link>
        <h1 className="text-[17px] font-semibold flex-1">Audit trail</h1>
        <Link href="/app/approvals" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)]">Approvals</Link>
      </header>
      <main className="max-w-5xl mx-auto px-5 py-6">
        <p className="text-[13px] text-[var(--text-tertiary)] mb-4">
          Append-only record of every agent action and approval decision. This log is both product and legal protection.
        </p>
        {error && <p className="text-[13px] text-amber-400/90 mb-4">{error}</p>}
        {loading ? (
          <p className="text-[var(--text-tertiary)] text-[14px]">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-[var(--text-tertiary)] text-[14px]">No audit entries yet. Run an agent and come back.</p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)]">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[var(--surface)] text-left text-[var(--text-secondary)]">
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Agent</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Actor</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2 whitespace-nowrap text-[var(--text-tertiary)]">{new Date(e.ts).toLocaleString()}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{agentLabel(e.agent)}</td>
                    <td className="px-3 py-2">{e.action}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-[var(--text-tertiary)]">{e.actor}</td>
                    <td className={`px-3 py-2 whitespace-nowrap ${STATUS_COLOR[e.status] ?? ""}`}>{e.status}</td>
                    <td className="px-3 py-2 text-[var(--text-tertiary)] max-w-[320px] truncate" title={e.detail ?? ""}>{e.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

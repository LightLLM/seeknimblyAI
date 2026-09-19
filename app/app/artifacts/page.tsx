"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
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
  created_at?: string;
};

const TABS = ["all", "email", "posting", "proposal", "document", "linkedin"] as const;

export default function ArtifactsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/approvals?status=all")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? "Could not load artifacts. Are you signed in?");
        return r.json();
      })
      .then((d: { drafts: Draft[] }) => setDrafts(d.drafts ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: drafts.length };
    for (const t of TABS.slice(1)) c[t] = drafts.filter((d) => d.channel === t).length;
    return c;
  }, [drafts]);

  const filtered = useMemo(() => {
    let rows = tab === "all" ? drafts : drafts.filter((d) => d.channel === tab);
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter(
        (d) =>
          (d.subject ?? "").toLowerCase().includes(q) ||
          (d.recipient ?? "").toLowerCase().includes(q) ||
          d.body.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [drafts, tab, query]);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] px-4 sm:px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/app" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)]">← Chat</Link>
        <h1 className="text-[16px] sm:text-[17px] font-semibold flex-1 min-w-[120px]">Artifacts</h1>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={'Try "offer letter"'}
          className="h-8 px-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[13px] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] w-full sm:w-56"
          aria-label="Search artifacts"
        />
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-5 py-6">
        <div className="flex items-center gap-1 flex-wrap mb-4">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`h-8 px-3 rounded-lg text-[13px] font-medium capitalize transition-colors ${tab === t ? "bg-[var(--surface-hover)] text-[var(--text)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"}`}
            >
              {t} <span className="text-[var(--text-tertiary)]">{counts[t] ?? 0}</span>
            </button>
          ))}
          <span className="ml-auto text-[12px] text-[var(--text-tertiary)]">{filtered.length} of {drafts.length} items</span>
        </div>
        <p className="text-[13px] text-[var(--text-tertiary)] mb-4">
          Everything your agents have produced — postings, outreach, offers, proposals, change briefs. Pending items are decided on the{" "}
          <Link href="/app/approvals" className="text-[var(--accent)] hover:underline">Approvals page</Link>.
        </p>
        {error && <p className="text-[13px] text-amber-500 mb-4">{error}</p>}
        {loading ? (
          <p className="text-[var(--text-tertiary)] text-[14px]">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-[var(--text-tertiary)] text-[14px]">No artifacts yet. Run an agent and its drafts will collect here.</p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)]">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[var(--surface)] text-left text-[var(--text-secondary)]">
                  <th className="px-3 py-2 font-medium">Title</th>
                  <th className="px-3 py-2 font-medium">Agent</th>
                  <th className="px-3 py-2 font-medium">Channel</th>
                  <th className="px-3 py-2 font-medium">Recipient</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <Fragment key={d.id}>
                    <tr
                      onClick={() => setOpenId(openId === d.id ? null : d.id)}
                      className="border-t border-[var(--border)] cursor-pointer hover:bg-[var(--surface-hover)]"
                    >
                      <td className="px-3 py-2.5 max-w-[340px] truncate font-medium">{d.subject ?? "(no subject)"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-[var(--text-secondary)]">{agentLabel(d.agent)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-[var(--text-secondary)]">{d.channel}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-[var(--text-tertiary)] max-w-[200px] truncate">{d.recipient ?? "—"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`text-[11px] uppercase tracking-wider px-1.5 py-0.5 rounded ${d.status === "pending" ? "bg-amber-500/15 text-amber-500" : d.status === "approved" || d.status === "sent" ? "bg-emerald-500/15 text-emerald-500" : "bg-red-500/15 text-red-400"}`}>{d.status}</span>
                      </td>
                    </tr>
                    {openId === d.id && (
                      <tr className="border-t border-[var(--border)] bg-[var(--surface)]">
                        <td colSpan={5} className="px-4 py-3">
                          <pre className="text-[12.5px] text-[var(--text-secondary)] whitespace-pre-wrap font-sans max-h-72 overflow-y-auto">{d.body}</pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

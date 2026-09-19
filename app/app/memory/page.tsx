"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { agentLabel } from "@/lib/agents/meta";

type Memory = {
  id: string;
  agent: string;
  kind: string;
  subject: string | null;
  content: string;
  created_at?: string;
};

const KINDS = ["all", "outcome", "preference", "objection", "learning", "compliance_catch"] as const;

export default function MemoryPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [kind, setKind] = useState<(typeof KINDS)[number]>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/memory")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? "Could not load memory. Are you signed in?");
        return r.json();
      })
      .then((d: { memories: Memory[] }) => setMemories(d.memories ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let rows = kind === "all" ? memories : memories.filter((m) => m.kind === kind);
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter((m) => m.content.toLowerCase().includes(q) || (m.subject ?? "").toLowerCase().includes(q));
    }
    return rows;
  }, [memories, kind, query]);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] px-4 sm:px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/app" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)]">← Chat</Link>
        <h1 className="text-[16px] sm:text-[17px] font-semibold flex-1 min-w-[120px]">Memory</h1>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={'Try "objection"'}
          className="h-8 px-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[13px] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] w-full sm:w-56"
          aria-label="Search memory"
        />
      </header>
      <main className="max-w-4xl mx-auto px-4 sm:px-5 py-6">
        <div className="flex items-center gap-1 flex-wrap mb-4">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`h-8 px-3 rounded-lg text-[13px] font-medium capitalize transition-colors ${kind === k ? "bg-[var(--surface-hover)] text-[var(--text)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"}`}
            >
              {k.replace("_", " ")}
            </button>
          ))}
          <span className="ml-auto text-[12px] text-[var(--text-tertiary)]">{filtered.length} memories</span>
        </div>
        <p className="text-[13px] text-[var(--text-tertiary)] mb-4">
          What your agents have learned: outcomes, client preferences, objection responses, compliance catches. Agents recall this before acting — it is the outcome-data moat.
        </p>
        {error && <p className="text-[13px] text-amber-500 mb-4">{error}</p>}
        {loading ? (
          <p className="text-[var(--text-tertiary)] text-[14px]">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-[var(--text-tertiary)] text-[14px]">No memories yet. Agents save learnings automatically as they work.</p>
        ) : (
          <ul className="space-y-2.5">
            {filtered.map((m) => (
              <li key={m.id} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--surface-hover)] text-[var(--text-secondary)]">{agentLabel(m.agent)}</span>
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)]">{m.kind.replace("_", " ")}</span>
                  {m.subject && <span className="text-[12px] text-[var(--text-tertiary)]">{m.subject}</span>}
                </div>
                <p className="mt-1.5 text-[13.5px] text-[var(--text-secondary)] leading-relaxed">{m.content}</p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

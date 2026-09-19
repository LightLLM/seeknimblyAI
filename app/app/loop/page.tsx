"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type NodeStatus = { live: boolean; detail: string };

const NODES = [
  { n: 1, id: "automations", label: "Automations", href: "/app/automations", blurb: "Cron-driven agent runs: law-change monitor, lead-gen cadence, check-in sweeps." },
  { n: 2, id: "worktrees", label: "Worktrees", href: "/app/projects", blurb: "Isolated client workspaces (Projects) plus parallel chat sessions." },
  { n: 3, id: "skills", label: "Skills", href: "/app/capabilities", blurb: "Each sub-agent's toolset — ATS, checklists, briefs, proposals — with approval flags." },
  { n: 4, id: "connectors", label: "Connectors", href: "/app/messaging", blurb: "OpenAI, Supabase, Stripe, Resend, cron + delivery channels for approved drafts." },
  { n: 5, id: "subagents", label: "Sub-agents", href: "/app/capabilities", blurb: "Seven specialized agents behind one LLM router; you approve before they act." },
  { n: 6, id: "memory", label: "Memory", href: "/app/memory", blurb: "Persistent learnings: outcomes, preferences, objections, compliance catches." },
] as const;

export default function LoopPage() {
  const [status, setStatus] = useState<Record<string, NodeStatus>>({});

  useEffect(() => {
    (async () => {
      const s: Record<string, NodeStatus> = {};
      try {
        const agents = await fetch("/api/agents").then((r) => (r.ok ? r.json() : null));
        const count = agents?.agents?.length ?? 0;
        const toolCount = agents?.agents?.reduce((n: number, a: { tools: unknown[] }) => n + a.tools.length, 0) ?? 0;
        s.subagents = { live: count > 0, detail: `${count} agents registered` };
        s.skills = { live: toolCount > 0, detail: `${toolCount} tools across agents` };
        const hasMemoryTools = agents?.agents?.every((a: { tools: { name: string }[] }) =>
          a.tools.some((t) => t.name === "save_memory")
        );
        s.memory = { live: Boolean(hasMemoryTools), detail: hasMemoryTools ? "save/recall wired into every agent" : "not wired" };
      } catch {
        s.subagents = { live: false, detail: "unreachable" };
      }
      try {
        const autos = await fetch("/api/automations").then((r) => (r.ok ? r.json() : null));
        if (autos?.automations) {
          const enabled = autos.automations.filter((a: { enabled: boolean }) => a.enabled).length;
          s.automations = { live: true, detail: `${autos.automations.length} defined · ${enabled} enabled` };
        } else {
          s.automations = { live: true, detail: "sign in to see status" };
        }
      } catch {
        s.automations = { live: false, detail: "unreachable" };
      }
      try {
        const conn = await fetch("/api/connectors").then((r) => (r.ok ? r.json() : null));
        if (conn?.connectors) {
          const up = Object.values(conn.connectors).filter(Boolean).length;
          s.connectors = { live: true, detail: `${up}/${Object.keys(conn.connectors).length} configured` };
        } else {
          s.connectors = { live: true, detail: "sign in to see status" };
        }
      } catch {
        s.connectors = { live: false, detail: "unreachable" };
      }
      try {
        const clients = await fetch("/api/clients").then((r) => (r.ok ? r.json() : null));
        s.worktrees = { live: true, detail: clients?.clients ? `${clients.clients.length} client workspaces` : "sign in to see workspaces" };
      } catch {
        s.worktrees = { live: false, detail: "unreachable" };
      }
      setStatus(s);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] px-4 sm:px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/app" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)]">← Chat</Link>
        <h1 className="text-[16px] sm:text-[17px] font-semibold flex-1 min-w-[120px]">The Loop</h1>
        <span className="text-[12px] text-[var(--text-tertiary)]">Six components, one operating system</span>
      </header>
      <main className="max-w-4xl mx-auto px-4 sm:px-5 py-8">
        <p className="text-[14px] text-[var(--text-secondary)] mb-6 max-w-2xl">
          Loop engineering, applied to HR: automations feed the sub-agents, sub-agents use their skills through connectors, every run is scoped to a workspace, and everything learned lands in memory — which makes the next loop smarter.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {NODES.map((node) => {
            const st = status[node.id];
            return (
              <Link
                key={node.id}
                href={node.href}
                className="group rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 hover:border-[var(--accent)]/50 hover:shadow-[var(--shadow-md)] transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 flex items-center justify-center rounded-full border-2 border-[var(--accent)] text-[var(--accent)] text-[15px] font-bold">
                    {node.n}
                  </span>
                  <span className="text-[16px] font-semibold flex-1">{node.label}</span>
                  <span className={`w-2 h-2 rounded-full ${st ? (st.live ? "bg-emerald-500" : "bg-red-400") : "bg-[var(--border-strong)]"}`} />
                </div>
                <p className="mt-3 text-[12.5px] text-[var(--text-secondary)] leading-snug">{node.blurb}</p>
                <p className="mt-2 text-[11.5px] text-[var(--text-tertiary)]">{st?.detail ?? "checking…"}</p>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}

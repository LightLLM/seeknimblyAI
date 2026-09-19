"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getDisabledAgents, setAgentEnabled } from "@/lib/agents/prefs";

type ToolInfo = { name: string; description: string; requiresApproval: boolean };
type AgentInfo = { id: string; label: string; description: string; sample: string; tools: ToolInfo[] };

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!on);
      }}
      className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${on ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]"}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

export default function CapabilitiesPage() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [disabled, setDisabled] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setDisabled(getDisabledAgents());
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d: { agents: AgentInfo[] }) => {
        setAgents(d.agents ?? []);
        setSelected(d.agents?.[0]?.id ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () =>
      query.trim()
        ? agents.filter(
            (a) =>
              a.label.toLowerCase().includes(query.toLowerCase()) ||
              a.description.toLowerCase().includes(query.toLowerCase())
          )
        : agents,
    [agents, query]
  );
  const current = agents.find((a) => a.id === selected) ?? null;

  const toggle = (id: string, enabled: boolean) => {
    setDisabled(setAgentEnabled(id, enabled));
  };

  return (
    <div className="h-screen supports-[height:100dvh]:h-[100dvh] flex flex-col bg-[var(--bg)] text-[var(--text)] overflow-hidden">
      <header className="shrink-0 border-b border-[var(--border)] px-4 sm:px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/app" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)]">← Chat</Link>
        <h1 className="text-[16px] sm:text-[17px] font-semibold flex-1 min-w-[120px]">Capabilities</h1>
        <span className="text-[12px] text-[var(--text-tertiary)]">Sub-agents {agents.length}</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={'Try "compliance"'}
          className="h-8 px-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[13px] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] w-full sm:w-56"
          aria-label="Search capabilities"
        />
      </header>
      <div className="flex-1 min-h-0 flex">
        <div className="w-full md:w-[380px] shrink-0 overflow-y-auto border-r border-[var(--border)] p-2">
          {loading ? (
            <p className="p-3 text-[13px] text-[var(--text-tertiary)]">Loading…</p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((a) => {
                const on = !disabled.includes(a.id);
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(a.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        selected === a.id ? "bg-[var(--surface-hover)]" : "hover:bg-[var(--surface-hover)]"
                      }`}
                    >
                      <span className="flex-1 min-w-0">
                        <span className={`block text-[14px] font-medium truncate ${on ? "text-[var(--text)]" : "text-[var(--text-tertiary)]"}`}>{a.label}</span>
                        <span className="block text-[12px] text-[var(--text-tertiary)] truncate">{a.description}</span>
                      </span>
                      <Toggle on={on} onChange={(v) => toggle(a.id, v)} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="hidden md:block flex-1 min-w-0 overflow-y-auto p-6">
          {current ? (
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-[22px] font-semibold">{current.label}</h2>
                <span className={`text-[11px] uppercase tracking-wider px-2 py-0.5 rounded ${!disabled.includes(current.id) ? "bg-emerald-500/15 text-emerald-500" : "bg-[var(--surface-hover)] text-[var(--text-tertiary)]"}`}>
                  {!disabled.includes(current.id) ? "Enabled" : "Disabled"}
                </span>
              </div>
              <p className="mt-2 text-[14px] text-[var(--text-secondary)]">{current.description}.</p>
              <p className="mt-3 text-[13px] text-[var(--text-tertiary)]">
                Try: <Link href="/app" className="text-[var(--accent)] hover:underline">{current.sample}</Link>
              </p>
              <h3 className="mt-8 mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                Skills · {current.tools.length}
              </h3>
              <ul className="space-y-2">
                {current.tools.map((t) => (
                  <li key={t.name} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-[13px] font-medium">{t.name}</code>
                      {t.requiresApproval && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500">approval required</span>
                      )}
                      {t.name.startsWith("draft_") && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)]">→ outbox</span>
                      )}
                      {(t.name === "save_memory" || t.name === "recall_memories") && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500">memory</span>
                      )}
                    </div>
                    <p className="mt-1 text-[12.5px] text-[var(--text-secondary)] leading-snug">{t.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[13px] text-[var(--text-tertiary)]">Select a capability to see its skills.</p>
          )}
        </div>
      </div>
    </div>
  );
}

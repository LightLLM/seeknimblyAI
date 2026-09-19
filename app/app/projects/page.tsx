"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Client = {
  id: string;
  legal_name: string;
  status?: string;
  provinces?: string | null;
  employee_count?: number | null;
  industry?: string | null;
  tier?: string | null;
  modules?: string[];
};

export default function ProjectsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/clients")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? "Could not load projects. Are you signed in?");
        return r.json();
      })
      .then((d: { clients: Client[] }) => setClients(d.clients ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] px-4 sm:px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/app" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)]">← Chat</Link>
        <h1 className="text-[16px] sm:text-[17px] font-semibold flex-1 min-w-[120px]">Projects</h1>
        <span className="text-[12px] text-[var(--text-tertiary)]">{clients.length} client workspaces</span>
      </header>
      <main className="max-w-4xl mx-auto px-4 sm:px-5 py-6">
        <p className="text-[13px] text-[var(--text-tertiary)] mb-4">
          Each client is an isolated workspace: its own profile, provisioned modules, hires, compliance events, and audit history. The Client Onboarding agent creates these when a deal closes.
        </p>
        {error && <p className="text-[13px] text-amber-500 mb-4">{error}</p>}
        {loading ? (
          <p className="text-[var(--text-tertiary)] text-[14px]">Loading…</p>
        ) : clients.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] p-8 text-center">
            <p className="text-[14px] text-[var(--text-secondary)]">No client workspaces yet.</p>
            <p className="mt-1 text-[13px] text-[var(--text-tertiary)]">
              Close a deal with the Sales agent, then tell the Client Onboarding agent to onboard them — the workspace appears here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {clients.map((c) => (
              <div key={c.id} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex items-center gap-2">
                  <p className="text-[15px] font-medium flex-1 min-w-0 truncate">{c.legal_name}</p>
                  <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${c.status === "live" ? "bg-emerald-500/15 text-emerald-500" : c.status === "churned" ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-500"}`}>{c.status ?? "onboarding"}</span>
                </div>
                <p className="mt-1 text-[12.5px] text-[var(--text-tertiary)]">
                  {[c.industry, c.provinces, c.employee_count ? `${c.employee_count} employees` : null, c.tier].filter(Boolean).join(" · ") || "Profile incomplete"}
                </p>
                <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                  {(c.modules ?? []).length === 0 ? (
                    <span className="text-[11px] text-[var(--text-tertiary)]">No modules provisioned</span>
                  ) : (
                    (c.modules ?? []).map((m) => (
                      <span key={m} className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)]">{m}</span>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

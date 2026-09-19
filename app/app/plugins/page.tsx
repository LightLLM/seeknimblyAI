"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { StackOneVendor } from "@/lib/stackone";
import { STACKONE_VENDORS } from "@/lib/stackone";

const STORE_KEY = "seeknimbly_stackone_config";

type LocalConfig = {
  accountId: string;
  enabledVendors: string[];
};

function loadLocal(): LocalConfig {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}") as Partial<LocalConfig>;
    return {
      accountId: typeof raw.accountId === "string" ? raw.accountId : "",
      enabledVendors: Array.isArray(raw.enabledVendors) ? raw.enabledVendors.map(String) : [],
    };
  } catch {
    return { accountId: "", enabledVendors: [] };
  }
}

export default function PluginsPage() {
  const [accountId, setAccountId] = useState("");
  const [enabledVendors, setEnabledVendors] = useState<string[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [hint, setHint] = useState<string>("");
  const [mcpUrl, setMcpUrl] = useState<string | null>(null);
  const [vendors, setVendors] = useState<StackOneVendor[]>(STACKONE_VENDORS);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("stackone");

  useEffect(() => {
    const local = loadLocal();
    setAccountId(local.accountId);
    setEnabledVendors(local.enabledVendors);

    const q = local.accountId ? `?account_id=${encodeURIComponent(local.accountId)}` : "";
    fetch(`/api/plugins/stackone${q}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? "Could not load plugins. Are you signed in?");
        return r.json();
      })
      .then(
        (d: {
          configured?: boolean;
          hint?: string;
          mcp_url?: string | null;
          vendors?: StackOneVendor[];
        }) => {
          setConfigured(Boolean(d.configured));
          setHint(d.hint ?? "");
          setMcpUrl(d.mcp_url ?? null);
          if (d.vendors?.length) setVendors(d.vendors);
        }
      )
      .catch((e: Error) => setError(e.message));
  }, []);

  const refreshMcp = async (id: string) => {
    if (!id.trim()) {
      setMcpUrl(null);
      return;
    }
    try {
      const res = await fetch(`/api/plugins/stackone?account_id=${encodeURIComponent(id.trim())}`);
      if (!res.ok) return;
      const d = (await res.json()) as { mcp_url?: string | null };
      setMcpUrl(d.mcp_url ?? null);
    } catch {
      /* ignore */
    }
  };

  const save = () => {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ accountId: accountId.trim(), enabledVendors })
      );
      setSaved(true);
      void refreshMcp(accountId);
    } catch {
      setError("Could not save locally.");
    }
  };

  const toggleVendor = (id: string) => {
    setEnabledVendors((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
    setSaved(false);
  };

  const statusLabel = useMemo(() => {
    if (configured === null) return "Checking…";
    if (!configured) return "API key missing";
    if (!accountId.trim()) return "Needs account id";
    if (enabledVendors.length === 0) return "Connected — pick vendors";
    return `Linked · ${enabledVendors.length} vendor${enabledVendors.length === 1 ? "" : "s"}`;
  }, [configured, accountId, enabledVendors]);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] px-4 sm:px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/app" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)]">
          ← Chat
        </Link>
        <h1 className="text-[16px] sm:text-[17px] font-semibold flex-1 min-w-[120px]">Plugins</h1>
        <span className="text-[12px] text-[var(--text-tertiary)]">{statusLabel}</span>
      </header>

      <div className="flex min-h-[calc(100vh-53px)]">
        <aside className="w-full md:w-[280px] shrink-0 border-r border-[var(--border)] p-2 overflow-y-auto">
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            Integrations
          </p>
          <ul className="space-y-1">
            <li>
              <button
                type="button"
                onClick={() => setSelected("stackone")}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  selected === "stackone" ? "bg-[var(--surface-hover)]" : "hover:bg-[var(--surface-hover)]"
                }`}
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-medium truncate">StackOne</span>
                  <span className="block text-[12px] text-[var(--text-tertiary)] truncate">
                    Unified HRIS MCP · Workday, ADP, Dayforce
                  </span>
                </span>
                <span
                  className={`shrink-0 w-2 h-2 rounded-full ${
                    configured && accountId.trim() ? "bg-emerald-500" : "bg-[var(--border-strong)]"
                  }`}
                  aria-label={configured && accountId.trim() ? "Configured" : "Needs setup"}
                />
              </button>
            </li>
          </ul>
          <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            Also see
          </p>
          <ul className="space-y-1 pb-2">
            <li>
              <Link
                href="/app/artifacts"
                className="block px-3 py-2 rounded-lg text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
              >
                Artifacts
              </Link>
            </li>
            <li>
              <Link
                href="/app/messaging"
                className="block px-3 py-2 rounded-lg text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
              >
                Messaging & connectors
              </Link>
            </li>
          </ul>
        </aside>

        <main className="flex-1 min-w-0 px-4 sm:px-6 py-6 max-w-3xl">
          {error && <p className="text-[13px] text-amber-500 mb-4">{error}</p>}

          {selected === "stackone" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[17px] font-semibold">StackOne</h2>
                <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
                  One plugin for legacy HR systems. Connect Workday, ADP Workforce Now, Dayforce, or SAP
                  SuccessFactors through StackOne’s hosted MCP — agents keep draft-never-send + HITL before any write.
                </p>
                {hint && <p className="mt-2 text-[13px] text-[var(--text-tertiary)]">{hint}</p>}
              </div>

              <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
                <label className="block">
                  <span className="text-[12px] uppercase tracking-wider text-[var(--text-tertiary)]">
                    StackOne account id
                  </span>
                  <input
                    value={accountId}
                    onChange={(e) => {
                      setAccountId(e.target.value);
                      setSaved(false);
                    }}
                    placeholder="acc_…"
                    className="mt-1.5 w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </label>
                <p className="text-[12.5px] text-[var(--text-tertiary)]">
                  Server key:{" "}
                  <span className={configured ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"}>
                    {configured === null ? "…" : configured ? "STACKONE_API_KEY set" : "STACKONE_API_KEY missing"}
                  </span>
                  . Add the key in `.env.local` / Vercel; never paste it here.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={save}
                    className="h-9 px-4 rounded-lg bg-[var(--accent)] text-white text-[13px] font-medium hover:bg-[var(--accent-hover)]"
                  >
                    Save
                  </button>
                  {saved && <span className="text-[12px] text-[var(--text-tertiary)]">Saved on this device</span>}
                  <a
                    href="https://www.stackone.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13px] text-[var(--accent)] hover:underline ml-auto"
                  >
                    Open StackOne →
                  </a>
                </div>
                {mcpUrl && (
                  <div className="pt-1">
                    <p className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1">MCP URL</p>
                    <code className="block text-[12px] break-all text-[var(--text-secondary)] bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2">
                      {mcpUrl}
                    </code>
                  </div>
                )}
              </div>

              <section>
                <h3 className="text-[12px] uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                  HCM vendors
                </h3>
                <ul className="space-y-2">
                  {vendors.map((v) => {
                    const on = enabledVendors.includes(v.id);
                    return (
                      <li
                        key={v.id}
                        className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 flex flex-wrap items-start gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-medium">{v.label}</p>
                          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">{v.blurb}</p>
                          <a
                            href={v.docs}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block mt-1.5 text-[12px] text-[var(--accent)] hover:underline"
                          >
                            Docs
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleVendor(v.id)}
                          className={`h-8 px-3 rounded-lg text-[13px] font-medium shrink-0 ${
                            on
                              ? "bg-[var(--surface-hover)] text-[var(--text)]"
                              : "border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                          }`}
                        >
                          {on ? "Enabled" : "Enable"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 text-[12.5px] text-[var(--text-tertiary)]">
                  Enabling a vendor marks it for this workspace. Live sync still requires a StackOne-linked account and
                  HITL approval before any write-back to payroll/HCM.
                </p>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

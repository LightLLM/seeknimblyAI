"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type PartnerClient = {
  id: string;
  legal_name: string;
  status: string | null;
  provinces: string | null;
  employee_count: number | null;
  industry: string | null;
  modules: string[];
};

type Partner = {
  lead_id: string;
  company: string;
  contact_name: string | null;
  contact_email: string | null;
  province: string | null;
  stage: string | null;
  score: number | null;
  clients: PartnerClient[];
};

type Portfolio = {
  partners: Partner[];
  unassigned_clients: number;
  total_clients_under_partners: number;
};

type ClientOption = { id: string; legal_name: string; channel_partner_lead_id?: string | null };

export default function PartnersPage() {
  const [data, setData] = useState<Portfolio | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkClientId, setLinkClientId] = useState("");
  const [linkPartnerId, setLinkPartnerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([fetch("/api/partners"), fetch("/api/clients")]);
      if (!pRes.ok) throw new Error((await pRes.json().catch(() => ({})))?.error ?? "Could not load partners.");
      const portfolio = (await pRes.json()) as Portfolio;
      setData(portfolio);
      if (cRes.ok) {
        const cData = (await cRes.json()) as { clients: ClientOption[] };
        setClients(cData.clients ?? []);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function link() {
    if (!linkClientId || !linkPartnerId) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/partners/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: linkClientId, partner_lead_id: linkPartnerId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Link failed");
      setNote("Client linked to partner firm.");
      setLinkClientId("");
      await load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Link failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] px-4 sm:px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/app" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)]">
          ← Chat
        </Link>
        <h1 className="text-[16px] sm:text-[17px] font-semibold flex-1 min-w-[120px]">Channel partners</h1>
        <span className="text-[12px] text-[var(--text-tertiary)]">
          {data ? `${data.partners.length} firms · ${data.total_clients_under_partners} clients` : ""}
        </span>
      </header>
      <main className="max-w-4xl mx-auto px-4 sm:px-5 py-6 space-y-6">
        <p className="text-[14px] text-[var(--text-secondary)] max-w-2xl">
          Accounting and bookkeeping firms are the highest-leverage channel — one login, many SMB clients (~20% rev
          share). Flag a lead as a channel partner in Lead Gen, then link client workspaces here.
        </p>

        {error && <p className="text-[13px] text-amber-500">{error}</p>}
        {loading ? (
          <p className="text-[var(--text-tertiary)] text-[14px]">Loading…</p>
        ) : (
          <>
            <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">
                Link client → partner
              </h2>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={linkPartnerId}
                  onChange={(e) => setLinkPartnerId(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[13px]"
                >
                  <option value="">Partner firm…</option>
                  {(data?.partners ?? []).map((p) => (
                    <option key={p.lead_id} value={p.lead_id}>
                      {p.company}
                    </option>
                  ))}
                </select>
                <select
                  value={linkClientId}
                  onChange={(e) => setLinkClientId(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[13px]"
                >
                  <option value="">Client workspace…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.legal_name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy || !linkClientId || !linkPartnerId}
                  onClick={link}
                  className="h-10 px-4 rounded-lg bg-[var(--accent)] text-white text-[13px] font-medium disabled:opacity-50"
                >
                  {busy ? "Linking…" : "Link"}
                </button>
              </div>
              {note && <p className="mt-2 text-[12.5px] text-[var(--text-secondary)]">{note}</p>}
              {data && data.unassigned_clients > 0 && (
                <p className="mt-2 text-[12px] text-[var(--text-tertiary)]">
                  {data.unassigned_clients} client{data.unassigned_clients === 1 ? "" : "s"} not under a partner.
                </p>
              )}
            </section>

            {(data?.partners.length ?? 0) === 0 ? (
              <div className="rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] p-8 text-center">
                <p className="text-[14px] text-[var(--text-secondary)]">No channel partners yet.</p>
                <p className="mt-1 text-[13px] text-[var(--text-tertiary)]">
                  Ask Lead Gen to add an accounting firm with is_channel_partner=true, then link clients.
                </p>
              </div>
            ) : (
              <ul className="space-y-4">
                {data!.partners.map((p) => (
                  <li key={p.lead_id} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
                    <div className="flex items-start gap-2 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-medium">{p.company}</p>
                        <p className="text-[12.5px] text-[var(--text-tertiary)]">
                          {[p.contact_name, p.contact_email, p.province, p.stage, typeof p.score === "number" ? `score ${p.score}` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)]">
                        {p.clients.length} client{p.clients.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    {p.clients.length === 0 ? (
                      <p className="mt-3 text-[13px] text-[var(--text-tertiary)]">No clients linked yet.</p>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {p.clients.map((c) => (
                          <li key={c.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
                            <div className="flex items-center gap-2">
                              <p className="text-[13px] font-medium flex-1 truncate">{c.legal_name}</p>
                              <span className="text-[10px] uppercase text-[var(--text-tertiary)]">{c.status}</span>
                            </div>
                            <p className="text-[12px] text-[var(--text-tertiary)]">
                              {[c.industry, c.provinces, c.employee_count ? `${c.employee_count} emp` : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}

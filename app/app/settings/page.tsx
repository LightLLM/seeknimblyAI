"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LEGAL_CHECKLIST, ENGAGEMENT_LETTER_SKELETON, CASL_OUTREACH_RULES } from "@/lib/legal";

type Member = { id: string; email: string; role: string };
type Invite = { id: string; email: string; role: string; status: string };
type OrgInfo = { id: string; name: string; role: string };
type Sub = {
  status: string;
  trial_end: string | null;
  current_period_end: string | null;
  has_customer: boolean;
  plan?: string | null;
};

type Tab = "team" | "legal" | "billing";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("team");
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sub, setSub] = useState<Sub | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [legalDone, setLegalDone] = useState<Record<string, boolean>>({});

  const loadTeam = useCallback(async () => {
    const res = await fetch("/api/org/members");
    if (!res.ok) {
      setError((await res.json().catch(() => ({})))?.error ?? "Could not load team.");
      return;
    }
    const d = await res.json();
    setOrg(d.org);
    setMembers(d.members ?? []);
    setInvites(d.invites ?? []);
    setError(null);
  }, []);

  useEffect(() => {
    loadTeam();
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((d) => setSub(d.subscription))
      .catch(() => null);
    try {
      setLegalDone(JSON.parse(localStorage.getItem("seeknimbly_legal_done") ?? "{}"));
    } catch {
      /* ignore */
    }
  }, [loadTeam]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/org/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Invite failed");
      setNote(d.emailed ? `Invite emailed. Link: ${d.accept_url}` : `Invite created (copy link): ${d.accept_url}`);
      setEmail("");
      await loadTeam();
    } catch (ex) {
      setNote(ex instanceof Error ? ex.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function openPortal() {
    setPortalBusy(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const d = await res.json();
      if (d.url) window.location.href = d.url;
      else setNote(d.error ?? "Portal unavailable");
    } finally {
      setPortalBusy(false);
    }
  }

  function toggleLegal(id: string) {
    const next = { ...legalDone, [id]: !legalDone[id] };
    setLegalDone(next);
    localStorage.setItem("seeknimbly_legal_done", JSON.stringify(next));
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "team", label: "Team" },
    { id: "legal", label: "Legal & CASL" },
    { id: "billing", label: "Billing" },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] px-4 sm:px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/app" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)]">
          ← Chat
        </Link>
        <h1 className="text-[16px] sm:text-[17px] font-semibold flex-1 min-w-[120px]">Settings</h1>
        {org && <span className="text-[12px] text-[var(--text-tertiary)]">{org.name}</span>}
      </header>
      <main className="max-w-3xl mx-auto px-4 sm:px-5 py-6">
        <div className="flex gap-1 mb-6 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`h-9 px-3 rounded-lg text-[13px] font-medium ${
                tab === t.id ? "bg-[var(--surface-hover)]" : "text-[var(--text-secondary)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {error && <p className="text-[13px] text-amber-500 mb-4">{error}</p>}

        {tab === "team" && (
          <div className="space-y-5">
            <p className="text-[14px] text-[var(--text-secondary)]">
              Invite teammates to this workspace. Your role: <strong>{org?.role ?? "—"}</strong>
            </p>
            <form onSubmit={invite} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@firm.com"
                className="flex-1 h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[13px]"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "member")}
                className="h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[13px]"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <button
                type="submit"
                disabled={busy}
                className="h-10 px-4 rounded-lg bg-[var(--accent)] text-white text-[13px] font-medium disabled:opacity-50"
              >
                {busy ? "Sending…" : "Invite"}
              </button>
            </form>
            {note && <p className="text-[12.5px] text-[var(--text-secondary)] break-all">{note}</p>}
            <section>
              <h2 className="text-[12px] uppercase tracking-wider text-[var(--text-tertiary)] mb-2">Members</h2>
              <ul className="space-y-1.5">
                {members.map((m) => (
                  <li key={m.id} className="flex justify-between text-[13px] px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                    <span>{m.email}</span>
                    <span className="text-[var(--text-tertiary)]">{m.role}</span>
                  </li>
                ))}
              </ul>
            </section>
            {invites.length > 0 && (
              <section>
                <h2 className="text-[12px] uppercase tracking-wider text-[var(--text-tertiary)] mb-2">Pending invites</h2>
                <ul className="space-y-1.5">
                  {invites.map((i) => (
                    <li key={i.id} className="flex justify-between text-[13px] px-3 py-2 rounded-lg border border-dashed border-[var(--border)]">
                      <span>{i.email}</span>
                      <span className="text-[var(--text-tertiary)]">{i.role}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {tab === "legal" && (
          <div className="space-y-6">
            <p className="text-[14px] text-[var(--text-secondary)]">
              Pre-scale legal architecture from the data room. Track progress here; counsel completes the documents.
              This is guidance, not legal advice.
            </p>
            <ul className="space-y-3">
              {LEGAL_CHECKLIST.map((item) => (
                <li key={item.id} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(legalDone[item.id] || item.status === "done")}
                      onChange={() => toggleLegal(item.id)}
                      className="mt-1"
                    />
                    <span>
                      <span className="text-[14px] font-medium block">{item.title}</span>
                      <span className="text-[13px] text-[var(--text-secondary)] block mt-1">{item.detail}</span>
                      <span className="text-[11px] text-[var(--text-tertiary)] mt-1 block">Owner: {item.owner}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <section>
              <h2 className="text-[13px] font-semibold mb-2">CASL outreach rules (enforced in product)</h2>
              <ul className="list-disc list-inside text-[13px] text-[var(--text-secondary)] space-y-1">
                {CASL_OUTREACH_RULES.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
            <section>
              <h2 className="text-[13px] font-semibold mb-2">Engagement letter skeleton</h2>
              <pre className="text-[11px] whitespace-pre-wrap p-4 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)] max-h-64 overflow-y-auto">
                {ENGAGEMENT_LETTER_SKELETON}
              </pre>
              <button
                type="button"
                className="mt-2 text-[13px] text-[var(--accent)] hover:underline"
                onClick={() => navigator.clipboard.writeText(ENGAGEMENT_LETTER_SKELETON)}
              >
                Copy skeleton for counsel
              </button>
            </section>
          </div>
        )}

        {tab === "billing" && (
          <div className="space-y-4">
            <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5">
              <p className="text-[12px] uppercase tracking-wider text-[var(--text-tertiary)]">Subscription</p>
              <p className="mt-1 text-[18px] font-semibold capitalize">{sub?.status ?? "none"}</p>
              {sub?.plan && <p className="text-[13px] text-[var(--text-secondary)]">Plan: {sub.plan}</p>}
              {sub?.trial_end && (
                <p className="text-[13px] text-[var(--text-tertiary)]">Trial ends {new Date(sub.trial_end).toLocaleDateString()}</p>
              )}
              {sub?.current_period_end && (
                <p className="text-[13px] text-[var(--text-tertiary)]">
                  Current period ends {new Date(sub.current_period_end).toLocaleDateString()}
                </p>
              )}
            </div>
            {sub?.has_customer ? (
              <button
                type="button"
                onClick={openPortal}
                disabled={portalBusy}
                className="h-11 px-4 rounded-lg bg-[var(--accent)] text-white text-[14px] font-medium disabled:opacity-50"
              >
                {portalBusy ? "Opening…" : "Open Stripe Customer Portal"}
              </button>
            ) : (
              <p className="text-[13px] text-[var(--text-tertiary)]">
                Complete checkout from the trial gate to manage billing, switch monthly/annual, or cancel.
              </p>
            )}
            {note && <p className="text-[13px] text-amber-500">{note}</p>}
          </div>
        )}
      </main>
    </div>
  );
}

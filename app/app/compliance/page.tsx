"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Event = {
  id: string;
  kind?: string;
  title?: string;
  jurisdiction?: string | null;
  deadline?: string | null;
  effective_date?: string | null;
  source_url?: string | null;
  status?: string;
  detail?: string | null;
};

type Recurring = { when: string; what: string; who: string };

export default function ComplianceCalendarPage() {
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [open, setOpen] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/compliance/calendar")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? "Could not load calendar.");
        return r.json();
      })
      .then((d: { recurring: Recurring[]; events: Event[]; open: Event[] }) => {
        setRecurring(d.recurring ?? []);
        setEvents(d.events ?? []);
        setOpen(d.open ?? []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] px-4 sm:px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/app" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)]">← Chat</Link>
        <h1 className="text-[16px] sm:text-[17px] font-semibold flex-1 min-w-[120px]">Compliance calendar</h1>
        <span className="text-[12px] text-[var(--text-tertiary)]">{open.length} open · {events.length} logged</span>
      </header>
      <main className="max-w-4xl mx-auto px-4 sm:px-5 py-6 space-y-8">
        {error && <p className="text-[13px] text-amber-500">{error}</p>}
        {loading ? (
          <p className="text-[var(--text-tertiary)] text-[14px]">Loading…</p>
        ) : (
          <>
            <section>
              <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">Open events</h2>
              {open.length === 0 ? (
                <p className="text-[14px] text-[var(--text-tertiary)]">No open compliance events. The Compliance agent logs catches here.</p>
              ) : (
                <ul className="space-y-2">
                  {open.map((e) => (
                    <li key={e.id} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                      <div className="flex items-start gap-2">
                        <p className="text-[14px] font-medium flex-1">{e.title}</p>
                        <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">{e.kind}</span>
                      </div>
                      <p className="mt-1 text-[12.5px] text-[var(--text-tertiary)]">
                        {[e.jurisdiction, e.deadline ? `due ${e.deadline}` : null, e.effective_date ? `effective ${e.effective_date}` : null].filter(Boolean).join(" · ")}
                      </p>
                      {e.detail && <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{e.detail}</p>}
                      {e.source_url && (
                        <a href={e.source_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[12.5px] text-[var(--accent)] hover:underline">
                          Official source
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">Recurring Canadian calendar</h2>
              <ul className="space-y-2">
                {recurring.map((r) => (
                  <li key={r.when + r.what} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                    <p className="text-[12px] text-[var(--accent)] font-medium">{r.when}</p>
                    <p className="text-[14px] mt-0.5">{r.what}</p>
                    <p className="text-[12.5px] text-[var(--text-tertiary)] mt-0.5">{r.who}</p>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

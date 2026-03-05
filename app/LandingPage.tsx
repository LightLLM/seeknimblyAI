"use client";

import { useState } from "react";
import Link from "next/link";

export function LandingPage() {
  const [trialOpen, setTrialOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTrialSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          company_name: companyName.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      setSubmitted(true);
      setTrialOpen(false);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="text-[17px] font-semibold text-[var(--text)]">Seeknimbly</span>
          <Link
            href="/login"
            className="text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-4 py-16 md:py-24 text-center">
          <h1 className="text-[32px] md:text-[40px] font-bold text-[var(--text)] tracking-tight leading-tight">
            HR compliance and recruiting for SMBs
          </h1>
          <p className="mt-4 text-[17px] text-[var(--text-secondary)] max-w-xl mx-auto">
            One assistant for recruiting, compliance, onboarding, and learning & development. North America–ready.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setTrialOpen(true)}
              className="w-full sm:w-auto px-6 py-3.5 rounded-[var(--radius-lg)] bg-[var(--accent)] text-white text-[15px] font-medium hover:bg-[var(--accent-hover)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg)]"
            >
              Get free trial
            </button>
            <Link
              href="/login"
              className="w-full sm:w-auto px-6 py-3.5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-[15px] font-medium hover:bg-[var(--surface-hover)] transition-colors text-center"
            >
              Sign in
            </Link>
          </div>
          {submitted && (
            <p className="mt-6 text-[14px] text-[var(--accent)]" role="status">
              Check your email for a link to start your trial.
            </p>
          )}
        </section>

        <section className="border-t border-[var(--border)] bg-[var(--surface)]/50">
          <div className="max-w-3xl mx-auto px-4 py-16">
            <h2 className="text-[22px] font-semibold text-[var(--text)] mb-8 text-center">
              What you get
            </h2>
            <ul className="space-y-6">
              {[
                {
                  title: "Recruiting",
                  desc: "Find candidates, manage outreach, and schedule interviews with one assistant.",
                },
                {
                  title: "Compliance",
                  desc: "NA/CA/US employment standards, overtime rules, and policy checks—with a legal disclaimer.",
                },
                {
                  title: "Onboarding",
                  desc: "First-day guidance, checklists, and answers for new hires.",
                },
                {
                  title: "Learning & Development",
                  desc: "Training and leadership development recommendations.",
                },
              ].map(({ title, desc }) => (
                <li
                  key={title}
                  className="flex gap-4 p-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)]"
                >
                  <span className="shrink-0 w-8 h-8 rounded-lg bg-[var(--accent)]/20 text-[var(--accent)] flex items-center justify-center text-[14px] font-semibold">
                    {title.charAt(0)}
                  </span>
                  <div>
                    <h3 className="text-[15px] font-semibold text-[var(--text)]">{title}</h3>
                    <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="shrink-0 border-t border-[var(--border)] py-6">
        <div className="max-w-3xl mx-auto px-4 text-center text-[12px] text-[var(--text-tertiary)]">
          Seeknimbly HR — North America Compliance
        </div>
      </footer>

      {trialOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          aria-modal="true"
          role="dialog"
          aria-labelledby="trial-title"
        >
          <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-md)]">
            <div className="flex items-center justify-between mb-6">
              <h2 id="trial-title" className="text-[20px] font-semibold text-[var(--text)]">
                Start your free trial
              </h2>
              <button
                type="button"
                onClick={() => {
                  setTrialOpen(false);
                  setError(null);
                }}
                className="p-2 rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleTrialSubmit} className="space-y-4">
              <div>
                <label htmlFor="trial-email" className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5">
                  Company email
                </label>
                <input
                  id="trial-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-[15px] text-[var(--text)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                  placeholder="you@company.com"
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="trial-company" className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5">
                  Company name <span className="text-[var(--text-tertiary)]">(optional)</span>
                </label>
                <input
                  id="trial-company"
                  name="company_name"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-[15px] text-[var(--text)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                  placeholder="Acme Inc."
                  disabled={loading}
                />
              </div>
              {error && (
                <p className="text-[13px] text-red-400" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-[var(--radius-lg)] bg-[var(--accent)] text-white text-[15px] font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg)]"
              >
                {loading ? "Sending…" : "Get trial link"}
              </button>
            </form>
            <p className="mt-4 text-[12px] text-[var(--text-tertiary)]">
              We’ll send a sign-in link to your email. Click it to access the app.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

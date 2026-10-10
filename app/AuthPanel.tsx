"use client";

import { FormEvent, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

type Methods = {
  google: boolean;
  microsoft: boolean;
  credentials: boolean;
  magicLink: boolean;
};

type PanelMode = "choose" | "signup" | "signin" | "magic";

type Props = {
  /** Initial view */
  initialMode?: PanelMode;
  /** Called after magic-link email is sent successfully */
  onMagicLinkSent?: () => void;
  showLoginLink?: boolean;
  title?: string;
  subtitle?: string;
};

export function AuthPanel({
  initialMode = "choose",
  onMagicLinkSent,
  showLoginLink = true,
  title = "Get started",
  subtitle = "Create an account or sign in to start your 15-day free trial.",
}: Props) {
  const [mode, setMode] = useState<PanelMode>(initialMode);
  const [methods, setMethods] = useState<Methods>({
    google: false,
    microsoft: false,
    credentials: true,
    magicLink: false,
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/methods")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setMethods(d as Methods);
      })
      .catch(() => null);
  }, []);

  async function oauth(provider: "google" | "azure-ad") {
    setError(null);
    setOauthLoading(provider);
    try {
      await signIn(provider, { callbackUrl: "/app" });
    } catch {
      setError("Could not start sign-in. Try again.");
      setOauthLoading(null);
    }
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: name.trim() || undefined,
          company_name: companyName.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Could not create account.");
        setLoading(false);
        return;
      }
      const sign = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });
      if (sign?.ok) {
        window.location.href = "/app";
        return;
      }
      setError("Account created — please sign in.");
      setMode("signin");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("Invalid email or password.");
        setLoading(false);
        return;
      }
      if (res?.ok) {
        window.location.href = "/app";
        return;
      }
      setError("Something went wrong. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMagic(e: FormEvent) {
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      onMagicLinkSent?.();
      setMode("choose");
      setError(null);
      setEmail("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-[14px] text-[var(--text)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";

  return (
    <div className="w-full">
      <h2 className="text-[20px] font-semibold text-[var(--text)] mb-1">{title}</h2>
      <p className="text-[13px] text-[var(--text-secondary)] mb-5">{subtitle}</p>

      {mode === "choose" && (
        <div className="space-y-3">
          {methods.google && (
            <button
              type="button"
              disabled={Boolean(oauthLoading)}
              onClick={() => oauth("google")}
              className="w-full h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[14px] font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              {oauthLoading === "google" ? "Redirecting…" : "Continue with Google"}
            </button>
          )}
          {methods.microsoft && (
            <button
              type="button"
              disabled={Boolean(oauthLoading)}
              onClick={() => oauth("azure-ad")}
              className="w-full h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[14px] font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              {oauthLoading === "azure-ad" ? "Redirecting…" : "Continue with Microsoft"}
            </button>
          )}
          {(methods.google || methods.microsoft) && (
            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-[var(--border)]" />
              <span className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)]">or</span>
              <div className="h-px flex-1 bg-[var(--border)]" />
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            className="w-full h-11 rounded-lg bg-[var(--accent)] text-white text-[14px] font-medium hover:bg-[var(--accent-hover)]"
          >
            Sign up with email
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
            className="w-full h-11 rounded-lg border border-[var(--border)] text-[14px] font-medium text-[var(--text)]"
          >
            Sign in with email
          </button>
          {methods.magicLink && (
            <button
              type="button"
              onClick={() => {
                setMode("magic");
                setError(null);
              }}
              className="w-full text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)] py-1"
            >
              Prefer a magic link? Email me a trial link →
            </button>
          )}
          {!methods.google && !methods.microsoft && (
            <p className="text-[12px] text-[var(--text-tertiary)]">
              Google / Microsoft buttons appear after you set OAuth keys in the server env.
            </p>
          )}
        </div>
      )}

      {(mode === "signup" || mode === "signin") && (
        <form onSubmit={mode === "signup" ? handleSignup : handleSignIn} className="space-y-3">
          {mode === "signup" && (
            <>
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Name</label>
                <input
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Founder"
                  disabled={loading}
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                  Company (optional)
                </label>
                <input
                  className={inputClass}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Inc."
                  disabled={loading}
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Work email</label>
            <input
              type="email"
              required
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              disabled={loading}
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Password</label>
            <input
              type="password"
              required
              minLength={8}
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
              disabled={loading}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>
          {error && (
            <p className="text-[13px] text-red-500" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg bg-[var(--accent)] text-white text-[14px] font-medium disabled:opacity-50"
          >
            {loading
              ? mode === "signup"
                ? "Creating…"
                : "Signing in…"
              : mode === "signup"
                ? "Create account →"
                : "Sign in →"}
          </button>
          <button
            type="button"
            className="w-full text-[13px] text-[var(--text-secondary)]"
            onClick={() => {
              setMode(mode === "signup" ? "signin" : "signup");
              setError(null);
            }}
          >
            {mode === "signup" ? "Already have an account? Sign in" : "Need an account? Sign up"}
          </button>
          <button
            type="button"
            className="w-full text-[12px] text-[var(--text-tertiary)]"
            onClick={() => {
              setMode("choose");
              setError(null);
            }}
          >
            ← All sign-up options
          </button>
        </form>
      )}

      {mode === "magic" && (
        <form onSubmit={handleMagic} className="space-y-3">
          <p className="text-[13px] text-[var(--text-secondary)]">
            We’ll email a one-time link. No password required.
          </p>
          <div>
            <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Work email</label>
            <input
              type="email"
              required
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
              Company (optional)
            </label>
            <input
              className={inputClass}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Inc."
              disabled={loading}
            />
          </div>
          {error && (
            <p className="text-[13px] text-red-500" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg bg-[var(--accent)] text-white text-[14px] font-medium disabled:opacity-50"
          >
            {loading ? "Sending…" : "Email me a trial link →"}
          </button>
          <button
            type="button"
            className="w-full text-[12px] text-[var(--text-tertiary)]"
            onClick={() => {
              setMode("choose");
              setError(null);
            }}
          >
            ← All sign-up options
          </button>
        </form>
      )}

      {showLoginLink && mode === "choose" && (
        <p className="mt-4 text-center text-[12px] text-[var(--text-tertiary)]">
          Already a customer?{" "}
          <Link href="/login" className="text-[var(--accent)] hover:underline">
            Sign in
          </Link>
        </p>
      )}
    </div>
  );
}

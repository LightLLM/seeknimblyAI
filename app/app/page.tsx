"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChatPage } from "../ChatPage";

type SubState = {
  subscription: { status: string; trial_end: string | null; current_period_end: string | null; has_customer: boolean } | null;
  canAccess: boolean;
} | null;

export default function AppPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [subState, setSubState] = useState<SubState>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated" || !session) return;
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((data) => setSubState({ subscription: data.subscription, canAccess: data.canAccess ?? false }))
      .catch(() => setSubState({ subscription: null, canAccess: false }));
  }, [status, session]);

  async function handleStartTrial() {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setCheckoutLoading(false);
    } catch {
      setCheckoutLoading(false);
    }
  }

  async function handleBilling() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      setPortalLoading(false);
    } catch {
      setPortalLoading(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <p className="text-[var(--text-tertiary)] text-[15px]">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const loadingSub = subState === null;
  const canAccess = subState?.canAccess ?? false;

  if (!loadingSub && !canAccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)] px-4">
        <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
          <h1 className="text-[22px] font-semibold text-[var(--text)] mb-2">
            Start your 15-day free trial
          </h1>
          <p className="text-[15px] text-[var(--text-secondary)] mb-6">
            Add a payment method to unlock Seeknimbly HR. You won’t be charged during the trial. Cancel anytime within 15 days with no charge.
          </p>
          <button
            type="button"
            onClick={handleStartTrial}
            disabled={checkoutLoading}
            className="w-full h-12 rounded-[var(--radius-lg)] bg-[var(--accent)] text-white text-[15px] font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {checkoutLoading ? "Redirecting…" : "Continue to payment setup"}
          </button>
          <p className="mt-4 text-[12px] text-[var(--text-tertiary)]">
            Cancel anytime from Billing after you sign up.
          </p>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="mt-6 text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text)]"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="shrink-0 flex items-center justify-between h-12 px-4 border-b border-[var(--border)] bg-[var(--surface)]">
        <span className="text-[13px] font-medium text-[var(--text)]">Seeknimbly HR</span>
        <div className="flex items-center gap-2">
          {subState?.subscription?.has_customer && (
            <button
              type="button"
              onClick={handleBilling}
              disabled={portalLoading}
              className="px-3 py-2 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] disabled:opacity-50"
            >
              {portalLoading ? "Opening…" : "Billing"}
            </button>
          )}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="px-3 py-2 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="flex flex-1 min-h-0">
        {loadingSub ? (
          <div className="flex items-center justify-center flex-1">
            <p className="text-[var(--text-tertiary)] text-[15px]">Loading…</p>
          </div>
        ) : (
          <ChatPage />
        )}
      </main>
    </div>
  );
}

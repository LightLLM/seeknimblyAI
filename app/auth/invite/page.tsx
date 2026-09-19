"use client";

import { useEffect, useState, Suspense } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function InviteInner() {
  const { data: session, status } = useSession();
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status !== "authenticated" || !token) return;
    setBusy(true);
    fetch("/api/org/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Failed");
        setMsg(`Joined ${d.org?.orgName ?? "workspace"}. Redirecting…`);
        setTimeout(() => router.replace("/app"), 1200);
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setBusy(false));
  }, [status, token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <h1 className="text-[20px] font-semibold mb-2">Workspace invite</h1>
        {!token && <p className="text-[14px] text-amber-500">Missing invite token.</p>}
        {status === "loading" && <p className="text-[14px] text-[var(--text-tertiary)]">Loading…</p>}
        {status === "unauthenticated" && token && (
          <>
            <p className="text-[14px] text-[var(--text-secondary)] mb-4">
              Sign in with the invited email to join this Seeknimbly workspace.
            </p>
            <button
              type="button"
              onClick={() => signIn(undefined, { callbackUrl: `/auth/invite?token=${token}` })}
              className="w-full h-11 rounded-lg bg-[var(--accent)] text-white text-[14px] font-medium"
            >
              Sign in to accept
            </button>
            <Link href="/login" className="mt-3 inline-block text-[13px] text-[var(--text-tertiary)]">
              Or go to login
            </Link>
          </>
        )}
        {busy && <p className="text-[14px] text-[var(--text-tertiary)]">Accepting invite…</p>}
        {msg && <p className="text-[14px] text-emerald-500">{msg}</p>}
        {err && <p className="text-[14px] text-amber-500">{err}</p>}
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-[var(--text-tertiary)]">Loading…</div>}>
      <InviteInner />
    </Suspense>
  );
}

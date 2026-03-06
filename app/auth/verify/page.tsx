"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function AuthVerifyInner() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      window.location.href = "/?error=invalid_link";
      return;
    }

    let cancelled = false;

    async function verify() {
      const res = await signIn("credentials", {
        token,
        redirect: false,
      });
      if (cancelled) return;
      if (res?.ok) {
        setStatus("success");
        window.location.href = "/app";
        return;
      }
      window.location.href = "/?error=invalid_link";
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <p className="text-[var(--text-tertiary)] text-[15px]">
        {status === "loading" ? "Verifying your link…" : "Redirecting…"}
      </p>
    </div>
  );
}

export default function AuthVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
          <p className="text-[var(--text-tertiary)] text-[15px]">Verifying your link…</p>
        </div>
      }
    >
      <AuthVerifyInner />
    </Suspense>
  );
}

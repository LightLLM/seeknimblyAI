"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LandingPage } from "./LandingPage";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/app");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <p className="text-[var(--text-tertiary)] text-[15px]">Loading…</p>
      </div>
    );
  }

  if (session) {
    return null;
  }

  return <LandingPage />;
}

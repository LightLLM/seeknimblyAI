"use client";

import { useSession } from "next-auth/react";
import { LoginForm } from "./LoginForm";
import { ChatPage } from "./ChatPage";

export default function Home() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <p className="text-[var(--text-tertiary)] text-[15px]">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <LoginForm />;
  }

  return <ChatPage />;
}

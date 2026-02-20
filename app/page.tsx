"use client";

import { useSession, signOut } from "next-auth/react";
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

  return (
    <div className="flex flex-col min-h-screen">
      <header className="shrink-0 flex items-center justify-between h-12 px-4 border-b border-[var(--border)] bg-[var(--surface)]">
        <span className="text-[13px] font-medium text-[var(--text)]">Seeknimbly HR</span>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="px-3 py-2 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
        >
          Sign out
        </button>
      </header>
      <main className="flex flex-1 min-h-0">
        <ChatPage />
      </main>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { LoginForm } from "./LoginForm";
import { ChatPage } from "./ChatPage";
import { OnboardingPage } from "./OnboardingPage";

type AppView = "chat" | "onboarding";

export default function Home() {
  const { data: session, status } = useSession();
  const [view, setView] = useState<AppView>("chat");

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
        <nav className="flex items-center gap-1" aria-label="Main">
          <button
            type="button"
            onClick={() => setView("chat")}
            className={`px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
              view === "chat" ? "bg-[var(--surface-hover)] text-[var(--text)]" : "text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            Compliance Chat
          </button>
          <button
            type="button"
            onClick={() => setView("onboarding")}
            className={`px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
              view === "onboarding" ? "bg-[var(--surface-hover)] text-[var(--text)]" : "text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            Onboarding
          </button>
        </nav>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="px-3 py-2 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
        >
          Sign out
        </button>
      </header>
      <main className="flex flex-1 min-h-0">
        {view === "chat" ? <ChatPage /> : <OnboardingPage />}
      </main>
    </div>
  );
}

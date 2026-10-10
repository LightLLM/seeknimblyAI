"use client";

import { AuthPanel } from "./AuthPanel";

export function LoginForm() {
  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-md)]">
          <AuthPanel
            initialMode="signin"
            title="Sign in"
            subtitle="Use Google, Microsoft, or your email and password."
            showLoginLink={false}
          />
        </div>
        <p className="mt-4 text-center text-[12px] text-[var(--text-tertiary)]">
          New here?{" "}
          <a href="/#get-started" className="text-[var(--accent)] hover:underline">
            Create an account
          </a>
        </p>
      </div>
    </div>
  );
}

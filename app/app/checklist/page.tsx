"use client";

import { OnboardingPage } from "../../OnboardingPage";
import Link from "next/link";

export default function ChecklistRoute() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="border-b border-[var(--border)] px-4 py-2">
        <Link href="/app/onboarding" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)]">
          ← Hire onboarding dashboard
        </Link>
      </div>
      <OnboardingPage />
    </div>
  );
}

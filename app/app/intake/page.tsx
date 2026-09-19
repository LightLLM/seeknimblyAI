"use client";

import { useState } from "react";
import Link from "next/link";

type Kind = "hire" | "role" | "client";

const TABS: { id: Kind; label: string; blurb: string }[] = [
  { id: "hire", label: "New hire", blurb: "Seeds the statutory checklist for the province." },
  { id: "role", label: "Job req", blurb: "Creates a job with an approved screening rubric." },
  { id: "client", label: "Client", blurb: "Provisions a client workspace after a closed deal." },
];

export default function IntakePage() {
  const [kind, setKind] = useState<Kind>("hire");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // hire
  const [hireName, setHireName] = useState("");
  const [hireRole, setHireRole] = useState("");
  const [hireProvince, setHireProvince] = useState("ON");
  const [hireStart, setHireStart] = useState("");

  // role
  const [jobTitle, setJobTitle] = useState("");
  const [jobProvince, setJobProvince] = useState("ON");
  const [jobSalary, setJobSalary] = useState("");
  const [jobMust, setJobMust] = useState("");
  const [jobRubric, setJobRubric] = useState("");

  // client
  const [legalName, setLegalName] = useState("");
  const [clientProvinces, setClientProvinces] = useState("ON");
  const [employeeCount, setEmployeeCount] = useState("25");
  const [industry, setIndustry] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    let fields: Record<string, unknown> = {};
    if (kind === "hire") {
      fields = { name: hireName, role: hireRole, province: hireProvince, start_date: hireStart || undefined };
    } else if (kind === "role") {
      fields = {
        title: jobTitle,
        province: jobProvince,
        salary_range: jobSalary || undefined,
        must_haves: jobMust || undefined,
        rubric: jobRubric || undefined,
      };
    } else {
      fields = {
        legal_name: legalName,
        provinces: clientProvinces,
        employee_count: Number(employeeCount) || undefined,
        industry: industry || undefined,
      };
    }
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, fields }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMsg(typeof data.result === "object" ? JSON.stringify(data.result, null, 2) : String(data.result));
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] px-4 sm:px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/app" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)]">
          ← Chat
        </Link>
        <h1 className="text-[16px] sm:text-[17px] font-semibold flex-1 min-w-[120px]">Intake forms</h1>
        <span className="text-[12px] text-[var(--text-tertiary)]">Chat for judgment · forms for data entry</span>
      </header>
      <main className="max-w-xl mx-auto px-4 sm:px-5 py-6">
        <div className="flex gap-1 mb-5 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setKind(t.id);
                setMsg(null);
                setErr(null);
              }}
              className={`h-9 px-3 rounded-lg text-[13px] font-medium ${
                kind === t.id ? "bg-[var(--surface-hover)] text-[var(--text)]" : "text-[var(--text-secondary)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-[13px] text-[var(--text-tertiary)] mb-4">{TABS.find((t) => t.id === kind)?.blurb}</p>
        <form onSubmit={submit} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
          {kind === "hire" && (
            <>
              <Field label="Full name" value={hireName} onChange={setHireName} required />
              <Field label="Role" value={hireRole} onChange={setHireRole} />
              <Field label="Province" value={hireProvince} onChange={setHireProvince} required />
              <Field label="Start date (YYYY-MM-DD)" value={hireStart} onChange={setHireStart} />
            </>
          )}
          {kind === "role" && (
            <>
              <Field label="Job title" value={jobTitle} onChange={setJobTitle} required />
              <Field label="Province" value={jobProvince} onChange={setJobProvince} />
              <Field label="Salary range" value={jobSalary} onChange={setJobSalary} />
              <Field label="Must-haves" value={jobMust} onChange={setJobMust} />
              <Field label="Screening rubric" value={jobRubric} onChange={setJobRubric} />
            </>
          )}
          {kind === "client" && (
            <>
              <Field label="Legal name" value={legalName} onChange={setLegalName} required />
              <Field label="Provinces" value={clientProvinces} onChange={setClientProvinces} />
              <Field label="Employee count" value={employeeCount} onChange={setEmployeeCount} />
              <Field label="Industry" value={industry} onChange={setIndustry} />
            </>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full h-10 rounded-lg bg-[var(--accent)] text-white text-[13px] font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {busy ? "Saving…" : "Submit"}
          </button>
          {err && <p className="text-[13px] text-amber-500">{err}</p>}
          {msg && (
            <pre className="text-[11px] overflow-x-auto p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text-secondary)]">
              {msg}
            </pre>
          )}
        </form>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[12px] uppercase tracking-wider text-[var(--text-tertiary)]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1 w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[14px]"
      />
    </label>
  );
}

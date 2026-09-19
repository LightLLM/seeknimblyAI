/**
 * Public Day-1 Compliance Snapshot — canned logic that always surfaces at
 * least one real SMB gap. No signup; booth / top-of-funnel demo.
 */

export type DemoInput = {
  province: "ON" | "BC" | "AB" | "QC";
  employee_count: number;
  industry: string;
  has_handbook?: boolean;
  uses_contractors?: boolean;
};

export type DemoGap = {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  fix: string;
};

export type DemoSnapshot = {
  score: number;
  pass: number;
  gap: number;
  unknown: number;
  gaps: DemoGap[];
  headline: string;
  disclaimer: string;
};

const INDUSTRY_HINTS: Record<string, string> = {
  restaurant: "hospitality tip pooling and hours-of-work rules",
  hospitality: "hospitality tip pooling and hours-of-work rules",
  retail: "retail scheduling and stat-holiday pay",
  construction: "workers' comp classification and site training",
  trades: "workers' comp classification and site training",
  clinic: "privacy (PIPEDA/Law 25) for patient-adjacent staff records",
  healthcare: "privacy (PIPEDA/Law 25) for patient-adjacent staff records",
  professional: "employee-vs-contractor classification on professional services",
  default: "provincial ESA basics and payroll remittances",
};

function industryHint(industry: string): string {
  const lower = industry.toLowerCase();
  for (const [k, v] of Object.entries(INDUSTRY_HINTS)) {
    if (k !== "default" && lower.includes(k)) return v;
  }
  return INDUSTRY_HINTS.default;
}

export function buildDay1Snapshot(input: DemoInput): DemoSnapshot {
  const gaps: DemoGap[] = [];
  const n = input.employee_count;

  // Always catch at least one real gap — classic SMB landmines.
  if (input.uses_contractors !== false) {
    gaps.push({
      id: "classification",
      severity: "high",
      title: "Employee vs. contractor classification",
      detail: `With ~${n} people in ${input.province}, misclassified contractors are the classic CRA landmine — especially around ${industryHint(input.industry)}.`,
      fix: "Run CRA's two-step test on every contractor; convert or document bona fide independence before the next remittance.",
    });
  }

  if (input.has_handbook === false || input.has_handbook == null) {
    gaps.push({
      id: "handbook",
      severity: "high",
      title: "No current employee handbook on file",
      detail: `${input.province} employers need policy acknowledgements (H&S, harassment where required, privacy). Missing handbook = audit gap on day one.`,
      fix: "Generate a province-aware handbook draft and collect signed acknowledgements within 10 business days.",
    });
  }

  if (input.province === "ON" && n >= 1) {
    gaps.push({
      id: "ohs",
      severity: "medium",
      title: "Ontario H&S awareness training not tracked",
      detail: "Ontario workers (and supervisors) need mandatory H&S awareness; most SMBs cannot produce completion records on request.",
      fix: "Enroll all active workers; store certificates with expiry reminders.",
    });
  }

  if (input.province === "BC") {
    gaps.push({
      id: "pay_transparency",
      severity: "medium",
      title: "BC pay transparency on postings",
      detail: "BC requires salary ranges on publicly advertised jobs. Missing ranges is a posting compliance gap.",
      fix: "Add ranges to every open posting before it goes live.",
    });
  }

  if (input.province === "QC") {
    gaps.push({
      id: "bill96",
      severity: "high",
      title: "Quebec Bill 96 / French-language requirements",
      detail: "Written offers, policies, and many communications must meet French-language rules — never improvise translations of legal docs.",
      fix: "Flag counsel for French versions of handbook, offers, and customer-facing HR docs.",
    });
  }

  if (n >= 20) {
    gaps.push({
      id: "roe_timing",
      severity: "medium",
      title: "ROE timing risk",
      detail: "ROE must issue within 5 calendar days of an interruption of earnings. Growing teams miss this under volume.",
      fix: "Add a payroll interruption checklist owned by whoever runs payroll.",
    });
  }

  // Guarantee ≥1 gap
  if (gaps.length === 0) {
    gaps.push({
      id: "payroll_remit",
      severity: "high",
      title: "CRA remitter category unverified",
      detail: "Without confirming remitter frequency, late remittances stack penalties quickly.",
      fix: "Confirm CRA remitter category and calendar the next remittance date.",
    });
  }

  const checklistSize = 12;
  const gap = Math.min(gaps.length, 5);
  const pass = Math.max(0, checklistSize - gap - 2);
  const unknown = checklistSize - pass - gap;
  const score = Math.round((pass / checklistSize) * 100);

  return {
    score,
    pass,
    gap,
    unknown,
    gaps: gaps.slice(0, 5),
    headline: `Day-1 snapshot for a ${n}-person ${input.industry || "SMB"} in ${input.province}: ${gap} gap${gap === 1 ? "" : "s"} to close first.`,
    disclaimer: "This is guidance, not legal advice.",
  };
}

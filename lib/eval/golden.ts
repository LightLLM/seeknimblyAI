/**
 * Golden-question eval harness for compliance-adjacent answers.
 * Offline scoring: required phrases / jurisdictions must appear.
 * Run with `npm run test:eval` (part of `npm test` via Jest).
 */

export type GoldenQuestion = {
  id: string;
  province: "ON" | "BC" | "AB" | "QC" | "CA";
  question: string;
  /** Substrings that a correct answer should mention (case-insensitive). */
  must_include: string[];
  /** Substrings that must NOT appear (hallucinated claims / prohibited advice). */
  must_not_include?: string[];
  /** Answer must end with / include the legal disclaimer. */
  require_disclaimer?: boolean;
};

export const GOLDEN_QUESTIONS: GoldenQuestion[] = [
  {
    id: "on-min-wage",
    province: "ON",
    question: "What is the general minimum wage in Ontario and when does it typically change?",
    must_include: ["ontario", "minimum wage", "october"],
    must_not_include: ["this is legal advice"],
    require_disclaimer: true,
  },
  {
    id: "on-overtime",
    province: "ON",
    question: "When does overtime start for most Ontario employees?",
    must_include: ["44", "hour", "ontario"],
    require_disclaimer: true,
  },
  {
    id: "roe-timing",
    province: "CA",
    question: "How quickly must an ROE be issued after an interruption of earnings?",
    must_include: ["5", "day", "roe"],
    require_disclaimer: true,
  },
  {
    id: "bc-pay-transparency",
    province: "BC",
    question: "Do BC job postings need salary ranges?",
    must_include: ["salary", "range", "bc"],
    require_disclaimer: true,
  },
  {
    id: "qc-bill96",
    province: "QC",
    question: "What should we flag for Quebec employers about language of HR documents?",
    must_include: ["french", "quebec"],
    require_disclaimer: true,
  },
  {
    id: "classification",
    province: "CA",
    question: "What is the classic SMB payroll landmine around contractors?",
    must_include: ["contractor", "employee"],
    require_disclaimer: true,
  },
  {
    id: "pipeda",
    province: "CA",
    question: "What federal privacy law applies to employee personal information in most of Canada?",
    must_include: ["pipeda"],
    require_disclaimer: true,
  },
  {
    id: "on-hs-training",
    province: "ON",
    question: "What mandatory health & safety training applies to Ontario workers?",
    must_include: ["health", "safety", "ontario"],
    require_disclaimer: true,
  },
];

export type ScoreResult = {
  id: string;
  pass: boolean;
  missing: string[];
  forbidden_hits: string[];
  disclaimer_ok: boolean;
};

export function scoreAnswer(q: GoldenQuestion, answer: string): ScoreResult {
  const text = answer.toLowerCase();
  const missing = q.must_include.filter((s) => !text.includes(s.toLowerCase()));
  const forbidden_hits = (q.must_not_include ?? []).filter((s) => text.includes(s.toLowerCase()));
  const disclaimer_ok =
    !q.require_disclaimer ||
    text.includes("not legal advice") ||
    text.includes("guidance, not legal advice");
  const pass = missing.length === 0 && forbidden_hits.length === 0 && disclaimer_ok;
  return { id: q.id, pass, missing, forbidden_hits, disclaimer_ok };
}

/** Fixture answers that should pass — used to lock the scorer. */
export const FIXTURE_PASSING_ANSWERS: Record<string, string> = {
  "on-min-wage":
    "Ontario's general minimum wage adjusts each October 1. Confirm the current rate on ontario.ca before changing payroll. This is guidance, not legal advice.",
  "on-overtime":
    "For most Ontario employees under the ESA, overtime starts after 44 hours in a work week. This is guidance, not legal advice.",
  "roe-timing":
    "An ROE must generally be issued within 5 calendar days of an interruption of earnings. This is guidance, not legal advice.",
  "bc-pay-transparency":
    "BC pay transparency rules require salary ranges on publicly advertised job postings. This is guidance, not legal advice.",
  "qc-bill96":
    "Quebec Bill 96 increases French-language requirements for many written communications and HR documents. Flag counsel; never improvise legal translations. This is guidance, not legal advice.",
  classification:
    "The classic SMB landmine is misclassifying employees as contractors. Use CRA tests before engaging contractors. This is guidance, not legal advice.",
  pipeda:
    "PIPEDA is the federal privacy law that typically governs employee personal information outside provinces with substantially similar laws. This is guidance, not legal advice.",
  "on-hs-training":
    "Ontario requires worker (and supervisor) health and safety awareness training; keep completion records. This is guidance, not legal advice.",
};

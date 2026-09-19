/**
 * In-product legal / CASL / E&O checklist — operationalizes #19 so the team
 * has a living surface (not a PDF in a drive). Not legal advice.
 */

export type LegalItem = {
  id: string;
  title: string;
  detail: string;
  owner: string;
  status: "todo" | "in_progress" | "done";
};

export const LEGAL_CHECKLIST: LegalItem[] = [
  {
    id: "engagement-letter",
    title: "Engagement letter from employment counsel",
    detail:
      "Retain Canadian employment counsel for an engagement letter covering guidance-not-advice positioning, human-approval gates, and error-correction SLA. Seeknimbly never files with government bodies.",
    owner: "Founder + counsel",
    status: "todo",
  },
  {
    id: "casl-review",
    title: "CASL review of outreach templates",
    detail:
      "Commercial electronic messages need consent (express or implied), identification, and unsubscribe. Prefer LinkedIn/referral for cold contact; 3 touches max then dormant. Have counsel review email drafts in the outbox.",
    owner: "Founder + counsel",
    status: "todo",
  },
  {
    id: "eo-insurance",
    title: "E&O / professional liability quotes",
    detail:
      "Obtain quotes (e.g. Embroker, Coalition) covering AI-assisted HR guidance. Keep draft-never-send and HITL approvals as primary product controls named in the policy application.",
    owner: "Founder",
    status: "todo",
  },
  {
    id: "privacy-pipeda",
    title: "PIPEDA / Law 25 handling documented",
    detail:
      "Minimum collection; employee data stays in the client record; no cross-client leakage. Retention cron redacts aged chat/memory content. Document in customer MSA.",
    owner: "Founder",
    status: "in_progress",
  },
  {
    id: "hitl-nonnegotiable",
    title: "Human-approval model stays non-negotiable",
    detail:
      "All external email/postings/proposals go through the outbox. State-mutating tools pause for in-chat approval. Do not add auto-send without counsel sign-off.",
    owner: "Engineering",
    status: "done",
  },
];

export const ENGAGEMENT_LETTER_SKELETON = `ENGAGEMENT LETTER — SKELETON (for counsel to complete)
Seeknimbly AI Inc. / Client

1. Scope. Seeknimbly provides AI-assisted HR workflow automation and guidance for Canadian SMBs. Outputs are guidance, not legal advice. Seeknimbly does not file with government bodies or act as the client's legal counsel.

2. Human approval. All external communications and consequential actions (offers, terminations, policy changes, filings) require named human approval before transmission or effect.

3. Error-correction. Client may report errors in-product; Seeknimbly logs and corrects material compliance mistakes under an agreed SLA.

4. Privacy. PIPEDA / applicable provincial privacy law. Minimum collection; no cross-client data use.

5. Limitation of liability / insurance. [Counsel to complete — align with E&O policy.]

6. Term and termination. [Counsel to complete.]

This skeleton is not a substitute for counsel-drafted terms.
`;

export const CASL_OUTREACH_RULES = [
  "Prefer LinkedIn or referral intros for cold contact in Canada.",
  "Email only with express consent or valid implied consent (published business address + relevant inquiry).",
  "Identify the sender and Seeknimbly; include a working unsubscribe.",
  "Max 3 touches, then mark the lead dormant.",
  "Never auto-send — drafts go to the Approvals outbox only.",
];

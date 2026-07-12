/**
 * Client-safe agent metadata (no server imports). Used by the chat UI and by
 * the server-side registry so ids/labels never drift.
 */

export type AgentMeta = {
  id: string;
  label: string;
  description: string;
  sample: string;
};

export const AGENTS_META: AgentMeta[] = [
  {
    id: "recruiting",
    label: "Recruiting",
    description: "Job descriptions, resume screening, pipeline, interview scheduling",
    sample: "Create a job for a Senior Backend Engineer in Toronto and draft the posting.",
  },
  {
    id: "onboarding",
    label: "Onboarding",
    description: "Offer letters, statutory paperwork, checklists, 30/60/90 plans",
    sample: "We hired Maya Chen as an Ontario line cook starting Aug 4 — set up her onboarding.",
  },
  {
    id: "training",
    label: "Training & Development",
    description: "Mandatory training, learning paths, certification tracking",
    sample: "Build a learning path for a new restaurant supervisor in Ontario.",
  },
  {
    id: "compliance",
    label: "Compliance",
    description: "Law-change monitoring, deadlines, audits, change briefs",
    sample: "Run the compliance audit checklist for a 25-person Ontario restaurant.",
  },
  {
    id: "lead_gen",
    label: "Lead Gen",
    description: "Prospect scoring, CRM, outreach drafts (approval required)",
    sample: "Add Harvest Table Group (ON, ~40 staff, hiring 3 roles) as a lead, score it, and draft outreach.",
  },
  {
    id: "sales",
    label: "Sales",
    description: "Replies, call prep, proposals, stage management",
    sample: "Harvest Table replied asking about pricing — draft a response and prep the call.",
  },
  {
    id: "client_onboarding",
    label: "Client Onboarding",
    description: "Signed client → live in 5 days: intake, Day-1 snapshot, kickoff",
    sample: "Harvest Table signed for Compliance + Recruiting — onboard them.",
  },
];

export function agentLabel(id: string): string {
  if (id === "learning_development") return "Learning & Development"; // legacy tag
  return AGENTS_META.find((a) => a.id === id)?.label ?? id;
}

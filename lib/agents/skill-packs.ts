/**
 * Versioned skill-pack metadata (hermes-style). Runtime still uses live tool
 * registries; packs document what each agent ships for capabilities/audit.
 */

export type SkillPack = {
  id: string;
  version: string;
  agent: string;
  label: string;
  skills: string[];
};

export const SKILL_PACKS: SkillPack[] = [
  {
    id: "recruiting.core",
    version: "1.1.0",
    agent: "recruiting",
    label: "Recruiting core",
    skills: ["job_intake", "jd_draft", "resume_screen", "ats_pipeline", "interview_invite"],
  },
  {
    id: "onboarding.core",
    version: "1.2.0",
    agent: "onboarding",
    label: "Onboarding core",
    skills: ["offer_letter", "statutory_checklist", "30_60_90", "checkins", "hire_status"],
  },
  {
    id: "training.core",
    version: "1.1.0",
    agent: "training",
    label: "Training & certs",
    skills: ["mandatory_training", "learning_paths", "certification_tracking", "expiry_reminders"],
  },
  {
    id: "compliance.core",
    version: "1.3.0",
    agent: "compliance",
    label: "Compliance monitor",
    skills: ["web_search", "change_brief", "calendar", "audit_checklist", "quarterly_audit"],
  },
  {
    id: "lifecycle.growth",
    version: "1.0.0",
    agent: "lead_gen",
    label: "Lifecycle growth",
    skills: ["icp_score", "outreach_draft", "crm_stages", "casl_limits"],
  },
];

export function skillPacksForAgent(agentId: string): SkillPack[] {
  return SKILL_PACKS.filter((p) => p.agent === agentId);
}

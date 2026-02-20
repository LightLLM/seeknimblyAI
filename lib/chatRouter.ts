/**
 * Suggests which top-level chat agent (Recruiting, Compliance, Onboarding, Learning & Development) should handle a user message.
 * Used for the unified chat flow: user sends message → we suggest agent → user approves → we call that agent.
 */

export type ChatAgent = "recruiting" | "compliance" | "onboarding" | "learning_development";

export type RouteSuggestion = {
  suggestedAgent: ChatAgent;
  reason: string;
};

const RECRUITING_PHRASES = [
  "hire",
  "recruit",
  "candidates",
  "job opening",
  "job posting",
  "find engineers",
  "talent",
  "position",
  "headcount",
  "staffing",
  "backfill",
  "role",
  "applicants",
  "sourcing",
  "kubeflow",
  "mlflow",
  "backend engineer",
  "frontend",
  "toronto",
  "vancouver",
];

const ONBOARDING_PHRASES = [
  "first day",
  "first week",
  "new hire",
  "onboarding",
  "who do i contact",
  "who to contact",
  "it access",
  "equipment",
  "laptop",
  "benefits enrollment",
  "direct deposit",
  "tax forms",
  "i-9",
  "handbook",
  "orientation",
];

const LEARNING_DEVELOPMENT_PHRASES = [
  "training",
  "learning",
  "development",
  "l&d",
  "l and d",
  "career development",
  "skills",
  "course",
  "certification",
  "upskill",
  "reskill",
  "professional development",
  "leadership development",
  "coaching",
  "mentoring",
  "workshop",
  "webinar",
  "learning path",
  "competency",
];

export function suggestChatAgent(message: string): RouteSuggestion {
  const lower = message.toLowerCase().trim();
  if (!lower) {
    return { suggestedAgent: "compliance", reason: "No message; defaulting to Compliance." };
  }

  const hasRecruiting = RECRUITING_PHRASES.some((p) => lower.includes(p));
  const hasOnboarding = ONBOARDING_PHRASES.some((p) => lower.includes(p));
  const hasLearningDevelopment = LEARNING_DEVELOPMENT_PHRASES.some((p) => lower.includes(p));

  if (hasRecruiting && !hasOnboarding) {
    return {
      suggestedAgent: "recruiting",
      reason: "Your message seems to be about hiring, recruiting, or finding candidates.",
    };
  }
  if (hasOnboarding && !hasRecruiting) {
    return {
      suggestedAgent: "onboarding",
      reason: "Your message seems to be about new hire onboarding, first day, or who to contact.",
    };
  }
  if (hasRecruiting && hasOnboarding) {
    return {
      suggestedAgent: "onboarding",
      reason: "Your message touches both recruiting and onboarding; suggesting Onboarding for new-hire focus.",
    };
  }
  if (hasLearningDevelopment) {
    return {
      suggestedAgent: "learning_development",
      reason: "Your message seems to be about learning, training, or career development.",
    };
  }

  return {
    suggestedAgent: "compliance",
    reason: "Your message is best handled by the Compliance agent (policies, regulations, audits).",
  };
}

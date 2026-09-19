/**
 * The seven Seeknimbly agents: four HR service agents plus three lifecycle
 * agents that run the business itself.
 */

import type { AgentDefinition } from "@/lib/agents/types";
import { AGENTS_META } from "@/lib/agents/meta";
import {
  recruitingPrompt,
  onboardingPrompt,
  trainingPrompt,
  compliancePrompt,
  leadGenPrompt,
  salesPrompt,
  clientOnboardingPrompt,
} from "@/lib/agents/prompts";
import { recruitingTools, onboardingTools, trainingTools, complianceTools } from "@/lib/agents/hr-tools";
import { leadGenTools, salesTools, clientOnboardingTools } from "@/lib/agents/lifecycle-tools";
import { memoryTools } from "@/lib/agents/memory-tools";

const IMPL: Record<string, Pick<AgentDefinition, "getSystemPrompt" | "tools">> = {
  recruiting: { getSystemPrompt: recruitingPrompt, tools: recruitingTools },
  onboarding: { getSystemPrompt: onboardingPrompt, tools: onboardingTools },
  training: { getSystemPrompt: trainingPrompt, tools: trainingTools },
  compliance: { getSystemPrompt: compliancePrompt, tools: complianceTools },
  lead_gen: { getSystemPrompt: leadGenPrompt, tools: leadGenTools },
  sales: { getSystemPrompt: salesPrompt, tools: salesTools },
  client_onboarding: { getSystemPrompt: clientOnboardingPrompt, tools: clientOnboardingTools },
};

export const AGENTS: AgentDefinition[] = AGENTS_META.map((meta) => {
  const impl = IMPL[meta.id];
  if (!impl) throw new Error(`No implementation registered for agent: ${meta.id}`);
  return { ...meta, ...impl, tools: [...impl.tools, ...memoryTools(meta.id)] };
});

export function getAgent(id: string): AgentDefinition | undefined {
  return AGENTS.find((a) => a.id === id);
}

export const AGENT_IDS = AGENTS.map((a) => a.id);

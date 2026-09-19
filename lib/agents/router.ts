/**
 * LLM-based intent router across all seven agents, with a keyword fallback
 * (no API key / LLM failure). The legacy 4-agent keyword router in
 * lib/chatRouter.ts is kept for backwards compatibility of /api/chat clients
 * that expect the original agent ids.
 */

import OpenAI from "openai";
import { getOpenAIApiKey, getOpenAIRouterModel } from "@/lib/openai";
import { AGENTS, AGENT_IDS } from "@/lib/agents/registry";

export type AgentRoute = {
  suggestedAgent: string;
  reason: string;
  method: "llm" | "keyword";
};

const KEYWORDS: Record<string, string[]> = {
  recruiting: ["hire", "recruit", "candidate", "job posting", "job description", "resume", "screen", "shortlist", "interview", "ats", "sourcing", "talent", "applicant"],
  onboarding: ["onboard", "new hire", "offer letter", "first day", "first week", "td1", "sin ", "i-9", "checklist", "30/60/90", "probation", "start date"],
  training: ["training", "learning", "l&d", "course", "certification", "upskill", "learning path", "whmis", "mentoring", "workshop", "development plan"],
  compliance: ["compliance", "audit", "esa", "overtime", "minimum wage", "cra", "remittance", "t4", "roe", "wsib", "worksafe", "pipeda", "law 25", "policy", "handbook", "soc2", "iso", "deadline", "filing", "regulation"],
  lead_gen: ["lead", "prospect", "outreach", "cold email", "icp", "pipeline fill", "channel partner", "accounting firm"],
  sales: ["proposal", "pricing", "objection", "discovery call", "deal", "negotiat", "close", "replied", "crm stage"],
  client_onboarding: ["client onboarding", "signed client", "kickoff", "intake", "provision", "day-1 snapshot", "closed won", "new client"],
};

export function keywordRoute(message: string): AgentRoute {
  const lower = message.toLowerCase();
  let best = "compliance";
  let bestHits = 0;
  for (const [agent, words] of Object.entries(KEYWORDS)) {
    const hits = words.filter((w) => lower.includes(w)).length;
    if (hits > bestHits) {
      best = agent;
      bestHits = hits;
    }
  }
  return {
    suggestedAgent: best,
    reason: bestHits > 0 ? `Keyword match for the ${best.replace("_", " ")} agent.` : "No clear match; defaulting to Compliance.",
    method: "keyword",
  };
}

export async function routeMessage(
  message: string,
  history: { role: string; content: string }[] = []
): Promise<AgentRoute> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) return keywordRoute(message);

  const catalog = AGENTS.map((a) => `- ${a.id}: ${a.description}`).join("\n");
  try {
    const openai = new OpenAI({ apiKey });
    const res = await openai.chat.completions.create({
      model: getOpenAIRouterModel("gpt-4o-mini"),
      messages: [
        {
          role: "system",
          content: `You route a user's message to one Seeknimbly agent. Agents:\n${catalog}\n\nThe first four are HR services for clients; the last three run Seeknimbly's own growth (only choose those when the user is acting as Seeknimbly's founder/operator on prospects, deals, or client accounts). Return strict JSON: {"agent":"<id>","reason":"<one sentence>"}.`,
        },
        {
          role: "user",
          content: `Recent history: ${JSON.stringify(history.slice(-6))}\n\nMessage: ${message}`,
        },
      ],
      max_completion_tokens: 120,
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}") as { agent?: string; reason?: string };
    if (parsed.agent && AGENT_IDS.includes(parsed.agent)) {
      return { suggestedAgent: parsed.agent, reason: parsed.reason ?? "Routed by LLM.", method: "llm" };
    }
  } catch (e) {
    console.warn("[agents/router] LLM routing failed, using keywords:", e);
  }
  return keywordRoute(message);
}

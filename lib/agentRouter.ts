/**
 * Agent router: choose general_hr_assistant | compliance_agent | policy_doc_agent | risk_controls_agent
 * using heuristics first, then optional LLM when uncertain.
 */

import OpenAI from "openai";
import { getOpenAIApiKey, getOpenAIModel } from "@/lib/openai";
import { getRouterPrompt } from "@/lib/prompts";

export type AgentId =
  | "general_hr_assistant"
  | "compliance_agent"
  | "policy_doc_agent"
  | "risk_controls_agent";

export type RouterResult = {
  agent: AgentId;
  reason?: string;
  required_questions?: string[];
};

const COMPLIANCE_KEYWORDS = [
  "compliance check",
  "audit",
  "soc2",
  "iso",
  "iso9001",
  "controls",
  "gap analysis",
  "policy review",
  "handbook",
  "employee handbook",
  "hr compliance",
  "legal",
  "risk register",
];

const POLICY_DOC_PHRASES = [
  "handbook say",
  "document say",
  "policy say",
  "what does our",
  "what does the handbook",
  "what does the doc",
  "what does the policy",
  "what does the document",
];

const RISK_CONTROLS_PHRASES = [
  "map to iso",
  "map to iso 9001",
  "soc2 controls",
  "iso 9001 controls",
  "controls mapping",
  "map this process to",
];

function matchAny(text: string, phrases: string[]): boolean {
  const lower = text.toLowerCase();
  return phrases.some((p) => lower.includes(p));
}

function heuristics(message: string, hasDocument: boolean): AgentId | null {
  if (!hasDocument) return "general_hr_assistant";
  const lower = message.toLowerCase();
  const hasComplianceKeyword = COMPLIANCE_KEYWORDS.some((k) => lower.includes(k));
  if (!hasComplianceKeyword) return null;
  if (matchAny(message, POLICY_DOC_PHRASES)) return "policy_doc_agent";
  if (matchAny(message, RISK_CONTROLS_PHRASES)) return "risk_controls_agent";
  return "compliance_agent";
}

async function llmRouter(
  message: string,
  history: { role: string; content: string }[],
  hasDocument: boolean
): Promise<RouterResult> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) return { agent: "general_hr_assistant", reason: "no-api-key" };
  const { systemPrompt, userPrompt } = getRouterPrompt(message, history, hasDocument);
  const openai = new OpenAI({ apiKey });
  const model = getOpenAIModel("gpt-4o");
  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: 256,
    });
    const content = response.choices?.[0]?.message?.content?.trim();
    if (!content) return { agent: "general_hr_assistant", reason: "empty-response" };
    const parsed = JSON.parse(content) as { agent?: string; reason?: string; required_questions?: string[] };
    const agent = parsed.agent as AgentId | undefined;
    if (
      agent === "general_hr_assistant" ||
      agent === "compliance_agent" ||
      agent === "policy_doc_agent" ||
      agent === "risk_controls_agent"
    ) {
      return {
        agent,
        reason: parsed.reason,
        required_questions: Array.isArray(parsed.required_questions) ? parsed.required_questions : undefined,
      };
    }
  } catch (e) {
    console.warn("[agentRouter] LLM router parse/request failed:", e);
  }
  return { agent: "general_hr_assistant", reason: "fallback" };
}

export async function chooseAgent(params: {
  message: string;
  history: { role: string; content: string }[];
  hasDocument: boolean;
}): Promise<RouterResult> {
  const { message, history, hasDocument } = params;
  const heuristic = heuristics(message, hasDocument);
  if (heuristic !== null) return { agent: heuristic };
  return llmRouter(message, history.slice(-10), hasDocument);
}

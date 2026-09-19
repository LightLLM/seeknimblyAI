import type OpenAI from "openai";

export type ToolHandler = (
  args: Record<string, unknown>,
  ctx: ToolContext
) => Promise<string>;

export type ToolContext = {
  openai?: OpenAI;
  model?: string;
  userEmail?: string;
  jurisdiction?: string;
  /** Tenant scope — store layer also stamps via AsyncLocalStorage. */
  orgId?: string;
};

export type AgentTool = {
  definition: OpenAI.Chat.Completions.ChatCompletionTool;
  handler: ToolHandler;
  /** If true, the runtime pauses and asks the user before executing. */
  requiresApproval?: boolean;
};

export type AgentDefinition = {
  id: string;
  label: string;
  description: string;
  /** Sample prompt shown in the chat empty state. */
  sample: string;
  getSystemPrompt: (ctx: { jurisdiction?: string }) => string;
  tools: AgentTool[];
};

export function toolByName(agent: AgentDefinition, name: string): AgentTool | undefined {
  return agent.tools.find((t) => t.definition.function.name === name);
}

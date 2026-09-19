/**
 * Normalize OPENAI_API_KEY for use in HTTP headers.
 * Strips whitespace, optional "Bearer " prefix, and any control characters
 * that would make the Authorization header value invalid (e.g. newlines from pasted env vars).
 */

function sanitizeModel(raw: string | undefined, fallback: string): string {
  const cleaned = (raw ?? "").trim().replace(/[\x00-\x1F\x7F]/g, "");
  return cleaned.length > 0 ? cleaned : fallback;
}

export function getOpenAIApiKey(): string | null {
  const raw = process.env.OPENAI_API_KEY;
  if (raw == null) return null;
  const trimmed = raw.trim().replace(/^Bearer\s+/i, "").trim();
  const sanitized = trimmed.replace(/[\x00-\x1F\x7F]/g, "");
  return sanitized.length > 0 ? sanitized : null;
}

/** Back-compat: OPENAI_MODEL, else default. Prefer getOpenAIAgentModel / getOpenAIRouterModel. */
export function getOpenAIModel(defaultModel: string): string {
  return sanitizeModel(process.env.OPENAI_MODEL, defaultModel);
}

/** Cheap/fast model for intent routing. */
export function getOpenAIRouterModel(defaultModel = "gpt-4o-mini"): string {
  return sanitizeModel(
    process.env.OPENAI_ROUTER_MODEL ?? process.env.OPENAI_MODEL,
    defaultModel
  );
}

/** Capability model for agent tool loops. */
export function getOpenAIAgentModel(defaultModel = "gpt-4o"): string {
  return sanitizeModel(
    process.env.OPENAI_AGENT_MODEL ?? process.env.OPENAI_MODEL,
    defaultModel
  );
}

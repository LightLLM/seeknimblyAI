/**
 * Normalize OPENAI_API_KEY for use in HTTP headers.
 * Strips whitespace, optional "Bearer " prefix, and any control characters
 * that would make the Authorization header value invalid (e.g. newlines from pasted env vars).
 */
export function getOpenAIApiKey(): string | null {
  const raw = process.env.OPENAI_API_KEY;
  if (raw == null) return null;
  const trimmed = raw.trim().replace(/^Bearer\s+/i, "").trim();
  const sanitized = trimmed.replace(/[\x00-\x1F\x7F]/g, "");
  return sanitized.length > 0 ? sanitized : null;
}

export function getOpenAIModel(defaultModel: string): string {
  const raw = (process.env.OPENAI_MODEL ?? defaultModel).trim().replace(/[\x00-\x1F\x7F]/g, "");
  return raw.length > 0 ? raw : defaultModel;
}

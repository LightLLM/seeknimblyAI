/**
 * Per-org LLM provider allowlist — keeps customer chat off disallowed vendors
 * (e.g. OpenAI) when the workspace opts into OpenRouter / local only.
 *
 * null / unset on the org = all configured providers allowed.
 * Non-empty array = only those providers may be used for that org.
 */

import { getRow, updateRow } from "@/lib/store";
import type { ModelProvider } from "@/lib/models";

export const LLM_PROVIDER_IDS: ModelProvider[] = [
  "openai",
  "anthropic",
  "google",
  "xai",
  "openrouter",
  "ollama",
  "huggingface",
];

export const LLM_PROVIDER_LABELS: Record<ModelProvider, string> = {
  openai: "OpenAI (ChatGPT)",
  anthropic: "Anthropic (Claude)",
  google: "Google (Gemini)",
  xai: "xAI (Grok)",
  openrouter: "OpenRouter",
  ollama: "Ollama (local)",
  huggingface: "Hugging Face",
};

const PROVIDER_SET = new Set<string>(LLM_PROVIDER_IDS);

export function isModelProvider(value: string): value is ModelProvider {
  return PROVIDER_SET.has(value);
}

/** Parse DB/JSON value → allowlist, or null meaning “all allowed”. */
export function parseAllowedProviders(raw: unknown): ModelProvider[] | null {
  if (raw == null || raw === "") return null;
  let arr: unknown[];
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw) as unknown[];
    } catch {
      return null;
    }
  } else if (Array.isArray(raw)) {
    arr = raw;
  } else {
    return null;
  }
  const out = arr.map(String).filter(isModelProvider);
  return out;
}

export function applyProviderAllowlist<T extends Record<string, boolean>>(
  avail: T,
  allowed: ModelProvider[] | null | undefined
): T {
  if (allowed == null) return avail;
  const next = { ...avail };
  for (const p of LLM_PROVIDER_IDS) {
    if (p in next && !allowed.includes(p)) {
      (next as Record<string, boolean>)[p] = false;
    }
  }
  return next;
}

export function isProviderAllowed(
  provider: ModelProvider,
  allowed: ModelProvider[] | null | undefined
): boolean {
  if (allowed == null) return true;
  return allowed.includes(provider);
}

export async function getOrgAllowedProviders(orgId: string): Promise<ModelProvider[] | null> {
  const org = await getRow("orgs", orgId);
  return parseAllowedProviders(org?.allowed_llm_providers);
}

export async function setOrgAllowedProviders(
  orgId: string,
  providers: ModelProvider[] | null
): Promise<ModelProvider[] | null> {
  const normalized =
    providers == null
      ? null
      : Array.from(new Set(providers.filter(isModelProvider)));
  await updateRow("orgs", orgId, {
    allowed_llm_providers: normalized,
  });
  return normalized;
}

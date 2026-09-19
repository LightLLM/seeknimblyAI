/**
 * Chat model catalog — client-safe ids/labels. Server resolves keys in lib/llm.ts.
 */

export type ModelProvider = "openai" | "anthropic" | "google" | "xai";

export type ChatModelOption = {
  id: string;
  label: string;
  provider: ModelProvider | "auto";
  /** Vendor model id sent to the API (empty for auto). */
  apiModel: string;
  description: string;
};

export const CHAT_MODEL_OPTIONS: ChatModelOption[] = [
  {
    id: "auto",
    label: "Auto",
    provider: "auto",
    apiModel: "",
    description: "Best available model for agent tool loops",
  },
  {
    id: "openai:gpt-4o",
    label: "ChatGPT · GPT-4o",
    provider: "openai",
    apiModel: "gpt-4o",
    description: "OpenAI flagship",
  },
  {
    id: "openai:gpt-4o-mini",
    label: "ChatGPT · GPT-4o mini",
    provider: "openai",
    apiModel: "gpt-4o-mini",
    description: "OpenAI fast / cheaper",
  },
  {
    id: "anthropic:claude-sonnet-4-5",
    label: "Claude · Sonnet",
    provider: "anthropic",
    apiModel: "claude-sonnet-4-5",
    description: "Anthropic Claude",
  },
  {
    id: "google:gemini-2.5-flash",
    label: "Gemini · 2.5 Flash",
    provider: "google",
    apiModel: "gemini-2.5-flash",
    description: "Google Gemini",
  },
  {
    id: "xai:grok-3",
    label: "Grok · 3",
    provider: "xai",
    apiModel: "grok-3",
    description: "xAI Grok",
  },
];

export const DEFAULT_CHAT_MODEL_ID = "auto";

export function getChatModelOption(id: string | null | undefined): ChatModelOption {
  const found = CHAT_MODEL_OPTIONS.find((m) => m.id === id);
  return found ?? CHAT_MODEL_OPTIONS[0];
}

export function isChatModelId(id: string): boolean {
  return CHAT_MODEL_OPTIONS.some((m) => m.id === id);
}

const STORAGE_KEY = "seeknimbly_chat_model";

export function loadChatModelPreference(): string {
  if (typeof window === "undefined") return DEFAULT_CHAT_MODEL_ID;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && isChatModelId(v)) return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_CHAT_MODEL_ID;
}

export function saveChatModelPreference(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, isChatModelId(id) ? id : DEFAULT_CHAT_MODEL_ID);
  } catch {
    /* ignore */
  }
}

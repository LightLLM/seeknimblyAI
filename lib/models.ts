/**
 * Chat model catalog — client-safe ids/labels. Server resolves keys in lib/llm.ts.
 */

export type ModelProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "xai"
  | "openrouter"
  | "ollama"
  | "huggingface";

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
  {
    id: "openrouter:auto",
    label: "OpenRouter · Auto",
    provider: "openrouter",
    apiModel: "openrouter/auto",
    description: "OpenRouter routes to a capable model",
  },
  {
    id: "openrouter:llama-3.3-70b",
    label: "OpenRouter · Llama 3.3 70B",
    provider: "openrouter",
    apiModel: "meta-llama/llama-3.3-70b-instruct",
    description: "Via OpenRouter",
  },
  {
    id: "ollama:llama3.2",
    label: "Ollama · Llama 3.2",
    provider: "ollama",
    apiModel: "llama3.2",
    description: "Local Ollama (OLLAMA_BASE_URL)",
  },
  {
    id: "ollama:qwen2.5",
    label: "Ollama · Qwen 2.5",
    provider: "ollama",
    apiModel: "qwen2.5",
    description: "Local Ollama",
  },
  {
    id: "huggingface:llama-3.1-8b",
    label: "Hugging Face · Llama 3.1 8B",
    provider: "huggingface",
    apiModel: "meta-llama/Meta-Llama-3.1-8B-Instruct",
    description: "HF Inference (OpenAI-compatible router)",
  },
  {
    id: "huggingface:qwen2.5-7b",
    label: "Hugging Face · Qwen 2.5 7B",
    provider: "huggingface",
    apiModel: "Qwen/Qwen2.5-7B-Instruct",
    description: "HF Inference",
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

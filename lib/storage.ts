/**
 * localStorage helpers for chat transcript persistence.
 * Only use in client components (typeof window !== 'undefined').
 */

const STORAGE_KEY = "seeknimbly_hr_chat";

export type AgentStep = {
  id: string;
  label: string;
  status: "active" | "done";
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  /** Shown when assistant used multi-step reasoning (e.g. web search) */
  steps?: AgentStep[];
};

export function getStoredTranscript(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((m): m is ChatMessage => {
      if (typeof m !== "object" || m === null) return false;
      const r = (m as ChatMessage).role;
      const c = (m as ChatMessage).content;
      if (r !== "user" && r !== "assistant") return false;
      if (typeof c !== "string") return false;
      const steps = (m as ChatMessage).steps;
      if (steps !== undefined && (!Array.isArray(steps) || steps.some((s) => typeof s?.id !== "string" || typeof s?.label !== "string"))) return false;
      return true;
    });
  } catch {
    return [];
  }
}

export function setStoredTranscript(messages: ChatMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // ignore quota or other storage errors
  }
}

export function clearStoredTranscript(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

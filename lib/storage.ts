/**
 * localStorage helpers for chat transcript and multi-conversation persistence.
 * Only use in client components (typeof window !== 'undefined').
 */

const OLD_STORAGE_KEY = "seeknimbly_hr_chat";
const CHATS_STORAGE_KEY = "seeknimbly_hr_chats";

export type AgentStep = {
  id: string;
  label: string;
  status: "active" | "done";
};

export type ChatAgentTag = "recruiting" | "compliance" | "onboarding" | "learning_development";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  /** Shown when assistant used multi-step reasoning (e.g. web search) */
  steps?: AgentStep[];
  /** For user messages: display names of attached files (file_id not persisted long-term) */
  attachments?: { name: string; fileId?: string }[];
  /** Which agent answered (unified chat) */
  agent?: ChatAgentTag;
};

export type Chat = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt?: number;
};

export type ChatsState = {
  chats: Chat[];
  activeId: string | null;
};

function generateId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function parseChatMessage(m: unknown): ChatMessage | null {
  if (typeof m !== "object" || m === null) return null;
  const r = (m as ChatMessage).role;
  const c = (m as ChatMessage).content;
  if (r !== "user" && r !== "assistant") return null;
  if (typeof c !== "string") return null;
  const steps = (m as ChatMessage).steps;
  if (steps !== undefined && (!Array.isArray(steps) || steps.some((s) => typeof s?.id !== "string" || typeof s?.label !== "string"))) return null;
  const attachments = (m as ChatMessage).attachments;
  if (attachments !== undefined && (!Array.isArray(attachments) || attachments.some((a) => typeof a?.name !== "string"))) return null;
  const agent = (m as ChatMessage).agent;
  if (agent !== undefined && !["recruiting", "compliance", "onboarding", "learning_development"].includes(agent)) return null;
  return m as ChatMessage;
}

function loadRaw(): ChatsState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CHATS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const { chats, activeId } = parsed as { chats?: unknown; activeId?: unknown };
    if (!Array.isArray(chats)) return null;
    const validChats: Chat[] = chats.filter((c): c is Chat => {
      if (typeof c !== "object" || c === null) return false;
      if (typeof (c as Chat).id !== "string" || typeof (c as Chat).title !== "string") return false;
      if (!Array.isArray((c as Chat).messages)) return false;
      if (typeof (c as Chat).createdAt !== "number") return false;
      (c as Chat).messages = (c as Chat).messages.filter((m): m is ChatMessage => parseChatMessage(m) !== null) as ChatMessage[];
      return true;
    });
    const id = activeId === null || activeId === undefined ? null : typeof activeId === "string" ? activeId : null;
    return { chats: validChats, activeId: id };
  } catch {
    return null;
  }
}

function saveRaw(state: ChatsState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

/** Migrate from old single-transcript key into one chat and set active. */
function migrateFromLegacy(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(OLD_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return false;
    const messages = parsed.filter((m): m is ChatMessage => parseChatMessage(m) !== null) as ChatMessage[];
    if (messages.length === 0) return false;
    const id = generateId();
    const firstUser = messages.find((m) => m.role === "user");
    const title = firstUser ? firstUser.content.slice(0, 40).trim() || "New chat" : "New chat";
    const chat: Chat = { id, title, messages, createdAt: Date.now(), updatedAt: Date.now() };
    const state: ChatsState = { chats: [chat], activeId: id };
    saveRaw(state);
    localStorage.removeItem(OLD_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function getChatList(): Chat[] {
  let state = loadRaw();
  if (!state) {
    if (migrateFromLegacy()) state = loadRaw();
    if (!state) return [];
  }
  return state.chats.slice().sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
}

export function getActiveChatId(): string | null {
  let state = loadRaw();
  if (!state) {
    if (migrateFromLegacy()) state = loadRaw();
    if (!state) return null;
  }
  return state.activeId;
}

export function getChat(id: string): Chat | null {
  const state = loadRaw();
  if (!state) return null;
  return state.chats.find((c) => c.id === id) ?? null;
}

export function setChat(id: string, payload: Partial<Omit<Chat, "id">>): void {
  const state = loadRaw();
  if (!state) {
    const chats: Chat[] = [];
    const existing = payload as Partial<Chat>;
    const chat: Chat = {
      id,
      title: existing.title ?? "New chat",
      messages: existing.messages ?? [],
      createdAt: existing.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    saveRaw({ chats: [chat], activeId: id });
    return;
  }
  const idx = state.chats.findIndex((c) => c.id === id);
  const now = Date.now();
  if (idx >= 0) {
    state.chats[idx] = { ...state.chats[idx], ...payload, id, updatedAt: now };
  } else {
    state.chats.push({
      id,
      title: (payload.title as string) ?? "New chat",
      messages: (payload.messages as ChatMessage[]) ?? [],
      createdAt: (payload.createdAt as number) ?? now,
      updatedAt: now,
    });
  }
  saveRaw(state);
}

export function createChat(): string {
  const id = generateId();
  const state = loadRaw();
  const chat: Chat = { id, title: "New chat", messages: [], createdAt: Date.now() };
  if (state) {
    state.chats.unshift(chat);
    state.activeId = id;
    saveRaw(state);
  } else {
    saveRaw({ chats: [chat], activeId: id });
  }
  return id;
}

export function deleteChat(id: string): void {
  const state = loadRaw();
  if (!state) return;
  state.chats = state.chats.filter((c) => c.id !== id);
  if (state.activeId === id) state.activeId = state.chats[0]?.id ?? null;
  saveRaw(state);
}

export function setActiveChatId(id: string | null): void {
  const state = loadRaw();
  if (!state) {
    if (id) {
      const chat = getChat(id);
      if (chat) saveRaw({ chats: [chat], activeId: id });
    }
    return;
  }
  state.activeId = id;
  saveRaw(state);
}

// Legacy helpers: map to active chat for backward compatibility
export function getStoredTranscript(): ChatMessage[] {
  const activeId = getActiveChatId();
  if (!activeId) return [];
  const chat = getChat(activeId);
  return chat?.messages ?? [];
}

export function setStoredTranscript(messages: ChatMessage[]): void {
  const activeId = getActiveChatId();
  if (activeId) {
    setChat(activeId, { messages, updatedAt: Date.now() });
    return;
  }
  const id = createChat();
  setChat(id, { messages, title: messages.length ? (messages.find((m) => m.role === "user")?.content.slice(0, 40).trim() || "New chat") : "New chat", updatedAt: Date.now() });
  setActiveChatId(id);
}

export function clearStoredTranscript(): void {
  const activeId = getActiveChatId();
  if (activeId) setChat(activeId, { messages: [], updatedAt: Date.now() });
}

// --- New hire onboarding checklist (localStorage) ---
const ONBOARDING_STORAGE_KEY = "seeknimbly_onboarding_checklist";

export type OnboardingItem = {
  id: string;
  label: string;
  done: boolean;
  order: number;
};

const DEFAULT_ONBOARDING_ITEMS: OnboardingItem[] = [
  { id: "forms", label: "Complete employment forms (I-9 / tax, direct deposit)", done: false, order: 1 },
  { id: "handbook", label: "Review employee handbook and policies", done: false, order: 2 },
  { id: "equipment", label: "Set up equipment and accounts (laptop, email, access)", done: false, order: 3 },
  { id: "manager", label: "Meet with manager and team introductions", done: false, order: 4 },
  { id: "training", label: "Complete required training (safety, compliance, systems)", done: false, order: 5 },
  { id: "benefits", label: "Enroll in benefits (if applicable)", done: false, order: 6 },
  { id: "hr-contact", label: "Save HR and IT contact info", done: false, order: 7 },
];

function loadOnboardingRaw(): OnboardingItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return DEFAULT_ONBOARDING_ITEMS.map((i) => ({ ...i }));
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_ONBOARDING_ITEMS.map((i) => ({ ...i }));
    const byId = new Map(DEFAULT_ONBOARDING_ITEMS.map((i) => [i.id, { ...i }]));
    for (const item of parsed) {
      if (item && typeof item === "object" && typeof (item as OnboardingItem).id === "string") {
        const existing = byId.get((item as OnboardingItem).id) ?? { id: (item as OnboardingItem).id, label: (item as OnboardingItem).label || "", done: false, order: (item as OnboardingItem).order ?? 99 };
        byId.set((item as OnboardingItem).id, { ...existing, done: Boolean((item as OnboardingItem).done) });
      }
    }
    return Array.from(byId.values()).sort((a, b) => a.order - b.order);
  } catch {
    return DEFAULT_ONBOARDING_ITEMS.map((i) => ({ ...i }));
  }
}

function saveOnboardingRaw(items: OnboardingItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function getOnboardingChecklist(): OnboardingItem[] {
  return loadOnboardingRaw();
}

export function setOnboardingItemDone(id: string, done: boolean): void {
  const items = loadOnboardingRaw();
  const idx = items.findIndex((i) => i.id === id);
  if (idx >= 0) {
    items[idx] = { ...items[idx], done };
    saveOnboardingRaw(items);
  }
}

export function resetOnboardingChecklist(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  } catch {
    // ignore
  }
}

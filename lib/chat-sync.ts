/**
 * Client-side sync between localStorage chats and /api/conversations.
 * Pull on load (newer updatedAt wins); push the active chat after each turn
 * (debounced, fire-and-forget). Offline or signed-out fails silently —
 * localStorage remains the source for the current device.
 */

import { getChatList, getChat, setChat, type Chat } from "@/lib/storage";

type ServerConversation = {
  id: string;
  title: string;
  pinned?: boolean;
  messages: unknown[];
  created_at?: string;
  updated_at?: string;
};

/** Merge server conversations into localStorage. Returns true if anything changed. */
export async function pullConversations(): Promise<boolean> {
  try {
    const res = await fetch("/api/conversations");
    if (!res.ok) return false;
    const data = (await res.json()) as { conversations: ServerConversation[] };
    let changed = false;
    for (const sc of data.conversations ?? []) {
      const serverUpdated = sc.updated_at ? new Date(sc.updated_at).getTime() : 0;
      const local = getChat(sc.id);
      const localUpdated = local?.updatedAt ?? local?.createdAt ?? 0;
      if (!local || serverUpdated > localUpdated) {
        setChat(sc.id, {
          title: sc.title,
          pinned: Boolean(sc.pinned),
          messages: (sc.messages ?? []) as Chat["messages"],
          createdAt: sc.created_at ? new Date(sc.created_at).getTime() : local?.createdAt ?? Date.now(),
          updatedAt: serverUpdated || Date.now(),
        });
        changed = true;
      }
    }
    return changed;
  } catch {
    return false;
  }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced push of one chat to the server. */
export function pushConversation(id: string, delayMs = 1500): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    const chat = getChat(id);
    if (!chat || chat.messages.length === 0) return;
    fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: chat.id,
        title: chat.title,
        messages: chat.messages,
        pinned: Boolean(chat.pinned),
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt ?? Date.now(),
      }),
    }).catch(() => {
      // offline / signed out — localStorage still has it
    });
  }, delayMs);
}

/** Push every local chat once (e.g. first sign-in on a device with history). */
export async function pushAllConversations(): Promise<void> {
  for (const chat of getChatList()) {
    if (chat.messages.length === 0) continue;
    try {
      await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: chat.id,
          title: chat.title,
          messages: chat.messages,
          pinned: Boolean(chat.pinned),
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt ?? chat.createdAt,
        }),
      });
    } catch {
      return; // offline — stop quietly
    }
  }
}

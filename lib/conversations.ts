/**
 * Server-side conversation persistence. Chats are stored per user (email) so
 * sessions survive devices and browser clears. localStorage remains the fast
 * local cache; the client syncs through /api/conversations.
 */

import { insertRow, updateRow, listRows, getRow, type Row } from "@/lib/store";

export type ConversationPayload = {
  id: string;
  title: string;
  messages: unknown[];
  pinned?: boolean;
  createdAt?: number;
  updatedAt?: number;
};

const MAX_MESSAGES = 200;
const MAX_CONVERSATIONS = 100;

export async function listConversations(email: string): Promise<Row[]> {
  return listRows("conversations", {
    filters: { user_email: email },
    limit: MAX_CONVERSATIONS,
    orderBy: "updated_at",
    ascending: false,
  });
}

export async function upsertConversation(email: string, chat: ConversationPayload): Promise<Row> {
  const messages = Array.isArray(chat.messages) ? chat.messages.slice(-MAX_MESSAGES) : [];
  const existing = await getRow("conversations", chat.id);
  if (existing) {
    if (existing.user_email !== email) {
      throw new Error("Conversation belongs to another user.");
    }
    const updated = await updateRow("conversations", chat.id, {
      title: chat.title.slice(0, 120),
      pinned: Boolean(chat.pinned),
      messages,
      updated_at: new Date(chat.updatedAt ?? Date.now()).toISOString(),
    });
    return updated as Row;
  }
  return insertRow("conversations", {
    id: chat.id,
    user_email: email,
    title: chat.title.slice(0, 120),
    pinned: Boolean(chat.pinned),
    messages,
    created_at: new Date(chat.createdAt ?? Date.now()).toISOString(),
    updated_at: new Date(chat.updatedAt ?? Date.now()).toISOString(),
  });
}

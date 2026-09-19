/**
 * Server-side conversation persistence: upsert semantics, per-user scoping,
 * message capping, ordering.
 */

import { listConversations, upsertConversation } from "@/lib/conversations";
import { clearMemoryStore } from "@/lib/store";

beforeEach(() => {
  clearMemoryStore();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

const chat = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  title: "Hiring in Ontario",
  messages: [
    { role: "user", content: "hire a cook" },
    { role: "assistant", content: "On it." },
  ],
  ...over,
});

describe("conversation persistence", () => {
  it("inserts then updates the same id", async () => {
    await upsertConversation("nisar@seeknimbly.ai", chat("chat_1"));
    let rows = await listConversations("nisar@seeknimbly.ai");
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Hiring in Ontario");

    await upsertConversation("nisar@seeknimbly.ai", chat("chat_1", { title: "Renamed", pinned: true }));
    rows = await listConversations("nisar@seeknimbly.ai");
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Renamed");
    expect(rows[0].pinned).toBe(true);
  });

  it("scopes lists per user and refuses cross-user writes", async () => {
    await upsertConversation("a@x.com", chat("chat_a"));
    await upsertConversation("b@x.com", chat("chat_b"));
    expect(await listConversations("a@x.com")).toHaveLength(1);
    expect(await listConversations("b@x.com")).toHaveLength(1);
    await expect(upsertConversation("b@x.com", chat("chat_a", { title: "hijack" }))).rejects.toThrow(/another user/);
    const rows = await listConversations("a@x.com");
    expect(rows[0].title).toBe("Hiring in Ontario");
  });

  it("caps stored messages and truncates long titles", async () => {
    const many = Array.from({ length: 300 }, (_, i) => ({ role: "user", content: `m${i}` }));
    await upsertConversation("a@x.com", chat("chat_big", { messages: many, title: "t".repeat(300) }));
    const rows = await listConversations("a@x.com");
    expect((rows[0].messages as unknown[]).length).toBe(200);
    expect(String(rows[0].title).length).toBeLessThanOrEqual(120);
    const kept = rows[0].messages as { content: string }[];
    expect(kept[kept.length - 1].content).toBe("m299");
  });

  it("orders by most recently updated", async () => {
    await upsertConversation("a@x.com", chat("chat_old", { updatedAt: Date.now() - 100000 }));
    await upsertConversation("a@x.com", chat("chat_new", { updatedAt: Date.now() }));
    const rows = await listConversations("a@x.com");
    expect(rows[0].id).toBe("chat_new");
  });
});

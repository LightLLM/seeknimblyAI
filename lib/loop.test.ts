/**
 * Tests for the Loop Engineering components:
 * Automations (registry integrity, runner guards), Memory (save/recall wired
 * into every sub-agent, roundtrip), Sub-agents + Skills (registry), and the
 * disabled-state guard for cron runs.
 */

import { AUTOMATIONS, getAutomation } from "@/lib/automations";
import { runAutomation, isAutomationEnabled, setAutomationEnabled } from "@/lib/automations-runner";
import { AGENTS, getAgent, AGENT_IDS } from "@/lib/agents/registry";
import { MEMORY_KINDS } from "@/lib/agents/memory-tools";
import { toolByName } from "@/lib/agents/types";
import { clearMemoryStore, listRows } from "@/lib/store";

beforeEach(() => {
  clearMemoryStore();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.OPENAI_API_KEY;
});

describe("Loop: Automations registry", () => {
  it("defines automations with unique ids and valid 5-field cron expressions", () => {
    expect(AUTOMATIONS.length).toBeGreaterThanOrEqual(5);
    const ids = AUTOMATIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of AUTOMATIONS) {
      expect(a.cron.trim().split(/\s+/)).toHaveLength(5);
      expect(a.prompt.length).toBeGreaterThan(40);
    }
  });

  it("every automation references a registered sub-agent", () => {
    for (const a of AUTOMATIONS) {
      expect(AGENT_IDS).toContain(a.agent);
    }
  });

  it("getAutomation resolves ids and rejects unknowns", () => {
    expect(getAutomation("law-change-monitor")?.agent).toBe("compliance");
    expect(getAutomation("nope")).toBeUndefined();
  });
});

describe("Loop: Automations runner guards", () => {
  it("automations are disabled by default and refuse cron runs", async () => {
    expect(await isAutomationEnabled("law-change-monitor")).toBe(false);
    const res = await runAutomation("law-change-monitor");
    expect(res.status).toBe("disabled");
    expect(res.ok).toBe(false);
  });

  it("toggling enabled persists and forced runs fail safely without an API key", async () => {
    await setAutomationEnabled("lead-gen-daily", true);
    expect(await isAutomationEnabled("lead-gen-daily")).toBe(true);
    await setAutomationEnabled("lead-gen-daily", false);
    expect(await isAutomationEnabled("lead-gen-daily")).toBe(false);

    const res = await runAutomation("lead-gen-daily", { force: true });
    expect(res.status).toBe("no_api_key");
  });

  it("unknown automation ids error cleanly", async () => {
    const res = await runAutomation("does-not-exist", { force: true });
    expect(res.status).toBe("error");
  });
});

describe("Loop: Memory wired into every sub-agent", () => {
  it("all agents expose save_memory and recall_memories", () => {
    for (const agent of AGENTS) {
      expect(toolByName(agent, "save_memory")).toBeDefined();
      expect(toolByName(agent, "recall_memories")).toBeDefined();
    }
  });

  it("save → recall roundtrip with kind filter and keyword search", async () => {
    const sales = getAgent("sales")!;
    const save = toolByName(sales, "save_memory")!;
    const recall = toolByName(sales, "recall_memories")!;

    const saved = JSON.parse(
      await save.handler({ kind: "objection", content: "Price objection: anchor against fractional HR at $4-8K/mo.", subject: "pricing" }, {})
    );
    expect(saved.ok).toBe(true);
    await save.handler({ kind: "outcome", content: "Tuesday morning outreach got replies.", subject: "outreach timing" }, {});

    const byKind = JSON.parse(await recall.handler({ kind: "objection" }, {}));
    expect(byKind.count).toBe(1);
    expect(byKind.memories[0].content).toMatch(/fractional HR/);

    const byQuery = JSON.parse(await recall.handler({ query: "tuesday" }, {}));
    expect(byQuery.count).toBe(1);

    const rows = await listRows("memories", {});
    expect(rows).toHaveLength(2);
  });

  it("invalid kinds fall back to 'learning'", async () => {
    const rec = getAgent("recruiting")!;
    const save = toolByName(rec, "save_memory")!;
    const res = JSON.parse(await save.handler({ kind: "bogus", content: "x" }, {}));
    expect(res.ok).toBe(true);
    const rows = await listRows("memories", { filters: { kind: "learning" } });
    expect(rows).toHaveLength(1);
    expect(MEMORY_KINDS).not.toContain("bogus");
  });
});

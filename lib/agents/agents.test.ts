/**
 * Tests for the agent platform core: registry integrity, hard-rule enforcement
 * (draft-never-send via outbox), keyword routing fallback, and the in-memory
 * store used when Supabase is not configured.
 */

import { AGENTS, getAgent, AGENT_IDS } from "@/lib/agents/registry";
import { AGENTS_META, agentLabel } from "@/lib/agents/meta";
import { keywordRoute } from "@/lib/agents/router";
import { clearMemoryStore, insertRow, listRows, updateRow, getRow, isSupabaseConfigured } from "@/lib/store";
import { logAudit, listAudit } from "@/lib/audit";
import { HARD_RULES } from "@/lib/agents/prompts";

beforeEach(() => {
  clearMemoryStore();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe("registry", () => {
  it("registers all seven agents matching client-safe metadata", () => {
    expect(AGENTS).toHaveLength(7);
    expect(AGENT_IDS).toEqual(AGENTS_META.map((m) => m.id));
    expect(AGENT_IDS).toEqual(
      expect.arrayContaining(["recruiting", "onboarding", "training", "compliance", "lead_gen", "sales", "client_onboarding"])
    );
  });

  it("every agent has tools with unique names and a system prompt embedding the hard rules", () => {
    for (const agent of AGENTS) {
      expect(agent.tools.length).toBeGreaterThan(0);
      const names = agent.tools.map((t) => t.definition.function.name);
      expect(new Set(names).size).toBe(names.length);
      const prompt = agent.getSystemPrompt({ jurisdiction: "CA" });
      expect(prompt).toContain("HARD RULES");
      expect(prompt.length).toBeGreaterThan(200);
    }
    expect(HARD_RULES).toContain("Never send external communications");
  });

  it("state-mutating tools require approval", () => {
    const recruiting = getAgent("recruiting")!;
    const ats = recruiting.tools.find((t) => t.definition.function.name === "update_ats");
    expect(ats?.requiresApproval).toBe(true);
    const sales = getAgent("sales")!;
    const stage = sales.tools.find((t) => t.definition.function.name === "update_lead_stage");
    expect(stage?.requiresApproval).toBe(true);
  });

  it("getAgent returns undefined for unknown ids", () => {
    expect(getAgent("nonexistent")).toBeUndefined();
  });

  it("agentLabel resolves current and legacy tags", () => {
    expect(agentLabel("training")).toBe("Training & Development");
    expect(agentLabel("learning_development")).toBe("Learning & Development");
  });
});

describe("draft-never-send (outbox enforcement)", () => {
  it("draft_outreach creates a pending outbox draft instead of sending", async () => {
    const leadGen = getAgent("lead_gen")!;
    const draft = leadGen.tools.find((t) => t.definition.function.name === "draft_outreach")!;
    const result = JSON.parse(
      await draft.handler({ channel: "email", recipient: "owner@smb.ca", subject: "Hi", body: "Test body" }, {})
    );
    expect(result.ok).toBe(true);
    expect(result.status).toBe("pending_approval");

    const drafts = await listRows("outbox_drafts", { filters: { status: "pending" } });
    expect(drafts).toHaveLength(1);
    expect(drafts[0].body).toBe("Test body");

    const audit = await listAudit();
    expect(audit.some((a) => String(a.action).startsWith("draft_created"))).toBe(true);
  });

  it("offer letters and change briefs also route through the outbox", async () => {
    const onboarding = getAgent("onboarding")!;
    const offer = onboarding.tools.find((t) => t.definition.function.name === "draft_offer_letter")!;
    await offer.handler({ hire_name: "Maya", role: "Cook", body: "Offer text" }, {});
    const compliance = getAgent("compliance")!;
    const brief = compliance.tools.find((t) => t.definition.function.name === "draft_change_brief")!;
    await brief.handler({ title: "ON min wage", body: "Brief", source_url: "https://www.ontario.ca/page/minimum-wage" }, {});
    const drafts = await listRows("outbox_drafts", {});
    expect(drafts.length).toBe(2);
    expect(drafts.every((d) => d.status === "pending")).toBe(true);
  });

  it("draft_change_brief rejects non-official source URLs", async () => {
    const compliance = getAgent("compliance")!;
    const brief = compliance.tools.find((t) => t.definition.function.name === "draft_change_brief")!;
    const bad = JSON.parse(await brief.handler({ title: "x", body: "y", source_url: "https://example.com/blog" }, {}));
    expect(bad.ok).toBe(false);
    expect(bad.error).toMatch(/official/i);
  });

  it("compliance agent exposes web_search before drafting briefs", () => {
    const compliance = getAgent("compliance")!;
    expect(compliance.tools.some((t) => t.definition.function.name === "web_search")).toBe(true);
  });
});

describe("business rules in tools", () => {
  it("update_lead_stage refuses to close without a won/lost reason", async () => {
    const lead = await insertRow("leads", { company: "Acme", stage: "negotiating", touch_count: 0 });
    const sales = getAgent("sales")!;
    const stage = sales.tools.find((t) => t.definition.function.name === "update_lead_stage")!;
    const res = JSON.parse(await stage.handler({ lead_id: lead.id, stage: "closed_won" }, {}));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/won_lost_reason/);
  });

  it("add_lead rejects duplicates", async () => {
    const leadGen = getAgent("lead_gen")!;
    const add = leadGen.tools.find((t) => t.definition.function.name === "add_lead")!;
    const first = JSON.parse(await add.handler({ company: "Acme" }, {}));
    expect(first.ok).toBe(true);
    const second = JSON.parse(await add.handler({ company: "Acme" }, {}));
    expect(second.duplicate).toBe(true);
  });

  it("create_hire seeds the statutory checklist for the province", async () => {
    const onboarding = getAgent("onboarding")!;
    const create = onboarding.tools.find((t) => t.definition.function.name === "create_hire")!;
    const res = JSON.parse(await create.handler({ name: "Maya Chen", province: "ON", start_date: "2026-08-04" }, {}));
    expect(res.ok).toBe(true);
    const tasks = await listRows("onboarding_tasks", { filters: { hire_id: res.hire_id } });
    expect(tasks.length).toBeGreaterThanOrEqual(9);
    expect(tasks.some((t) => String(t.title).includes("Health & Safety"))).toBe(true);
  });
});

describe("keyword router fallback", () => {
  it("routes obvious intents to the right agents", () => {
    expect(keywordRoute("Draft a job posting and screen these resumes").suggestedAgent).toBe("recruiting");
    expect(keywordRoute("Set up the offer letter and first day checklist for our new hire").suggestedAgent).toBe("onboarding");
    expect(keywordRoute("What WHMIS training and certification do we need?").suggestedAgent).toBe("training");
    expect(keywordRoute("Are we compliant with ESA overtime rules?").suggestedAgent).toBe("compliance");
    expect(keywordRoute("Find new prospects and draft cold email outreach").suggestedAgent).toBe("lead_gen");
    expect(keywordRoute("They asked for a proposal with pricing").suggestedAgent).toBe("sales");
    expect(keywordRoute("The signed client needs kickoff and intake").suggestedAgent).toBe("client_onboarding");
  });

  it("defaults to compliance when nothing matches", () => {
    const route = keywordRoute("hello there");
    expect(route.suggestedAgent).toBe("compliance");
    expect(route.method).toBe("keyword");
  });
});

describe("in-memory store fallback", () => {
  it("reports Supabase as unconfigured and does CRUD in memory", async () => {
    expect(isSupabaseConfigured()).toBe(false);
    const row = await insertRow("clients", { legal_name: "Acme Ltd", status: "onboarding" });
    expect(row.id).toBeTruthy();
    const fetched = await getRow("clients", String(row.id));
    expect(fetched?.legal_name).toBe("Acme Ltd");
    await updateRow("clients", String(row.id), { status: "live" });
    const list = await listRows("clients", { filters: { status: "live" } });
    expect(list).toHaveLength(1);
  });

  it("audit log survives write and is listed most recent first", async () => {
    await logAudit({ agent: "compliance", action: "first" });
    await new Promise((r) => setTimeout(r, 5));
    await logAudit({ agent: "compliance", action: "second" });
    const entries = await listAudit();
    expect(entries).toHaveLength(2);
    expect(entries[0].action).toBe("second");
  });
});

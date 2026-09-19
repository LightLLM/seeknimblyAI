import { clearMemoryStore, insertRow, runWithStoreContext } from "@/lib/store";
import { listPartnerPortfolio } from "@/lib/partners";
import { runDataRetention } from "@/lib/retention";
import { getStripePriceId, annualPlanAvailable } from "@/lib/stripe";

beforeEach(() => {
  clearMemoryStore();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.STRIPE_PRICE_ID;
  delete process.env.STRIPE_PRICE_ID_ANNUAL;
});

describe("channel partners", () => {
  it("groups clients under channel-partner leads", async () => {
    await runWithStoreContext({ orgId: "org-p" }, async () => {
      const partner = await insertRow("leads", {
        company: "North Ledger LLP",
        is_channel_partner: true,
        stage: "closed_won",
        score: 90,
      });
      await insertRow("clients", {
        legal_name: "Harvest Table",
        status: "live",
        channel_partner_lead_id: partner.id,
      });
      await insertRow("clients", {
        legal_name: "Solo Bakery",
        status: "onboarding",
      });
      const portfolio = await listPartnerPortfolio();
      expect(portfolio.partners).toHaveLength(1);
      expect(portfolio.partners[0].company).toBe("North Ledger LLP");
      expect(portfolio.partners[0].clients).toHaveLength(1);
      expect(portfolio.partners[0].clients[0].legal_name).toBe("Harvest Table");
      expect(portfolio.unassigned_clients).toBe(1);
      expect(portfolio.total_clients_under_partners).toBe(1);
    });
  });
});

describe("data retention", () => {
  it("trims old conversation messages and soft-purges old memories", async () => {
    const old = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    await insertRow("conversations", {
      id: "old-chat",
      user_email: "a@b.com",
      title: "Old",
      messages: [{ role: "user", content: "secret" }],
      updated_at: old,
      created_at: old,
    });
    await insertRow("memories", {
      agent: "compliance",
      kind: "learning",
      content: "old learning",
      created_at: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const result = await runDataRetention();
    expect(result.ok).toBe(true);
    expect(result.conversations_trimmed).toBe(1);
    expect(result.memories_purged).toBe(1);
  });
});

describe("stripe plans", () => {
  it("resolves monthly and annual price ids", () => {
    process.env.STRIPE_PRICE_ID = "price_month";
    process.env.STRIPE_PRICE_ID_ANNUAL = "price_year";
    expect(getStripePriceId("monthly")).toBe("price_month");
    expect(getStripePriceId("annual")).toBe("price_year");
    expect(annualPlanAvailable()).toBe(true);
  });

  it("returns null for annual when annual unset", () => {
    process.env.STRIPE_PRICE_ID = "price_month";
    expect(getStripePriceId("annual")).toBeNull();
    expect(annualPlanAvailable()).toBe(false);
  });
});

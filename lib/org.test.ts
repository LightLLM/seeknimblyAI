/**
 * Org-scoped store: inserts stamp org_id; lists/gets are isolated per tenant.
 */

import { clearMemoryStore, insertRow, listRows, getRow, runWithStoreContext } from "@/lib/store";
import { computeMetrics } from "@/lib/metrics";

beforeEach(() => {
  clearMemoryStore();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe("org-scoped store", () => {
  it("stamps and isolates rows by org_id", async () => {
    await runWithStoreContext({ orgId: "org-a" }, async () => {
      await insertRow("leads", { company: "Acme A", stage: "new" });
    });
    await runWithStoreContext({ orgId: "org-b" }, async () => {
      await insertRow("leads", { company: "Acme B", stage: "new" });
      const rows = await listRows("leads", {});
      expect(rows).toHaveLength(1);
      expect(rows[0].company).toBe("Acme B");
      expect(rows[0].org_id).toBe("org-b");
    });
    await runWithStoreContext({ orgId: "org-a" }, async () => {
      const rows = await listRows("leads", {});
      expect(rows).toHaveLength(1);
      expect(rows[0].company).toBe("Acme A");
    });
  });

  it("getRow hides other orgs' rows", async () => {
    let id = "";
    await runWithStoreContext({ orgId: "org-a" }, async () => {
      const row = await insertRow("clients", { legal_name: "Secret Co", status: "live" });
      id = String(row.id);
    });
    await runWithStoreContext({ orgId: "org-b" }, async () => {
      expect(await getRow("clients", id)).toBeNull();
    });
    await runWithStoreContext({ orgId: "org-a" }, async () => {
      expect((await getRow("clients", id))?.legal_name).toBe("Secret Co");
    });
  });
});

describe("metrics", () => {
  it("counts compliance events and drafts for the current org", async () => {
    await runWithStoreContext({ orgId: "org-m" }, async () => {
      await insertRow("compliance_events", { kind: "law_change", title: "Min wage", status: "open" });
      await insertRow("outbox_drafts", { agent: "sales", channel: "email", body: "hi", status: "pending" });
      await insertRow("leads", { company: "Won", stage: "closed_won" });
      const m = await computeMetrics();
      expect(m.compliance_events_caught).toBe(1);
      expect(m.open_compliance_events).toBe(1);
      expect(m.drafts_pending).toBe(1);
      expect(m.leads_closed_won).toBe(1);
    });
  });
});

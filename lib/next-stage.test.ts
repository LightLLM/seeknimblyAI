import { clearMemoryStore, insertRow, runWithStoreContext } from "@/lib/store";
import {
  acceptInvite,
  createInvite,
  resolveOrgForEmail,
  revokeInvite,
  removeOrgMember,
  listPendingInvites,
  listOrgMembers,
} from "@/lib/org";
import { runCertExpirySweep } from "@/lib/cert-expiry";
import { runRetentionSweep } from "@/lib/retention-sweep";
import { computeMetrics } from "@/lib/metrics";
import { exportAuditCsv, logAudit } from "@/lib/audit";
import { SKILL_PACKS } from "@/lib/agents/skill-packs";

beforeEach(() => {
  clearMemoryStore();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe("invite revoke + member remove", () => {
  it("revokes a pending invite so accept fails", async () => {
    const owner = await resolveOrgForEmail("owner@x.com");
    const { token, id } = await createInvite({
      orgId: owner.orgId,
      email: "new@x.com",
      role: "member",
      invitedBy: owner.email,
    });
    await revokeInvite(owner.orgId, id);
    expect(await listPendingInvites(owner.orgId)).toHaveLength(0);
    await expect(acceptInvite(token, "new@x.com")).rejects.toThrow(/not found|revoked/i);
  });

  it("removes a member but not the owner", async () => {
    const owner = await resolveOrgForEmail("o@x.com");
    const { token } = await createInvite({
      orgId: owner.orgId,
      email: "m@x.com",
      role: "member",
      invitedBy: owner.email,
    });
    await acceptInvite(token, "m@x.com");
    const members = await listOrgMembers(owner.orgId);
    const member = members.find((m) => m.email === "m@x.com")!;
    await removeOrgMember({
      orgId: owner.orgId,
      memberId: String(member.id),
      actorEmail: owner.email,
      actorRole: "owner",
    });
    expect((await listOrgMembers(owner.orgId)).map((m) => m.email)).toEqual(["o@x.com"]);

    const ownerRow = (await listOrgMembers(owner.orgId))[0];
    await expect(
      removeOrgMember({
        orgId: owner.orgId,
        memberId: String(ownerRow.id),
        actorEmail: "someone@x.com",
        actorRole: "owner",
      })
    ).rejects.toThrow(/owner/i);
  });
});

describe("cert expiry + retention sweeps", () => {
  it("marks expired certs and creates reminder events", async () => {
    await runWithStoreContext({ orgId: "org-c" }, async () => {
      await insertRow("learning_items", {
        title: "Food Handler (Alex)",
        kind: "certification",
        expiry_date: "2020-01-01",
        status: "complete",
      });
      await insertRow("learning_items", {
        title: "First Aid (Alex)",
        kind: "certification",
        expiry_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: "complete",
      });
      const result = await runCertExpirySweep({ withinDays: 30 });
      expect(result.expired).toBe(1);
      expect(result.reminders).toBe(1);
    });
  });

  it("promotes hires past day 90 to retained_90d", async () => {
    await runWithStoreContext({ orgId: "org-r" }, async () => {
      const start = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await insertRow("hires", { name: "Pat", status: "ramping", start_date: start });
      const result = await runRetentionSweep();
      expect(result.promoted).toBe(1);
      const m = await computeMetrics();
      expect(m.retained_90d).toBe(1);
      expect(m.retention_90d_rate).toBe(1);
    });
  });
});

describe("metrics quality proxies", () => {
  it("computes offer accept and draft reject rates", async () => {
    await runWithStoreContext({ orgId: "org-m2" }, async () => {
      await insertRow("applications", { status: "offer", candidate_id: "c1", job_id: "j1" });
      await insertRow("applications", { status: "hired", candidate_id: "c2", job_id: "j1" });
      await insertRow("outbox_drafts", { status: "approved", agent: "sales", channel: "email", body: "a" });
      await insertRow("outbox_drafts", { status: "rejected", agent: "sales", channel: "email", body: "b" });
      const m = await computeMetrics();
      expect(m.offer_accept_rate).toBe(0.5);
      expect(m.draft_reject_rate).toBe(0.5);
      expect(m.drafts_rejected).toBe(1);
    });
  });
});

describe("audit csv + skill packs", () => {
  it("exports csv with header", async () => {
    await runWithStoreContext({ orgId: "org-a" }, async () => {
      await logAudit({ agent: "system", action: "test_export" });
      const csv = await exportAuditCsv(50);
      expect(csv.startsWith("ts,agent,action")).toBe(true);
      expect(csv).toContain("test_export");
    });
  });

  it("ships versioned skill packs", () => {
    expect(SKILL_PACKS.length).toBeGreaterThanOrEqual(4);
    expect(SKILL_PACKS.every((p) => p.version && p.skills.length > 0)).toBe(true);
  });
});

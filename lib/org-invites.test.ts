import { clearMemoryStore } from "@/lib/store";
import { acceptInvite, createInvite, resolveOrgForEmail, listOrgMembers } from "@/lib/org";
import { LEGAL_CHECKLIST, CASL_OUTREACH_RULES } from "@/lib/legal";
import { AUTOMATIONS } from "@/lib/automations";

beforeEach(() => {
  clearMemoryStore();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe("org invites", () => {
  it("creates a personal org then accepts a teammate invite", async () => {
    const owner = await resolveOrgForEmail("owner@firm.com");
    expect(owner.role).toBe("owner");
    expect(owner.orgName).toContain("owner@firm.com");

    const { token } = await createInvite({
      orgId: owner.orgId,
      email: "teammate@firm.com",
      role: "member",
      invitedBy: owner.email,
    });

    const joined = await acceptInvite(token, "teammate@firm.com");
    expect(joined.orgId).toBe(owner.orgId);
    expect(joined.role).toBe("member");

    const members = await listOrgMembers(owner.orgId);
    expect(members.map((m) => m.email).sort()).toEqual(["owner@firm.com", "teammate@firm.com"]);
  });

  it("rejects accept with the wrong email", async () => {
    const owner = await resolveOrgForEmail("a@x.com");
    const { token } = await createInvite({
      orgId: owner.orgId,
      email: "b@x.com",
      role: "admin",
      invitedBy: owner.email,
    });
    await expect(acceptInvite(token, "wrong@x.com")).rejects.toThrow(/invited email/i);
  });
});

describe("legal surface", () => {
  it("includes CASL, engagement letter, and E&O items", () => {
    const ids = LEGAL_CHECKLIST.map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(["engagement-letter", "casl-review", "eo-insurance", "hitl-nonnegotiable"]));
    expect(CASL_OUTREACH_RULES.length).toBeGreaterThanOrEqual(4);
  });
});

describe("automations", () => {
  it("includes quarterly audit", () => {
    expect(AUTOMATIONS.some((a) => a.id === "quarterly-audit")).toBe(true);
  });
});

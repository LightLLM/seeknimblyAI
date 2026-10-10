import {
  MFG_AUDIT_EXTRAS,
  MFG_COMPLIANCE_CALENDAR,
  MFG_ROLES,
  isManufacturingVertical,
  manufacturingTrainingForRole,
  resolveMfgRoleId,
} from "@/lib/manufacturing/catalog";

describe("manufacturing catalog", () => {
  it("ships plant roles with certs", () => {
    expect(MFG_ROLES.length).toBeGreaterThanOrEqual(6);
    expect(MFG_ROLES.every((r) => r.typical_certs.length > 0)).toBe(true);
  });

  it("resolves role ids from titles", () => {
    expect(resolveMfgRoleId("forklift")).toBe("forklift");
    expect(resolveMfgRoleId("Production Supervisor")).toBe("supervisor");
    expect(manufacturingTrainingForRole("maintenance")).toContain("Lockout/Tagout (LOTO) authorized");
  });

  it("detects manufacturing vertical strings", () => {
    expect(isManufacturingVertical("Manufacturing")).toBe(true);
    expect(isManufacturingVertical("food plant")).toBe(true);
    expect(isManufacturingVertical("restaurant")).toBe(false);
  });

  it("has OH&S calendar and audit extras", () => {
    expect(MFG_COMPLIANCE_CALENDAR.some((c) => /forklift/i.test(c.what))).toBe(true);
    expect(MFG_AUDIT_EXTRAS.length).toBeGreaterThanOrEqual(5);
  });
});

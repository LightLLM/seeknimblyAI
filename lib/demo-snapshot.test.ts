import { buildDay1Snapshot } from "@/lib/demo-snapshot";

describe("Day-1 Compliance Snapshot demo", () => {
  it("always returns at least one gap", () => {
    const snap = buildDay1Snapshot({
      province: "ON",
      employee_count: 12,
      industry: "restaurant",
      has_handbook: true,
      uses_contractors: false,
    });
    expect(snap.gaps.length).toBeGreaterThanOrEqual(1);
    expect(snap.disclaimer.toLowerCase()).toContain("not legal advice");
  });

  it("flags BC pay transparency and QC Bill 96", () => {
    const bc = buildDay1Snapshot({ province: "BC", employee_count: 10, industry: "retail" });
    expect(bc.gaps.some((g) => g.id === "pay_transparency" || g.title.toLowerCase().includes("pay"))).toBe(true);
    const qc = buildDay1Snapshot({ province: "QC", employee_count: 10, industry: "clinic" });
    expect(qc.gaps.some((g) => g.id === "bill96")).toBe(true);
  });
});

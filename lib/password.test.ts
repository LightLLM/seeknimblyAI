import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/password";

describe("password helpers", () => {
  it("hashes and verifies", async () => {
    const hash = await hashPassword("correct-horse");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct-horse", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("validates strength", () => {
    expect(validatePasswordStrength("short")).toMatch(/at least 8/i);
    expect(validatePasswordStrength("long-enough")).toBeNull();
  });
});

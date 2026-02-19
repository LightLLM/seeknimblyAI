import { check, record, rateLimitKey } from "@/lib/rateLimit";

describe("rateLimit", () => {
  const unique = () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  describe("rateLimitKey", () => {
    it("builds key from ip and route", () => {
      expect(rateLimitKey("1.2.3.4", "/api/hr")).toBe("hr:/api/hr:1.2.3.4");
      expect(rateLimitKey("::1", "/api/hr/stream")).toBe("hr:/api/hr/stream:::1");
    });
  });

  describe("check and record", () => {
    it("allows when key is new", () => {
      const key = unique();
      expect(check(key)).toBe(true);
    });

    it("allows after record when under limit", () => {
      const key = unique();
      expect(check(key)).toBe(true);
      record(key);
      expect(check(key)).toBe(true);
    });

    it("rate limits after MAX_REQUESTS", () => {
      const key = unique();
      const MAX = 20;
      for (let i = 0; i < MAX; i++) {
        expect(check(key)).toBe(true);
        record(key);
      }
      expect(check(key)).toBe(false);
    });
  });
});

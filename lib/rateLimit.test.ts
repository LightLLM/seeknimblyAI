import { check, record, rateLimitKey, allowRequest, clearRateLimitMemory, MAX_REQUESTS } from "@/lib/rateLimit";

describe("rateLimit", () => {
  const unique = () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  beforeEach(() => {
    clearRateLimitMemory();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

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
      for (let i = 0; i < MAX_REQUESTS; i++) {
        expect(check(key)).toBe(true);
        record(key);
      }
      expect(check(key)).toBe(false);
    });
  });

  describe("allowRequest", () => {
    it("checks and records in one call (memory fallback)", async () => {
      const key = unique();
      for (let i = 0; i < MAX_REQUESTS; i++) {
        expect(await allowRequest(key)).toBe(true);
      }
      expect(await allowRequest(key)).toBe(false);
    });
  });
});

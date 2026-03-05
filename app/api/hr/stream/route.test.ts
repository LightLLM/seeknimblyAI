import { POST } from "@/app/api/hr/stream/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/rateLimit", () => ({
  check: jest.fn(() => true),
  record: jest.fn(),
  rateLimitKey: jest.fn((_ip: string, route: string) => `key:${route}`),
}));

const LONG_CONTENT = "x".repeat(8001);

function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/hr/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/hr/stream", () => {
  it("accepts history with item content exceeding 8000 chars (truncated server-side)", async () => {
    const req = buildRequest({
      message: "follow-up question",
      jurisdiction: "NA",
      history: [
        { role: "user", content: "What are the SOC2 requirements?" },
        { role: "assistant", content: LONG_CONTENT },
      ],
    });
    const res = await POST(req);
    // Must not return 400 for "String must contain at most 8000 character(s)"
    expect(res.status).not.toBe(400);
    if (res.status === 400) {
      const data = (await res.json()) as { error?: string };
      expect(data.error).not.toMatch(/8000|at most.*character/i);
    }
    // Without API key we get 500; with key we'd get stream. Either way not 400.
    expect([200, 500]).toContain(res.status);
  });

  it("returns 400 when message is missing", async () => {
    const req = buildRequest({ jurisdiction: "NA" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBeDefined();
  });
});

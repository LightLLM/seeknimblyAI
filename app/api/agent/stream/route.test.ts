import { POST } from "@/app/api/agent/stream/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/rateLimit", () => ({
  check: jest.fn(() => true),
  record: jest.fn(),
  rateLimitKey: jest.fn((_ip: string, route: string) => `key:${route}`),
}));

const LONG_CONTENT = "x".repeat(8001);

function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/agent/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/agent/stream", () => {
  it("accepts history with item content exceeding 8000 chars (truncated server-side)", async () => {
    const req = buildRequest({
      message: "Find me 5 engineers in Toronto",
      history: [
        { role: "user", content: "I need backend engineers" },
        { role: "assistant", content: LONG_CONTENT },
      ],
    });
    const res = await POST(req);
    expect(res.status).not.toBe(400);
    if (res.status === 400) {
      const data = (await res.json()) as { error?: string };
      expect(data.error).not.toMatch(/8000|at most.*character/i);
    }
    expect([200, 500]).toContain(res.status);
  });

  it("returns 400 when message is missing", async () => {
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBeDefined();
  });
});

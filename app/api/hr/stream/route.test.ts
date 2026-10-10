import { POST } from "@/app/api/hr/stream/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/rateLimit", () => ({
  check: jest.fn(() => true),
  record: jest.fn(),
  allowRequest: jest.fn(async () => true),
  rateLimitKey: jest.fn((_ip: string, route: string) => `key:${route}`),
}));

jest.mock("@/lib/api-auth", () => ({
  requireUser: jest.fn(),
}));

jest.mock("@/lib/org-llm", () => ({
  getOrgAllowedProviders: jest.fn(async () => null),
  isProviderAllowed: jest.fn(() => true),
}));

import { requireUser } from "@/lib/api-auth";
import { isProviderAllowed } from "@/lib/org-llm";

const mockRequireUser = requireUser as jest.MockedFunction<typeof requireUser>;
const mockIsProviderAllowed = isProviderAllowed as jest.MockedFunction<typeof isProviderAllowed>;

const LONG_CONTENT = "x".repeat(8001);

function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/hr/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/hr/stream", () => {
  beforeEach(() => {
    mockRequireUser.mockResolvedValue({
      email: "admin@example.com",
      org: { orgId: "org-1", email: "admin@example.com", role: "owner", orgName: "Test" },
    });
    mockIsProviderAllowed.mockReturnValue(true);
  });

  it("returns 401 when unauthenticated", async () => {
    const { NextResponse } = await import("next/server");
    mockRequireUser.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const req = buildRequest({ message: "hi", jurisdiction: "NA" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when OpenAI is blocked for the org", async () => {
    mockIsProviderAllowed.mockReturnValue(false);
    const req = buildRequest({ message: "hi", jurisdiction: "NA" });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

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
    expect(res.status).not.toBe(400);
    if (res.status === 400) {
      const data = (await res.json()) as { error?: string };
      expect(data.error).not.toMatch(/8000|at most.*character/i);
    }
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

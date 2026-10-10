import { GET, PUT } from "@/app/api/org/llm-providers/route";
import { NextRequest } from "next/server";
import { clearMemoryStore, insertRow } from "@/lib/store";

jest.mock("@/lib/api-auth", () => ({
  requireUser: jest.fn(),
  withOrgScope: jest.fn((_orgId: string, fn: () => Promise<unknown>) => fn()),
}));

jest.mock("@/lib/audit", () => ({
  logAudit: jest.fn(async () => undefined),
}));

import { requireUser } from "@/lib/api-auth";

const mockRequireUser = requireUser as jest.MockedFunction<typeof requireUser>;

describe("/api/org/llm-providers", () => {
  let orgId: string;

  beforeEach(async () => {
    clearMemoryStore();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const org = await insertRow("orgs", { name: "Secure Co" });
    orgId = String(org.id);
    mockRequireUser.mockResolvedValue({
      email: "owner@example.com",
      org: { orgId, email: "owner@example.com", role: "owner", orgName: "Secure Co" },
    });
  });

  it("GET returns 401 when unauthenticated", async () => {
    const { NextResponse } = await import("next/server");
    mockRequireUser.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await GET(new NextRequest("http://localhost:3000/api/org/llm-providers"));
    expect(res.status).toBe(401);
  });

  it("GET lists providers with all allowed by default", async () => {
    const res = await GET(new NextRequest("http://localhost:3000/api/org/llm-providers"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.allowed).toBeNull();
    expect(data.providers.some((p: { id: string }) => p.id === "openrouter")).toBe(true);
  });

  it("PUT restricts to OpenRouter only", async () => {
    const req = new NextRequest("http://localhost:3000/api/org/llm-providers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowed: ["openrouter"] }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.allowed).toEqual(["openrouter"]);

    const getRes = await GET(new NextRequest("http://localhost:3000/api/org/llm-providers"));
    const listed = await getRes.json();
    expect(listed.allowed).toEqual(["openrouter"]);
    const openai = listed.providers.find((p: { id: string }) => p.id === "openai");
    expect(openai.enabled).toBe(false);
  });

  it("PUT rejects empty allowlist", async () => {
    const req = new NextRequest("http://localhost:3000/api/org/llm-providers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowed: [] }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });
});

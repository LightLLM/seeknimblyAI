import { POST } from "@/app/api/auth/signup/route";
import { NextRequest } from "next/server";
import { clearMemoryStore } from "@/lib/store";
import { findUserByEmail } from "@/lib/users";

jest.mock("@/lib/rateLimit", () => ({
  allowRequest: jest.fn(async () => true),
  rateLimitKey: jest.fn((_ip: string, route: string) => `key:${route}`),
}));

function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    clearMemoryStore();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("creates an account", async () => {
    const res = await POST(
      buildRequest({
        email: "new@company.com",
        password: "securepass1",
        name: "New User",
        company_name: "Company LLC",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.email).toBe("new@company.com");
    const user = await findUserByEmail("new@company.com");
    expect(user?.name).toBe("New User");
  });

  it("rejects weak passwords", async () => {
    const res = await POST(buildRequest({ email: "a@b.com", password: "short" }));
    expect(res.status).toBe(400);
  });

  it("rejects duplicate signup", async () => {
    await POST(buildRequest({ email: "dup@x.com", password: "securepass1" }));
    const res = await POST(buildRequest({ email: "dup@x.com", password: "securepass1" }));
    expect(res.status).toBe(409);
  });
});

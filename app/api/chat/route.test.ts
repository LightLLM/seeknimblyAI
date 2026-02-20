import { POST } from "@/app/api/chat/route";
import { NextRequest } from "next/server";

function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat", () => {
  it("returns suggestedAgent and reason for valid message", async () => {
    const req = buildRequest({ message: "I need to hire 5 engineers" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { suggestedAgent: string; reason: string };
    expect(data.suggestedAgent).toBe("recruiting");
    expect(typeof data.reason).toBe("string");
    expect(data.reason.length).toBeGreaterThan(0);
  });

  it("returns onboarding for first-day message", async () => {
    const req = buildRequest({ message: "What do I do on my first day?" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { suggestedAgent: string };
    expect(data.suggestedAgent).toBe("onboarding");
  });

  it("returns compliance for policy message", async () => {
    const req = buildRequest({ message: "What are the overtime rules?" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { suggestedAgent: string };
    expect(data.suggestedAgent).toBe("compliance");
  });

  it("returns learning_development for training message", async () => {
    const req = buildRequest({ message: "What training do you recommend for leadership development?" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { suggestedAgent: string };
    expect(data.suggestedAgent).toBe("learning_development");
  });

  it("returns 400 when message is missing", async () => {
    const req = buildRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBeDefined();
  });

  it("returns 400 when message is empty string", async () => {
    const req = buildRequest({ message: "" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is not valid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

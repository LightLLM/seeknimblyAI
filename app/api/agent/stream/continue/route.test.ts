import { POST } from "@/app/api/agent/stream/continue/route";
import { NextRequest } from "next/server";

const origEnv = process.env;

function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/agent/stream/continue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function base64Encode(obj: object): string {
  return Buffer.from(JSON.stringify(obj), "utf-8").toString("base64");
}

describe("POST /api/agent/stream/continue", () => {
  beforeEach(() => {
    process.env = { ...origEnv };
    process.env.OPENAI_API_KEY = "sk-test-key";
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it("returns 400 when continuation is missing", async () => {
    const req = buildRequest({ approved_tool_call_ids: [] });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBeDefined();
    expect(data.error!.length).toBeGreaterThan(0);
  });

  it("returns 400 when body is not valid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/agent/stream/continue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when approved_tool_call_ids is missing", async () => {
    const req = buildRequest({ continuation: "e30=" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when continuation is not valid base64", async () => {
    const req = buildRequest({
      continuation: "not-valid-base64!!!",
      approved_tool_call_ids: [],
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toMatch(/continuation|invalid/i);
  });

  it("returns 400 when continuation payload is not valid JSON", async () => {
    const req = buildRequest({
      continuation: Buffer.from("not json", "utf-8").toString("base64"),
      approved_tool_call_ids: [],
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when continuation has no pending tool calls (last message not assistant with tool_calls)", async () => {
    const payload = {
      messages: [{ role: "user", content: "hello" }],
      params: {},
    };
    const req = buildRequest({
      continuation: base64Encode(payload),
      approved_tool_call_ids: [],
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toMatch(/pending|tool/i);
  });

  it("returns 400 when messages array is empty", async () => {
    const payload = { messages: [], params: {} };
    const req = buildRequest({
      continuation: base64Encode(payload),
      approved_tool_call_ids: [],
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

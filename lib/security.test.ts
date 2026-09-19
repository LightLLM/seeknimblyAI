/**
 * Security hardening tests: HMAC-signed continuation tokens.
 * Approval continuations must survive a roundtrip unchanged and be rejected
 * on any tampering (body edits, signature strip, wrong secret).
 */

import { encodeContinuation, decodeContinuation } from "@/lib/agents/runtime";

const PAYLOAD = {
  agentId: "sales",
  messages: [
    { role: "system", content: "prompt" },
    {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "call_1",
          type: "function",
          function: { name: "update_lead_stage", arguments: '{"lead_id":"L1","stage":"closed_won","won_lost_reason":"pilot"}' },
        },
      ],
    },
  ],
};

describe("signed continuation tokens", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "unit-test-secret-that-is-long-enough!";
  });

  it("roundtrips a payload unchanged", () => {
    const token = encodeContinuation(PAYLOAD);
    expect(token).toContain(".");
    const decoded = decodeContinuation(token);
    expect(decoded?.agentId).toBe("sales");
    const assistant = decoded?.messages[1] as { tool_calls?: { function: { arguments: string } }[] };
    expect(assistant.tool_calls?.[0].function.arguments).toContain("closed_won");
  });

  it("rejects a tampered body (changed tool arguments)", () => {
    const token = encodeContinuation(PAYLOAD);
    const [body, sig] = [token.slice(0, token.lastIndexOf(".")), token.slice(token.lastIndexOf(".") + 1)];
    const json = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
    json.messages[1].tool_calls[0].function.arguments = '{"lead_id":"L1","stage":"closed_lost","won_lost_reason":"tampered"}';
    const forged = Buffer.from(JSON.stringify(json), "utf-8").toString("base64url") + "." + sig;
    expect(decodeContinuation(forged)).toBeNull();
  });

  it("rejects a stripped or wrong signature", () => {
    const token = encodeContinuation(PAYLOAD);
    const body = token.slice(0, token.lastIndexOf("."));
    expect(decodeContinuation(body)).toBeNull();
    expect(decodeContinuation(`${body}.`)).toBeNull();
    expect(decodeContinuation(`${body}.AAAA`)).toBeNull();
  });

  it("rejects tokens signed with a different secret", () => {
    const token = encodeContinuation(PAYLOAD);
    process.env.NEXTAUTH_SECRET = "a-completely-different-secret-value!!";
    expect(decodeContinuation(token)).toBeNull();
  });

  it("rejects garbage", () => {
    expect(decodeContinuation("not-a-token")).toBeNull();
    expect(decodeContinuation("aGVsbG8.d29ybGQ")).toBeNull();
  });
});

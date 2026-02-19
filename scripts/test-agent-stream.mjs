#!/usr/bin/env node
/**
 * Quick local test for /api/agent/stream (recruitment agent).
 * Run: node scripts/test-agent-stream.mjs
 * Start the dev server first: npm run dev
 * Optional: BASE_URL=https://seeknimblyai.vercel.app node scripts/test-agent-stream.mjs
 */
const BASE = process.env.BASE_URL || "http://localhost:3000";

async function main() {
  console.log("Testing", BASE + "/api/agent/stream", "...\n");
  const res = await fetch(BASE + "/api/agent/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Find me 5 backend engineers in Toronto. I need a sourcing workflow and boolean strings.",
      params: {
        job_title: "Backend Engineer",
        location: "Toronto",
        jurisdiction: "CA",
      },
    }),
  });
  if (!res.ok) {
    console.error("HTTP", res.status, await res.text());
    process.exit(1);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let steps = [];
  let errorMsg = null;
  while (true) {
    const { done: streamDone, value } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const ev = JSON.parse(line);
        if (ev.type === "step") {
          steps.push(ev.label || ev.id);
          console.log("  step:", ev.label || ev.id, ev.status || "");
        }
        if (ev.type === "done" && ev.text) text = ev.text;
        if (ev.type === "error") errorMsg = ev.error;
      } catch (_) {}
    }
  }
  if (errorMsg) {
    console.error("Stream error:", errorMsg);
    process.exit(1);
  }
  const preview = text.slice(0, 300).replace(/\n/g, " ");
  console.log("\nOK – got response (" + text.length + " chars). Preview:", preview + "...");
  console.log("\nSteps run:", steps.join(" → "));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

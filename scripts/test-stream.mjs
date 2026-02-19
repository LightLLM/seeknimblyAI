#!/usr/bin/env node
/**
 * Quick local test for /api/hr/stream. Run with: node scripts/test-stream.mjs
 * Start the dev server first: npm run dev
 */
const BASE = process.env.BASE_URL || "http://localhost:3000";

async function main() {
  console.log("Testing", BASE + "/api/hr/stream", "...\n");
  const res = await fetch(BASE + "/api/hr/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "What is minimum wage in Ontario?",
      jurisdiction: "CA",
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
  let done = false;
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
        if (ev.type === "text" && ev.delta) text += ev.delta;
        if (ev.type === "done" && ev.text) {
          done = true;
          text = ev.text;
        }
        if (ev.type === "error") errorMsg = ev.error;
      } catch (_) {}
    }
  }
  if (errorMsg) {
    console.error("Stream error:", errorMsg);
    process.exit(1);
  }
  if (!done || !text) {
    console.error("No done event or empty text. Frontend would show 'No response'.");
    process.exit(1);
  }
  const preview = text.slice(0, 200).replace(/\n/g, " ");
  console.log("OK – got response (" + text.length + " chars). Preview:", preview + "...");
  console.log("\nFrontend would display this. OpenAI key and stream are working.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

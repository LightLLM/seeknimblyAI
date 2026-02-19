#!/usr/bin/env node
/**
 * List OpenAI models available for your API key.
 * Loads OPENAI_API_KEY from .env.local (create from .env.example if needed).
 * Usage: node scripts/list-models.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const path = resolve(process.cwd(), ".env.local");
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*OPENAI_API_KEY\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, "").trim();
    }
  } catch (_) {
    // ignore
  }
  return process.env.OPENAI_API_KEY;
}

const apiKey = loadEnv();
if (!apiKey) {
  console.error("No OPENAI_API_KEY in .env.local or environment.");
  process.exit(1);
}

const res = await fetch("https://api.openai.com/v1/models", {
  headers: { Authorization: `Bearer ${apiKey}` },
});
if (!res.ok) {
  console.error("API error", res.status, await res.text());
  process.exit(1);
}

const data = await res.json();
const models = (data.data || [])
  .map((m) => ({ id: m.id, owned_by: m.owned_by || "" }))
  .filter((m) => m.id.startsWith("gpt-") || m.id.startsWith("o1") || m.id.startsWith("o3") || m.id.startsWith("o4"))
  .sort((a, b) => a.id.localeCompare(b.id));

console.log("Models (likely usable with Responses API):\n");
for (const m of models) {
  console.log("  ", m.id);
}
console.log("\nSet OPENAI_MODEL in .env.local or Vercel to one of the above (e.g. gpt-4o).");

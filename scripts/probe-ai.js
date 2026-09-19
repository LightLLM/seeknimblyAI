const fs = require("fs");
const path = require("path");

const raw = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
const env = {};
for (const line of raw.split(/\r?\n/)) {
  if (!line || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  let v = line.slice(i + 1);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  env[line.slice(0, i)] = v;
}

const keys = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_API_KEY",
  "GEMINI_API_KEY",
  "XAI_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "STRIPE_SECRET_KEY",
];

for (const k of keys) {
  const v = env[k];
  const ok = Boolean(v && v.length > 8 && !/^your-|^sk-\.\.\./.test(v));
  console.log(`${k}: ${ok ? "set" : "missing"}`);
}

(async () => {
  const key = (env.OPENAI_API_KEY || "").trim();
  if (!key) {
    console.log("OPENAI_PROBE: no key");
    return;
  }
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    const text = await res.text();
    console.log(`OPENAI_PROBE: HTTP ${res.status}`);
    if (res.ok) {
      const j = JSON.parse(text);
      console.log(`OPENAI_PROBE: OK (${(j.data || []).length} models)`);
    } else {
      console.log(`OPENAI_PROBE: ${text.slice(0, 250)}`);
    }
  } catch (e) {
    console.log(`OPENAI_PROBE: FAIL ${e.message}`);
  }
})();

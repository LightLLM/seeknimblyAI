/**
 * Run Machine Learning Engineer (San Francisco, US) recruiting scenario.
 * Usage: node scripts/run-mle-sf-scenario.mjs
 * Requires: npm run dev, AUTH_EMAIL/AUTH_PASSWORD in .env.local
 */
import fs from "fs";
import path from "path";

const BASE = process.env.BASE_URL || "http://localhost:3000";

function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  const env = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    let v = line.slice(i + 1);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[line.slice(0, i)] = v;
  }
  return env;
}

async function getSessionCookie(email, password) {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const cookieFromCsrf = (csrfRes.headers.getSetCookie?.() || []).join("; ") || csrfRes.headers.get("set-cookie") || "";

  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: `${BASE}/app`,
    json: "true",
  });

  const signRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieFromCsrf,
    },
    body,
    redirect: "manual",
  });

  const setCookies = signRes.headers.getSetCookie?.() || [];
  let cookie = [...(cookieFromCsrf ? [cookieFromCsrf.split(";")[0]] : []), ...setCookies.map((c) => c.split(";")[0])]
    .filter(Boolean)
    .join("; ");

  if (!cookie.includes("session-token") && !cookie.includes("next-auth.session-token")) {
    // Fallback: collect all set-cookie names
    const all = signRes.headers.get("set-cookie");
    if (all) cookie = [cookie, all.split(",")[0].split(";")[0]].filter(Boolean).join("; ");
  }

  const sessionRes = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: cookie } });
  const session = await sessionRes.json();
  if (!session?.user?.email) {
    throw new Error(`Login failed. status=${signRes.status} session=${JSON.stringify(session)}`);
  }
  return { cookie, email: session.user.email };
}

async function readNdjson(res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  const steps = [];
  let pending = null;
  let error = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const ev = JSON.parse(line);
        if (ev.type === "step") steps.push(`${ev.status}: ${ev.label}`);
        if (ev.type === "text" && ev.delta) text += ev.delta;
        if (ev.type === "done" && ev.text) text = ev.text;
        if (ev.type === "pending_tool_calls") pending = ev;
        if (ev.type === "error") error = ev.error;
      } catch {
        /* ignore */
      }
    }
  }
  return { text, steps, pending, error };
}

async function main() {
  const env = loadEnv();
  const email = env.AUTH_EMAIL;
  const password = env.AUTH_PASSWORD;
  if (!email || !password) throw new Error("AUTH_EMAIL/AUTH_PASSWORD missing");

  console.log("1) Signing in as", email);
  const { cookie } = await getSessionCookie(email, password);
  console.log("   OK\n");

  console.log("2) Intake: create ML Engineer role (SF, US)");
  const intakeRes = await fetch(`${BASE}/api/intake`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      kind: "role",
      fields: {
        title: "Machine Learning Engineer",
        location: "San Francisco, CA, US",
        work_model: "hybrid",
        province: "CA", // California for US state-ish field some tools use
        salary_min: 180000,
        salary_max: 260000,
        currency: "USD",
        must_haves:
          "Python, PyTorch or TensorFlow, production ML systems, MLOps basics, 3+ years experience",
        nice_to_haves: "LLM fine-tuning, Ray, feature stores, SF Bay Area hybrid OK",
      },
    }),
  });
  const intakeJson = await intakeRes.json();
  console.log("   HTTP", intakeRes.status, JSON.stringify(intakeJson).slice(0, 400), "\n");

  const prompt = `Run a full recruiting scenario for a Machine Learning Engineer in San Francisco, United States (hybrid).

Requirements:
- Title: Machine Learning Engineer
- Location: San Francisco, CA, US (hybrid 3 days in office)
- Comp: $180k–$260k USD base + equity
- Must-haves: Python, PyTorch or TensorFlow, shipping production ML, MLOps familiarity, 3+ years
- Nice-to-haves: LLMs, Ray, feature stores

Do this:
1) create_job if not already created for this role
2) draft_job_description suitable for US / California (pay transparency: include salary range)
3) get_sourcing_workflow with boolean strings / LinkedIn X-ray oriented to SF Bay Area
4) Summarize the posting plan and next ATS steps

Jurisdiction context: US. Do not invent candidates. Drafts only — never send.`;

  console.log("3) Recruiting agent stream…");
  const streamRes = await fetch(`${BASE}/api/agents/recruiting/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      message: prompt,
      jurisdiction: "US",
      modelId: "auto",
      history: [],
    }),
  });

  if (!streamRes.ok) {
    console.error("Stream HTTP", streamRes.status, await streamRes.text());
    process.exit(1);
  }

  const result = await readNdjson(streamRes);
  console.log("\n--- STEPS ---");
  for (const s of result.steps) console.log(s);
  if (result.error) {
    console.error("\nERROR:", result.error);
    process.exit(1);
  }
  if (result.pending) {
    console.log("\n--- PENDING APPROVAL ---");
    console.log(JSON.stringify(result.pending.calls, null, 2));
  }
  console.log("\n--- AGENT OUTPUT ---\n");
  console.log(result.text || "(no text — likely paused for approval)");
  console.log("\nDone. Open http://localhost:3000/app/pipeline and /app/approvals to review.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

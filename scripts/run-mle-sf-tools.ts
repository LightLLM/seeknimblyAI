/**
 * MLE · San Francisco US recruiting scenario (no LLM — tools only).
 * Run: npx tsx scripts/run-mle-sf-tools.ts
 */
import { clearMemoryStore, runWithStoreContext, listRows, insertRow } from "../lib/store";
import { recruitingTools } from "../lib/agents/hr-tools";
import { toolByName } from "../lib/agents/types";
import type { AgentDefinition } from "../lib/agents/types";

const fakeAgent = { tools: recruitingTools } as AgentDefinition;

async function call(name: string, args: Record<string, unknown>) {
  const tool = toolByName(fakeAgent, name);
  if (!tool) throw new Error(`missing tool ${name}`);
  const raw = await tool.handler(args, { orgId: "scenario-sf", jurisdiction: "US" });
  return JSON.parse(raw);
}

async function main() {
  clearMemoryStore();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  await runWithStoreContext({ orgId: "scenario-sf" }, async () => {
    console.log("=== Machine Learning Engineer · San Francisco, US ===\n");

    const job = await call("create_job", {
      title: "Machine Learning Engineer",
      province: "CA",
      salary_range: "$180,000–$260,000 USD base + equity",
      must_haves:
        "Python; PyTorch or TensorFlow; production ML systems; MLOps basics; 3+ years experience",
      nice_to_haves: "LLM fine-tuning; Ray; feature stores; Bay Area hybrid",
      work_model: "hybrid",
      rubric:
        "Python/ML frameworks 30%; productionization & MLOps 25%; systems design 20%; communication 15%; domain fit 10%. Job-related criteria only.",
    });
    console.log("1) Job created:", job);

    const postingBody = `Machine Learning Engineer — San Francisco, CA (Hybrid)

About the role
You'll own models from prototype to production for products used by millions, partnering with platform and product engineering.

Location
San Francisco, CA · Hybrid (3 days onsite)

Compensation (CA pay transparency)
Base salary: $180,000 – $260,000 USD
Equity: Yes · Benefits: medical/dental/vision, 401(k)

What you'll do
- Train, evaluate, and ship ML models (ranking, NLP, or forecasting)
- Build reliable training/inference pipelines and monitoring
- Partner with product to define success metrics and offline/online evals
- Raise the bar on MLOps: feature freshness, drift, rollback

Must-haves
- 3+ years shipping production ML
- Strong Python; PyTorch or TensorFlow
- Experience with training pipelines, evaluation, and online serving
- Comfortable with code review, testing, and on-call for ML services

Nice-to-haves
- LLMs / fine-tuning; Ray; feature stores; Spark

Interview process
1) Recruiter screen  2) Technical screen  3) Onsite: coding + ML system design + values
Same structured questions for every candidate.

Equal opportunity
We hire on job-related criteria only.`;

    const draft = await call("draft_job_description", {
      job_title: "Machine Learning Engineer",
      body: postingBody,
      channels: "LinkedIn, Indeed US, company careers, referral",
    });
    console.log("\n2) JD draft (approval outbox):", draft);

    const sourcing = await call("get_sourcing_workflow", {
      job_title: "Machine Learning Engineer",
      location: "San Francisco Bay Area",
      seniority: "Mid–Senior",
      core_stack: "Python, PyTorch/TensorFlow, MLOps",
      work_model: "hybrid",
      must_haves: "production ML, Python, deep learning framework",
    });
    console.log("\n3) Sourcing workflow:\n");
    console.log(typeof sourcing === "string" ? sourcing : JSON.stringify(sourcing, null, 2).slice(0, 3500));

    await insertRow("applications", {
      job_id: job.job_id,
      candidate_name: "Alex Rivera",
      candidate_email: "alex.rivera.example@email.com",
      status: "new",
      score: null,
      notes: "Synthetic shortlist placeholder — screen with rubric when LLM credits available",
    });
    await insertRow("applications", {
      job_id: job.job_id,
      candidate_name: "Jordan Lee",
      candidate_email: "jordan.lee.example@email.com",
      status: "new",
      score: null,
    });

    const apps = await listRows("applications", { limit: 20 });
    const drafts = await listRows("outbox_drafts", { limit: 20 });
    const jobs = await listRows("jobs", { limit: 20 });

    console.log("\n4) Snapshot");
    console.log("   Jobs:", jobs.length, jobs.map((j) => j.title));
    console.log("   Applications:", apps.length, apps.map((a) => `${a.candidate_name} (${a.status})`));
    console.log("   Outbox drafts:", drafts.length, drafts.map((d) => d.subject));
    console.log("\nNote: Live agent stream needs OpenAI credits. Job + JD draft + sourcing ran offline.");
    console.log("When credits return: open /app, pick Recruiting, ask to continue this SF MLE hire.");
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Recruitment agent tools: OpenAI tool definitions and stub handlers (Phase 1).
 * Replace stub implementations with real APIs (Supabase, Resend, Calendly) in Phase 2.
 */

import type OpenAI from "openai";

export const AGENT_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_candidates",
      description: "Search for candidates by job title, location, and experience level. Returns a list of candidate summaries.",
      parameters: {
        type: "object",
        properties: {
          job_title: { type: "string", description: "Job title or role to search for" },
          location: { type: "string", description: "City, region, or remote" },
          experience_level: { type: "string", description: "e.g. entry, mid, senior" },
          max_results: { type: "number", description: "Maximum number of candidates to return" },
        },
        required: ["job_title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "screen_resume",
      description: "Score a resume against a job specification. Pass either file_id (OpenAI file) or resume_text. Returns score 0-100 and a short summary.",
      parameters: {
        type: "object",
        properties: {
          file_id: { type: "string", description: "OpenAI file ID of the uploaded resume" },
          resume_text: { type: "string", description: "Raw resume text if no file" },
          job_title: { type: "string", description: "Job title to score against" },
          job_requirements: { type: "string", description: "Brief job requirements" },
        },
        required: ["job_title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_outreach",
      description: "Send an outreach email or message to a candidate.",
      parameters: {
        type: "object",
        properties: {
          candidate_email: { type: "string", description: "Candidate email address" },
          candidate_name: { type: "string", description: "Candidate name" },
          subject: { type: "string", description: "Email subject" },
          body: { type: "string", description: "Email or message body" },
        },
        required: ["candidate_email", "subject", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_interview",
      description: "Schedule an interview slot for a candidate. Returns a booking link or confirmation.",
      parameters: {
        type: "object",
        properties: {
          candidate_email: { type: "string", description: "Candidate email" },
          candidate_name: { type: "string", description: "Candidate name" },
          duration_minutes: { type: "number", description: "Interview duration in minutes" },
          note: { type: "string", description: "Optional note for the invite" },
        },
        required: ["candidate_email"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_ats",
      description: "Add or update a candidate in the ATS (applicant tracking system) with a status.",
      parameters: {
        type: "object",
        properties: {
          candidate_name: { type: "string", description: "Full name" },
          candidate_email: { type: "string", description: "Email" },
          status: { type: "string", description: "e.g. new, screened, contacted, scheduled, hired, rejected" },
          job_title: { type: "string", description: "Role they are being considered for" },
          notes: { type: "string", description: "Optional notes" },
        },
        required: ["candidate_email", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_sourcing_workflow",
      description: "Get a ready-to-run sourcing workflow when you cannot return a list of real candidates. Returns: (1) 4 clarifying questions (seniority, core stack, work model, must-haves), (2) LinkedIn boolean search string, (3) Google X-ray for LinkedIn, (4) GitHub search, (5) 10-minute shortlist scorecard, (6) outreach email template. Use this when the user asks for candidates in a location/role and you have no real candidate database—give them copy/paste searches and a scorecard instead.",
      parameters: {
        type: "object",
        properties: {
          job_title: { type: "string", description: "Role e.g. Backend Engineer, Software Engineer" },
          location: { type: "string", description: "City/region e.g. Toronto, Greater Toronto Area" },
          seniority: { type: "string", description: "e.g. Intermediate, Senior, Staff" },
          core_stack: { type: "string", description: "e.g. Java+Spring, Go, Python, Node; AWS/GCP; Kafka" },
          work_model: { type: "string", description: "e.g. onsite, hybrid, remote-from-ON" },
          must_haves: { type: "string", description: "e.g. years, domain, security clearance, fintech" },
        },
        required: ["job_title", "location"],
      },
    },
  },
];

export type ToolHandlerContext = {
  openai?: import("openai").OpenAI;
  jobTitle?: string;
  location?: string;
};

/**
 * Execute a single tool by name and arguments. Stub implementations return mock data.
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  _context?: ToolHandlerContext
): Promise<string> {
  switch (name) {
    case "search_candidates": {
      const job = (args.job_title as string) ?? "role";
      const loc = (args.location as string) ?? "anywhere";
      const max = Math.min(Number(args.max_results) || 5, 20);
      return JSON.stringify({
        message: "[Stub] Search not connected to a candidate source yet.",
        candidates: Array.from({ length: max }, (_, i) => ({
          id: `cand_${i + 1}`,
          name: `Candidate ${i + 1}`,
          email: `candidate${i + 1}@example.com`,
          job_title: job,
          location: loc,
          experience: (args.experience_level as string) ?? "mid",
        })),
        total: max,
      });
    }
    case "screen_resume": {
      const job = (args.job_title as string) ?? "role";
      const score = 60 + Math.floor(Math.random() * 35);
      return JSON.stringify({
        message: "[Stub] Resume screening uses mock scoring.",
        score,
        summary: `Candidate appears to match ${job} at a ${score}/100 fit. (Phase 2 will use real LLM scoring.)`,
        job_title: job,
      });
    }
    case "send_outreach": {
      const email = args.candidate_email as string;
      const subject = args.subject as string;
      return JSON.stringify({
        message: "[Stub] Email not sent; no provider configured.",
        would_send_to: email,
        subject,
        status: "simulated",
      });
    }
    case "schedule_interview": {
      const email = args.candidate_email as string;
      const duration = (args.duration_minutes as number) ?? 30;
      return JSON.stringify({
        message: "[Stub] No calendar integration yet.",
        candidate_email: email,
        duration_minutes: duration,
        booking_link: "https://calendly.com/your-team/placeholder",
        status: "simulated",
      });
    }
    case "update_ats": {
      const email = args.candidate_email as string;
      const status = args.status as string;
      return JSON.stringify({
        message: "[Stub] ATS not connected; update simulated.",
        candidate_email: email,
        status,
        ats_id: `ats_${Date.now()}`,
      });
    }
    case "get_sourcing_workflow": {
      const job = (args.job_title as string) ?? "Backend Engineer";
      const loc = (args.location as string) ?? "Toronto";
      const seniority = (args.seniority as string) ?? "Intermediate / Senior";
      const stack = (args.core_stack as string) ?? "Java, Go, Python, Node; AWS/GCP; Docker/Kubernetes";
      const workModel = (args.work_model as string) ?? "hybrid";
      const mustHaves = (args.must_haves as string) ?? "none specified";
      const locGTA = loc === "Toronto" ? "Greater Toronto Area" : loc;
      const isML = /kubeflow|mlflow|mlops|ml platform|machine learning infrastructure|model serving|ML engineer|ML Engineer/i.test(job + " " + stack);
      const urlExtraction = `
How to pull LinkedIn profile links from Google X-Ray results (repeatable)
1) Run the Google X-Ray query below in Google search.
2) Copy LinkedIn profile links from the results: right-click the result title → Copy link address, or click the result and copy the URL from the address bar.
3) (Optional) Filter to clean public profile URLs: keep only https://www.linkedin.com/in/<handle>/ and exclude .../jobs/, .../learning/, .../company/, .../posts/
4) Faster extraction: After searching, click Tools → set results to Verbatim (reduces Google rewriting your terms). You can use a "SERP URL extractor" extension to export result URLs if allowed by your org's policies.`;
      const backendXray = `B) Google X-ray for LinkedIn (${loc})\nsite:linkedin.com/in ("${locGTA}" OR ${loc}) ("Backend Engineer" OR "Software Engineer")\n(AWS OR GCP OR Azure) (Kubernetes OR Docker) (Java OR Go OR Python OR Node)`;
      const mlXray = isML
        ? `

D) Google X-Ray for MLOps / ML platform (${loc}) — paste into Google
site:linkedin.com/in (Kubeflow OR "KubeFlow") ("MLflow" OR "ML Flow") (MLOps OR "ml platform" OR "machine learning infrastructure" OR "model serving") (${loc} OR "${locGTA}" OR GTA) -jobs -learning -recruiter -talent -intern -student
Use the same steps above to copy and filter LinkedIn profile URLs. If you want GitHub links for the same skill stack (Kubeflow + MLflow, ${loc}), say so and I can give you an X-Ray that returns both LinkedIn + GitHub profiles.`
        : "";
      const workflow = `I can't compile or hand you a curated list of specific individuals' LinkedIn profile links. What I can do is (1) give you exact, copy/paste X-Ray and boolean strings so you can pull 5+ candidates yourself, and (2) show you how to pull LinkedIn URLs from the results in a repeatable way.

Before I tailor the strings, answer these 4 items (one line each is fine):
- Seniority: Intermediate / Senior / Staff? (you said: ${seniority})
- Core stack: (e.g., Java+Spring, Go, Python, Node; Kubeflow, MLflow, MLOps, etc.) (you said: ${stack})
- Work model: onsite ${loc} / hybrid / remote? (you said: ${workModel})
- Any must-haves: (years, domain, security clearance, fintech, etc.) (you said: ${mustHaves})

Ready-to-run searches (${loc}, ${job})

A) LinkedIn boolean (paste into LinkedIn search bar; set Location = Greater ${locGTA})
("backend engineer" OR "software engineer" OR "backend developer" OR "server-side")
AND (API OR microservices OR "distributed systems")
AND (AWS OR GCP OR Azure OR Kubernetes OR Docker)
AND (Java OR Go OR Golang OR Python OR Node OR "C#")
NOT (intern OR internship OR "front end" OR frontend OR "full stack" OR "mobile")
Filters: Location = Greater ${locGTA}; Experience = 3–8 years (intermediate) or 5–12 (senior).

${backendXray}

C) GitHub: location:${loc} (language:Go OR language:Java OR language:Python OR language:TypeScript). Shortlist: recent commits, production-style repos (tests, CI, README), API/microservices projects.
${mlXray}
${urlExtraction}

10-minute shortlist scorecard (0–2 points per line, max 10)
- Backend language depth (Go/Java/Python/Node)
- Cloud (AWS/GCP/Azure) + infra (Docker/K8s)
- API design + microservices/distributed systems
- Evidence of impact (metrics, scale, ownership)
- Communication (clear summaries, docs, OSS PRs)

Outreach template (${job}, ${loc})
Subject: ${job} role (${loc} / ${workModel}) — quick chat?
Body: 1 sentence why you're reaching out (their backend + cloud). 1 sentence role mission + stack. 1 sentence comp range + work model + interview steps. Close: "Open to a 15-minute chat this week?"

If you reply with seniority + stack + work model + must-haves, I can tighten the booleans and add a structured checklist to pull 5 qualified profiles in ~15–30 minutes.`;
      return JSON.stringify({ workflow, job_title: job, location: loc });
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

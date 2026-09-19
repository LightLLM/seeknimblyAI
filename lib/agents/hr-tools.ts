/**
 * DB-backed tools for the four HR service agents:
 * Recruiting, Onboarding, Training/L&D, Compliance.
 */

import { insertRow, updateRow, listRows } from "@/lib/store";
import { logAudit } from "@/lib/audit";
import { makeTool, str, num, createDraft, demoNote } from "@/lib/agents/tool-helpers";
import type { AgentTool } from "@/lib/agents/types";
import { executeTool as legacyExecuteTool } from "@/lib/agent-tools";

// ---------------------------------------------------------------- Recruiting

export const recruitingTools: AgentTool[] = [
  makeTool({
    name: "create_job",
    description:
      "Create a job requisition. Record the approved screening rubric here — it is the bias-audit record.",
    properties: {
      title: str("Job title"),
      province: str("Province/state, e.g. ON, BC"),
      salary_range: str("Salary range (required in BC postings)"),
      must_haves: str("Must-have criteria, job-related only"),
      nice_to_haves: str("Nice-to-have criteria"),
      work_model: str("onsite | hybrid | remote"),
      rubric: str("Screening rubric: criteria and weights, job-related only"),
    },
    required: ["title"],
    handler: async (args) => {
      const job = await insertRow("jobs", {
        title: args.title,
        province: args.province ?? null,
        salary_range: args.salary_range ?? null,
        must_haves: args.must_haves ?? null,
        nice_to_haves: args.nice_to_haves ?? null,
        work_model: args.work_model ?? null,
        rubric: args.rubric ?? null,
        status: "open",
      });
      await logAudit({ agent: "recruiting", action: "job_created", entity_type: "job", entity_id: String(job.id), detail: String(args.title) });
      return JSON.stringify({ ok: true, job_id: job.id, note: demoNote() });
    },
  }),
  makeTool({
    name: "screen_resume",
    description:
      "Score a resume against the job's approved rubric using the LLM. Persists the score, rationale, and rubric to the ATS (bias-audit record). Job-related criteria only.",
    properties: {
      resume_text: str("Raw resume text"),
      candidate_name: str("Candidate name"),
      candidate_email: str("Candidate email"),
      job_title: str("Job title to score against"),
      rubric: str("Approved rubric / job requirements to score against"),
    },
    required: ["resume_text", "job_title"],
    handler: async (args, ctx) => {
      let score = 0;
      let rationale = "";
      if (ctx.openai) {
        const res = await ctx.openai.chat.completions.create({
          model: ctx.model ?? "gpt-4o",
          messages: [
            {
              role: "system",
              content:
                "You are a resume screener. Score ONLY on the job-related rubric provided. Never consider or mention age, sex, race, religion, family status, disability, national origin, or any protected ground. Return strict JSON: {\"score\": 0-100, \"rationale\": \"2 lines max\"}.",
            },
            { role: "user", content: `Rubric / requirements for ${args.job_title}:\n${args.rubric ?? "General fit for the role"}\n\nResume:\n${String(args.resume_text).slice(0, 6000)}` },
          ],
          max_completion_tokens: 200,
          response_format: { type: "json_object" },
        });
        try {
          const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}");
          score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
          rationale = String(parsed.rationale ?? "").slice(0, 500);
        } catch {
          rationale = "Scoring response could not be parsed.";
        }
      } else {
        score = 50;
        rationale = "No LLM available for scoring (demo).";
      }
      const app = await insertRow("applications", {
        candidate_name: args.candidate_name ?? null,
        candidate_email: args.candidate_email ?? null,
        job_title: args.job_title,
        status: "screened",
        score,
        score_rationale: rationale,
        notes: `Rubric used: ${String(args.rubric ?? "general fit").slice(0, 500)}`,
      });
      await logAudit({ agent: "recruiting", action: "resume_screened", entity_type: "application", entity_id: String(app.id), detail: `${args.candidate_name ?? "candidate"} → ${score}/100` });
      return JSON.stringify({ ok: true, application_id: app.id, score, rationale, note: demoNote() });
    },
  }),
  makeTool({
    name: "update_ats",
    description: "Move a candidate through the pipeline: new | screened | contacted | scheduled | offer | hired | rejected. Rejections need a reason code.",
    requiresApproval: true,
    properties: {
      application_id: str("Existing application id (preferred)"),
      candidate_email: str("Candidate email (used to create a record if no id)"),
      candidate_name: str("Candidate name"),
      job_title: str("Role"),
      status: str("new | screened | contacted | scheduled | offer | hired | rejected"),
      notes: str("Notes / rejection reason code"),
    },
    required: ["status"],
    handler: async (args) => {
      let row;
      if (args.application_id) {
        row = await updateRow("applications", String(args.application_id), {
          status: args.status,
          notes: args.notes ?? null,
        });
      }
      if (!row) {
        row = await insertRow("applications", {
          candidate_email: args.candidate_email ?? null,
          candidate_name: args.candidate_name ?? null,
          job_title: args.job_title ?? null,
          status: args.status,
          notes: args.notes ?? null,
        });
      }
      await logAudit({ agent: "recruiting", action: `ats_status:${args.status}`, entity_type: "application", entity_id: String(row.id), status: "approved", detail: String(args.notes ?? "") });
      return JSON.stringify({ ok: true, application_id: row.id, status: args.status, note: demoNote() });
    },
  }),
  makeTool({
    name: "list_pipeline",
    description: "List ATS applications, optionally filtered by status.",
    properties: { status: str("Filter by status (optional)") },
    handler: async (args) => {
      const rows = await listRows("applications", {
        filters: args.status ? { status: args.status } : {},
        limit: 50,
      });
      return JSON.stringify({ count: rows.length, applications: rows, note: demoNote() });
    },
  }),
  makeTool({
    name: "draft_job_description",
    description: "Draft a job description / posting for client approval (goes to the outbox; never posted directly). Plain language, real requirements only.",
    properties: {
      job_title: str("Role"),
      body: str("Full posting text. Include salary range for BC."),
      channels: str("Where it would be posted, e.g. Indeed CA, LinkedIn, Job Bank"),
    },
    required: ["job_title", "body"],
    handler: async (args) =>
      createDraft({
        agent: "recruiting",
        channel: "posting",
        subject: `Job posting: ${args.job_title} (${args.channels ?? "channels TBD"})`,
        body: String(args.body),
      }),
  }),
  makeTool({
    name: "draft_outreach",
    description: "Draft candidate outreach (email/LinkedIn). Saved to the approval outbox — never sent directly.",
    properties: {
      candidate_email: str("Recipient"),
      candidate_name: str("Candidate name"),
      subject: str("Subject line"),
      body: str("Message body"),
    },
    required: ["subject", "body"],
    handler: async (args) =>
      createDraft({
        agent: "recruiting",
        channel: "email",
        recipient: String(args.candidate_email ?? args.candidate_name ?? "candidate"),
        subject: String(args.subject),
        body: String(args.body),
      }),
  }),
  makeTool({
    name: "draft_interview_invite",
    description: "Draft an interview invitation with proposed times and the structured interview plan. Saved to the approval outbox.",
    properties: {
      candidate_email: str("Recipient"),
      candidate_name: str("Candidate name"),
      proposed_times: str("2-3 concrete time slots"),
      duration_minutes: num("Interview length"),
      body: str("Invitation text incl. structured interview outline"),
    },
    required: ["candidate_email", "body"],
    handler: async (args) =>
      createDraft({
        agent: "recruiting",
        channel: "email",
        recipient: String(args.candidate_email),
        subject: `Interview invitation${args.candidate_name ? ` — ${args.candidate_name}` : ""}`,
        body: `${args.body}\n\nProposed times: ${args.proposed_times ?? "TBD"} (${args.duration_minutes ?? 30} min)`,
      }),
  }),
  makeTool({
    name: "get_sourcing_workflow",
    description:
      "When no real candidate rows exist, returns a copy/paste sourcing workflow: clarifying questions, LinkedIn boolean, Google X-ray, GitHub search, shortlist scorecard, outreach template.",
    properties: {
      job_title: str("Role"),
      location: str("City/region"),
      seniority: str("e.g. Intermediate, Senior, Staff"),
      core_stack: str("Tech stack"),
      work_model: str("onsite | hybrid | remote"),
      must_haves: str("Hard requirements"),
    },
    required: ["job_title", "location"],
    handler: async (args) => legacyExecuteTool("get_sourcing_workflow", args),
  }),
];

// ---------------------------------------------------------------- Onboarding

const STATUTORY_CA: Record<string, string[]> = {
  base: [
    "Federal TD1 form (tax credits)",
    "Provincial TD1 form",
    "SIN collection (verify format; 9-series SIN → track work-permit expiry)",
    "Work authorization check (if applicable)",
    "Payroll enrollment with provider; confirm CRA payroll account exists",
    "Workers' compensation registration current",
    "Benefits enrollment (if applicable)",
    "Employment contract signed BEFORE start date (termination clause meets ESA minimums)",
  ],
  ON: ["WSIB coverage confirmed", "Ontario worker Health & Safety awareness training", "ESA poster provided"],
  BC: ["WorkSafeBC registration", "Salary range was disclosed in posting (BC Pay Transparency Act)"],
  QC: ["CNESST registration", "French-language contract/documents where required (Bill 96) — flag for review", "Quebec TP-1015.3 (provincial tax form)"],
  AB: ["WCB Alberta coverage confirmed"],
};

export const onboardingTools: AgentTool[] = [
  makeTool({
    name: "create_hire",
    description: "Register a new hire and auto-create the statutory checklist for their province.",
    properties: {
      name: str("New hire full name"),
      role: str("Role/title"),
      province: str("Province code: ON, BC, AB, QC, etc."),
      start_date: str("Start date YYYY-MM-DD"),
      employment_type: str("full_time | part_time | contract"),
    },
    required: ["name", "province"],
    handler: async (args) => {
      const hire = await insertRow("hires", {
        name: args.name,
        role: args.role ?? null,
        province: args.province,
        start_date: args.start_date ?? null,
        employment_type: args.employment_type ?? null,
        status: "pre_start",
      });
      const prov = String(args.province).toUpperCase();
      const items = [...STATUTORY_CA.base, ...(STATUTORY_CA[prov] ?? [])];
      for (const title of items) {
        await insertRow("onboarding_tasks", {
          hire_id: hire.id,
          title,
          category: "statutory",
          due_date: args.start_date ?? null,
          status: "pending",
        });
      }
      await logAudit({ agent: "onboarding", action: "hire_created", entity_type: "hire", entity_id: String(hire.id), detail: `${args.name} (${prov}), ${items.length} statutory tasks` });
      return JSON.stringify({ ok: true, hire_id: hire.id, statutory_tasks_created: items.length, note: demoNote() });
    },
  }),
  makeTool({
    name: "get_statutory_checklist",
    description: "Return the statutory onboarding checklist for a Canadian province (no DB write).",
    properties: { province: str("Province code, e.g. ON, BC, AB, QC") },
    required: ["province"],
    handler: async (args) => {
      const prov = String(args.province).toUpperCase();
      return JSON.stringify({ province: prov, items: [...STATUTORY_CA.base, ...(STATUTORY_CA[prov] ?? [])] });
    },
  }),
  makeTool({
    name: "draft_offer_letter",
    description:
      "Draft an offer letter for client approval (outbox). Termination/probation clauses must meet the province's ESA minimums; custom clauses get flagged for counsel.",
    properties: {
      hire_name: str("Candidate name"),
      role: str("Role"),
      province: str("Province"),
      compensation: str("Salary / wage + any per-hire terms"),
      start_date: str("Start date"),
      probation: str("Probation terms (must be ESA-valid)"),
      vacation: str("Vacation (statutory minimum or better)"),
      body: str("Full offer letter text"),
    },
    required: ["hire_name", "role", "body"],
    handler: async (args) =>
      createDraft({
        agent: "onboarding",
        channel: "document",
        recipient: String(args.hire_name),
        subject: `Offer letter — ${args.hire_name}, ${args.role} (${args.province ?? "province TBD"})`,
        body: String(args.body),
        entity_type: "hire",
      }),
  }),
  makeTool({
    name: "add_onboarding_tasks",
    description: "Add checklist tasks for a hire (equipment, accounts, training, policy acknowledgements...).",
    properties: {
      hire_id: str("Hire id"),
      tasks: {
        type: "array",
        description: "Tasks to add",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            category: { type: "string", description: "statutory | equipment | training | checkin | general" },
            due_date: { type: "string", description: "YYYY-MM-DD" },
          },
          required: ["title"],
        },
      },
    },
    required: ["hire_id", "tasks"],
    handler: async (args) => {
      const tasks = (args.tasks as Array<{ title: string; category?: string; due_date?: string }>) ?? [];
      for (const t of tasks) {
        await insertRow("onboarding_tasks", {
          hire_id: args.hire_id,
          title: t.title,
          category: t.category ?? "general",
          due_date: t.due_date ?? null,
          status: "pending",
        });
      }
      await logAudit({ agent: "onboarding", action: "tasks_added", entity_type: "hire", entity_id: String(args.hire_id), detail: `${tasks.length} tasks` });
      return JSON.stringify({ ok: true, added: tasks.length, note: demoNote() });
    },
  }),
  makeTool({
    name: "schedule_checkins",
    description: "Create day 7/30/60/90 check-in tasks from the start date. 90-day retention feeds the recruiting quality loop.",
    properties: { hire_id: str("Hire id"), start_date: str("Start date YYYY-MM-DD") },
    required: ["hire_id", "start_date"],
    handler: async (args) => {
      const start = new Date(String(args.start_date));
      for (const days of [7, 30, 60, 90]) {
        const due = new Date(start.getTime() + days * 86400000);
        await insertRow("onboarding_tasks", {
          hire_id: args.hire_id,
          title: `Day ${days} check-in`,
          category: "checkin",
          due_date: due.toISOString().slice(0, 10),
          status: "pending",
        });
      }
      await logAudit({ agent: "onboarding", action: "checkins_scheduled", entity_type: "hire", entity_id: String(args.hire_id) });
      return JSON.stringify({ ok: true, checkins: [7, 30, 60, 90], note: demoNote() });
    },
  }),
  makeTool({
    name: "update_hire_status",
    description:
      "Update a hire lifecycle status: pre_start | week_1 | ramping | retained_90d | exited. Use retained_90d after day 90 still employed; exited if they left.",
    properties: {
      hire_id: str("Hire id"),
      status: str("pre_start | week_1 | ramping | retained_90d | exited"),
    },
    required: ["hire_id", "status"],
    handler: async (args) => {
      const allowed = new Set(["pre_start", "week_1", "ramping", "retained_90d", "exited"]);
      const status = String(args.status);
      if (!allowed.has(status)) {
        return JSON.stringify({ ok: false, error: `Invalid status. Use one of: ${Array.from(allowed).join(", ")}` });
      }
      const row = await updateRow("hires", String(args.hire_id), { status });
      if (!row) return JSON.stringify({ ok: false, error: "Hire not found" });
      await logAudit({
        agent: "onboarding",
        action: `hire_status_${status}`,
        entity_type: "hire",
        entity_id: String(args.hire_id),
      });
      return JSON.stringify({ ok: true, hire: row, note: demoNote() });
    },
  }),
  makeTool({
    name: "list_onboarding_status",
    description: "List a hire's checklist with statuses, or all hires when no hire_id given.",
    properties: { hire_id: str("Hire id (optional)") },
    handler: async (args) => {
      if (args.hire_id) {
        const tasks = await listRows("onboarding_tasks", { filters: { hire_id: args.hire_id }, limit: 100, ascending: true });
        return JSON.stringify({ tasks, note: demoNote() });
      }
      const hires = await listRows("hires", { limit: 50 });
      return JSON.stringify({ hires, note: demoNote() });
    },
  }),
];

// ---------------------------------------------------------------- Training

const MANDATORY_TRAINING: Record<string, string[]> = {
  ON: ["Worker Health & Safety awareness (all workers)", "Supervisor H&S awareness (supervisors)", "Workplace harassment & violence policy training (Bill 132)", "WHMIS (if hazardous materials)", "AODA accessibility training"],
  BC: ["WorkSafeBC young/new worker orientation", "Bullying & harassment policy training", "WHMIS (if applicable)"],
  AB: ["Harassment & violence prevention plan training", "WHMIS (if applicable)"],
  QC: ["Psychological harassment policy communication (LNT)", "French-language training materials where required (Bill 96)", "WHMIS/SIMDUT (if applicable)"],
};

export const trainingTools: AgentTool[] = [
  makeTool({
    name: "get_mandatory_training",
    description: "Province-mandated training items that must be on every learning path.",
    properties: { province: str("Province code, e.g. ON, BC, AB, QC") },
    required: ["province"],
    handler: async (args) => {
      const prov = String(args.province).toUpperCase();
      return JSON.stringify({
        province: prov,
        mandatory: MANDATORY_TRAINING[prov] ?? ["Check the province's OHS body for mandatory items"],
        disclaimer: "Verify current requirements with the provincial regulator. This is guidance, not legal advice.",
      });
    },
  }),
  makeTool({
    name: "create_learning_path",
    description: "Create a learning path for a person/role with initial items (mandatory first).",
    properties: {
      person_name: str("Person"),
      role: str("Role"),
      goal: str("What this path achieves"),
      items: {
        type: "array",
        description: "Learning items",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            kind: { type: "string", description: "course | certification | mandatory | mentoring | workshop" },
            mandatory: { type: "boolean" },
            due_date: { type: "string" },
          },
          required: ["title"],
        },
      },
    },
    required: ["person_name", "items"],
    handler: async (args) => {
      const path = await insertRow("learning_paths", {
        person_name: args.person_name,
        role: args.role ?? null,
        goal: args.goal ?? null,
      });
      const items = (args.items as Array<{ title: string; kind?: string; mandatory?: boolean; due_date?: string }>) ?? [];
      for (const it of items) {
        await insertRow("learning_items", {
          path_id: path.id,
          title: it.title,
          kind: it.kind ?? "course",
          mandatory: it.mandatory ?? false,
          due_date: it.due_date ?? null,
          status: "assigned",
        });
      }
      await logAudit({ agent: "training", action: "learning_path_created", entity_type: "learning_path", entity_id: String(path.id), detail: `${args.person_name}: ${items.length} items` });
      return JSON.stringify({ ok: true, path_id: path.id, items_created: items.length, note: demoNote() });
    },
  }),
  makeTool({
    name: "track_certification",
    description: "Track a certification with an expiry date so it can be renewed before lapse.",
    properties: {
      person_name: str("Person"),
      title: str("Certification"),
      expiry_date: str("Expiry YYYY-MM-DD"),
      path_id: str("Learning path id (optional)"),
    },
    required: ["person_name", "title", "expiry_date"],
    handler: async (args) => {
      const item = await insertRow("learning_items", {
        path_id: args.path_id ?? null,
        title: `${args.title} (${args.person_name})`,
        kind: "certification",
        mandatory: true,
        expiry_date: args.expiry_date,
        status: "complete",
      });
      await logAudit({ agent: "training", action: "certification_tracked", entity_type: "learning_item", entity_id: String(item.id), detail: `${args.title} expires ${args.expiry_date}` });
      return JSON.stringify({ ok: true, item_id: item.id, note: demoNote() });
    },
  }),
  makeTool({
    name: "update_learning_item",
    description: "Update a learning item's status: assigned | in_progress | complete | expired.",
    properties: { item_id: str("Item id"), status: str("New status") },
    required: ["item_id", "status"],
    handler: async (args) => {
      const row = await updateRow("learning_items", String(args.item_id), { status: args.status });
      return JSON.stringify({ ok: Boolean(row), item: row, note: demoNote() });
    },
  }),
  makeTool({
    name: "list_learning_status",
    description: "List learning paths, or a path's items when path_id given.",
    properties: { path_id: str("Path id (optional)") },
    handler: async (args) => {
      if (args.path_id) {
        const items = await listRows("learning_items", { filters: { path_id: args.path_id }, limit: 100, ascending: true });
        return JSON.stringify({ items, note: demoNote() });
      }
      const paths = await listRows("learning_paths", { limit: 50 });
      return JSON.stringify({ paths, note: demoNote() });
    },
  }),
];

// ---------------------------------------------------------------- Compliance

const CA_COMPLIANCE_CALENDAR: Array<{ when: string; what: string; who: string }> = [
  { when: "15th of each month", what: "CRA payroll remittance (regular remitters; frequency varies by remitter category)", who: "All employers with payroll" },
  { when: "Last day of February", what: "T4/T4A slips to employees and CRA", who: "All employers" },
  { when: "Mar 31 (ON)", what: "WSIB annual reconciliation", who: "Ontario employers" },
  { when: "Feb 28 / Mar (BC)", what: "WorkSafeBC annual payroll report", who: "BC employers" },
  { when: "Jun 1", what: "Ontario minimum wage change announcements (effective Oct 1)", who: "ON employers" },
  { when: "Oct 1", what: "Ontario minimum wage adjustment takes effect", who: "ON employers" },
  { when: "Jan 1", what: "Federal + several provincial minimum wage / ESA changes commonly take effect", who: "All" },
  { when: "Within 5 calendar days of interruption of earnings", what: "Issue ROE", who: "All employers" },
];

export const complianceTools: AgentTool[] = [
  makeTool({
    name: "web_search",
    description:
      "Search the live web for current employment-law / compliance information. ALWAYS call this before draft_change_brief. Returns a summary plus official source URLs — use one of those https URLs as source_url.",
    properties: {
      query: str("Search query, e.g. 'Ontario minimum wage October 2026 site:ontario.ca'"),
    },
    required: ["query"],
    handler: async (args, ctx) => {
      if (!ctx.openai) {
        return JSON.stringify({
          ok: false,
          error: "OpenAI client unavailable for web search.",
          note: "Cannot verify law changes without live search — do not invent a Change Brief.",
        });
      }
      const query = String(args.query ?? "").trim();
      if (!query) return JSON.stringify({ ok: false, error: "query required" });
      try {
        const model = ctx.model ?? "gpt-4o";
        const response = await ctx.openai.responses.create({
          model,
          tools: [{ type: "web_search_preview" as const }],
          input: `Search for official government sources only (*.gov, *.gc.ca, ontario.ca, gov.bc.ca, alberta.ca, quebec.ca, canada.ca, cra-arc.gc.ca, labour.gov). Query: ${query}

Return:
1) A short factual summary (what changed / current rule)
2) Effective date if stated
3) A bullet list of official source URLs (https only)
If you cannot find an official source, say so clearly.`,
          max_output_tokens: 1024,
        });
        const text =
          (response as { output_text?: string }).output_text?.trim() ||
          "No search results returned.";
        const urls = Array.from(text.matchAll(/https?:\/\/[^\s\)\]\"']+/g)).map((m) =>
          m[0].replace(/[.,;]+$/, "")
        );
        const uniqueUrls = Array.from(new Set(urls)).slice(0, 8);
        await logAudit({
          agent: "compliance",
          action: "web_search",
          detail: `${query} → ${uniqueUrls.length} urls`,
        });
        return JSON.stringify({
          ok: true,
          query,
          summary: text,
          source_urls: uniqueUrls,
          instruction:
            uniqueUrls.length > 0
              ? "Use one of source_urls as source_url when calling draft_change_brief."
              : "No official URL found — do NOT call draft_change_brief; tell the user you could not verify from an official source.",
          note: demoNote(),
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "web search failed";
        return JSON.stringify({ ok: false, error: message });
      }
    },
  }),
  makeTool({
    name: "log_compliance_event",
    description: "Log a compliance event (law change caught, deadline, audit finding). Compliance events caught is a headline metric.",
    properties: {
      kind: str("law_change | deadline | audit_finding | reminder"),
      jurisdiction: str("e.g. ON, BC, CA-federal"),
      title: str("Short title"),
      detail: str("What changed / what is due, and the required action"),
      effective_date: str("YYYY-MM-DD (optional)"),
      deadline: str("YYYY-MM-DD (optional)"),
      source_url: str("Official source URL"),
    },
    required: ["kind", "title"],
    handler: async (args) => {
      const ev = await insertRow("compliance_events", {
        kind: args.kind,
        jurisdiction: args.jurisdiction ?? null,
        title: args.title,
        detail: args.detail ?? null,
        effective_date: args.effective_date ?? null,
        deadline: args.deadline ?? null,
        source_url: args.source_url ?? null,
        source_checked_at: args.source_url ? new Date().toISOString() : null,
        status: "open",
      });
      await logAudit({ agent: "compliance", action: `event_logged:${args.kind}`, entity_type: "compliance_event", entity_id: String(ev.id), detail: String(args.title) });
      return JSON.stringify({ ok: true, event_id: ev.id, note: demoNote() });
    },
  }),
  makeTool({
    name: "list_compliance_calendar",
    description: "The recurring Canadian compliance calendar plus open logged events/deadlines.",
    properties: {},
    handler: async () => {
      const open = await listRows("compliance_events", { filters: { status: "open" }, limit: 50 });
      return JSON.stringify({ recurring_calendar: CA_COMPLIANCE_CALENDAR, open_events: open, note: demoNote() });
    },
  }),
  makeTool({
    name: "run_audit_checklist",
    description: "Return the 12-point SMB compliance audit checklist to run against a client, with the client's context filled in.",
    properties: {
      client_name: str("Client"),
      provinces: str("Provinces of operation"),
      employee_count: num("Employee count"),
    },
    handler: async (args) => {
      return JSON.stringify({
        client: args.client_name ?? "client",
        provinces: args.provinces ?? "unknown",
        checklist: [
          "1. Payroll: CRA account current, remitter category correct, last remittance on time",
          "2. Employee vs. contractor classification per CRA tests (the classic SMB landmine)",
          "3. Wage floor: everyone at/above current provincial minimum (verify current rates)",
          "4. Overtime and hours-of-work rules of the applicable province followed",
          "5. Vacation and stat-holiday pay correct for each province",
          "6. Employment contracts: termination clauses meet ESA minimums; probation terms valid",
          "7. Workers' comp: registered, premiums current, coverage matches operations",
          "8. Handbook: exists, matches current law, acknowledgement signatures on file",
          "9. Mandatory training done (e.g., Ontario H&S awareness; harassment training where required)",
          "10. Privacy: employee-data handling meets PIPEDA/Law 25; breach-response plan exists",
          "11. ROE issued within 5 calendar days for any interruption of earnings",
          "12. Postings compliant (BC salary ranges; French in Quebec)",
        ],
        instruction: "Score each item pass/gap/unknown, log gaps with log_compliance_event, and produce a scored report. This is guidance, not legal advice.",
      });
    },
  }),
  makeTool({
    name: "draft_change_brief",
    description:
      "Draft a law-change brief for approval AFTER web_search. Requires an official https source_url from web_search results. Routed to the outbox.",
    properties: {
      title: str("Change title"),
      jurisdiction: str("e.g. ON"),
      effective_date: str("YYYY-MM-DD"),
      affected: str("Which clients/employees are affected"),
      required_action: str("What must be done"),
      draft_edit: str("Draft of the policy/handbook edit"),
      source_url: str("Official https source URL from web_search"),
      body: str("Full change brief text"),
    },
    required: ["title", "body", "source_url"],
    handler: async (args) => {
      const sourceUrl = String(args.source_url ?? "").trim();
      if (!/^https:\/\//i.test(sourceUrl)) {
        return JSON.stringify({
          ok: false,
          error: "source_url must be an https:// official URL. Call web_search first and use one of its source_urls.",
        });
      }
      const host = (() => {
        try {
          return new URL(sourceUrl).hostname.toLowerCase();
        } catch {
          return "";
        }
      })();
      const officialHint =
        host.endsWith(".gov") ||
        host.endsWith(".gc.ca") ||
        /(^|\.)(ontario\.ca|gov\.bc\.ca|alberta\.ca|quebec\.ca|canada\.ca|cra-arc\.gc\.ca)$/i.test(host);
      if (!officialHint) {
        return JSON.stringify({
          ok: false,
          error: `source_url host "${host}" does not look like an official government domain. Prefer *.gc.ca, ontario.ca, gov.bc.ca, canada.ca, *.gov. Re-run web_search.`,
        });
      }
      const res = await createDraft({
        agent: "compliance",
        channel: "document",
        subject: `Change Brief: ${args.title} (${args.jurisdiction ?? "jurisdiction TBD"})`,
        body: `${args.body}\n\nOfficial source: ${sourceUrl} (checked ${new Date().toISOString().slice(0, 10)})\n\nThis is guidance, not legal advice.`,
      });
      await insertRow("compliance_events", {
        kind: "law_change",
        jurisdiction: args.jurisdiction ?? null,
        title: args.title,
        detail: args.required_action ?? null,
        effective_date: args.effective_date ?? null,
        source_url: sourceUrl,
        source_checked_at: new Date().toISOString(),
        status: "open",
      });
      return res;
    },
  }),
  makeTool({
    name: "list_compliance_events",
    description: "List logged compliance events, optionally by status: open | actioned | dismissed.",
    properties: { status: str("Filter (optional)") },
    handler: async (args) => {
      const rows = await listRows("compliance_events", {
        filters: args.status ? { status: args.status } : {},
        limit: 100,
      });
      return JSON.stringify({ count: rows.length, events: rows, note: demoNote() });
    },
  }),
];

/**
 * Tools for the lifecycle agents that run Seeknimbly itself:
 * Lead-Gen & Outreach, Sales Pipeline, Client Onboarding.
 * Ported from the seeknimbly-hermes skills.
 */

import { insertRow, updateRow, listRows, getRow } from "@/lib/store";
import { logAudit } from "@/lib/audit";
import { makeTool, str, num, bool, createDraft, demoNote } from "@/lib/agents/tool-helpers";
import type { AgentTool } from "@/lib/agents/types";

const LEAD_STAGES = ["new", "contacted", "replied", "call_booked", "proposal", "negotiating", "closed_won", "closed_lost", "dormant"];

// ---------------------------------------------------------------- Lead-gen

export const leadGenTools: AgentTool[] = [
  makeTool({
    name: "add_lead",
    description: "Add a prospect to the CRM (duplicate-checked by company name).",
    properties: {
      company: str("Company name"),
      contact_name: str("Contact person"),
      contact_email: str("Contact email"),
      province: str("Province, e.g. ON"),
      vertical: str("restaurants | professional_services | retail | healthcare | startup | construction | accounting_firm | other"),
      employee_count: num("Employee count if known"),
      is_channel_partner: bool("True for accounting/bookkeeping firms"),
      notes: str("Source / context, incl. the verifiable personalization fact"),
    },
    required: ["company"],
    handler: async (args) => {
      const existing = await listRows("leads", { filters: { company: args.company }, limit: 1 });
      if (existing.length > 0) {
        return JSON.stringify({ ok: false, duplicate: true, existing_lead: existing[0], message: "Lead already exists — update it instead of creating a duplicate." });
      }
      const lead = await insertRow("leads", {
        company: args.company,
        contact_name: args.contact_name ?? null,
        contact_email: args.contact_email ?? null,
        province: args.province ?? null,
        vertical: args.vertical ?? null,
        employee_count: args.employee_count ?? null,
        is_channel_partner: args.is_channel_partner ?? false,
        notes: args.notes ?? null,
        stage: "new",
        touch_count: 0,
      });
      await logAudit({ agent: "lead_gen", action: "lead_added", entity_type: "lead", entity_id: String(lead.id), detail: String(args.company) });
      return JSON.stringify({ ok: true, lead_id: lead.id, note: demoNote() });
    },
  }),
  makeTool({
    name: "score_lead",
    description:
      "Score a lead 0-100 on the ICP rubric: +30 employees 10-150 confirmed; +20 actively hiring; +20 multi-province/location; +15 no HR role; +15 accounting firm w/ SMB base. Persists score + breakdown.",
    properties: {
      lead_id: str("Lead id"),
      employees_confirmed: bool("Employee count 10-150 confirmed"),
      actively_hiring: bool("Job posting found"),
      multi_location: bool("Multi-province or multi-location"),
      no_hr_role: bool("No HR role found on LinkedIn"),
      accounting_firm: bool("Accounting firm with SMB client base"),
    },
    required: ["lead_id"],
    handler: async (args) => {
      let score = 0;
      const parts: string[] = [];
      if (args.employees_confirmed) { score += 30; parts.push("+30 employee count 10-150"); }
      if (args.actively_hiring) { score += 20; parts.push("+20 actively hiring"); }
      if (args.multi_location) { score += 20; parts.push("+20 multi-location"); }
      if (args.no_hr_role) { score += 15; parts.push("+15 no HR role"); }
      if (args.accounting_firm) { score += 15; parts.push("+15 channel partner"); }
      const row = await updateRow("leads", String(args.lead_id), { score, score_breakdown: parts.join("; ") || "0 — no criteria met" });
      return JSON.stringify({ ok: Boolean(row), score, breakdown: parts, note: demoNote() });
    },
  }),
  makeTool({
    name: "draft_outreach",
    description:
      "Draft cold outreach for approval (never sent directly). Personalize with ONE verifiable fact; lead with a compliance risk or dollar cost, not 'AI'. CASL: prefer LinkedIn for cold contact.",
    properties: {
      lead_id: str("Lead id"),
      channel: str("email | linkedin"),
      recipient: str("Recipient (email or LinkedIn profile)"),
      subject: str("Subject (email only)"),
      body: str("Message body with identification + unsubscribe for email"),
    },
    required: ["body", "channel"],
    handler: async (args) => {
      const res = await createDraft({
        agent: "lead_gen",
        channel: String(args.channel),
        recipient: args.recipient ? String(args.recipient) : undefined,
        subject: args.subject ? String(args.subject) : undefined,
        body: String(args.body),
        entity_type: "lead",
        entity_id: args.lead_id ? String(args.lead_id) : undefined,
      });
      if (args.lead_id) {
        const lead = await getRow("leads", String(args.lead_id));
        if (lead) {
          await updateRow("leads", String(args.lead_id), {
            touch_count: (Number(lead.touch_count) || 0) + 1,
            last_touch_at: new Date().toISOString(),
          });
        }
      }
      return res;
    },
  }),
  makeTool({
    name: "list_leads",
    description: "List CRM leads, optionally by stage.",
    properties: { stage: str(`Filter by stage: ${LEAD_STAGES.join(" | ")}`) },
    handler: async (args) => {
      const rows = await listRows("leads", { filters: args.stage ? { stage: args.stage } : {}, limit: 100 });
      return JSON.stringify({ count: rows.length, leads: rows, note: demoNote() });
    },
  }),
];

// ---------------------------------------------------------------- Sales

export const salesTools: AgentTool[] = [
  makeTool({
    name: "update_lead_stage",
    description:
      "Move a lead through the pipeline. closed_won/closed_lost REQUIRE won_lost_reason. 3+ touches with no reply → dormant.",
    requiresApproval: true,
    properties: {
      lead_id: str("Lead id"),
      stage: str(`One of: ${LEAD_STAGES.join(" | ")}`),
      won_lost_reason: str("Mandatory for closed_won / closed_lost"),
      notes: str("Reply verbatim / context"),
    },
    required: ["lead_id", "stage"],
    handler: async (args) => {
      const stage = String(args.stage);
      if (!LEAD_STAGES.includes(stage)) {
        return JSON.stringify({ ok: false, error: `Invalid stage. Use: ${LEAD_STAGES.join(", ")}` });
      }
      if ((stage === "closed_won" || stage === "closed_lost") && !args.won_lost_reason) {
        return JSON.stringify({ ok: false, error: "won_lost_reason is mandatory when closing a lead." });
      }
      const row = await updateRow("leads", String(args.lead_id), {
        stage,
        won_lost_reason: args.won_lost_reason ?? null,
        ...(args.notes ? { notes: args.notes } : {}),
      });
      await logAudit({ agent: "sales", action: `stage:${stage}`, entity_type: "lead", entity_id: String(args.lead_id), status: "approved", detail: String(args.won_lost_reason ?? args.notes ?? "") });
      return JSON.stringify({ ok: Boolean(row), lead: row, handoff: stage === "closed_won" ? "Hand off to the Client Onboarding agent." : undefined, note: demoNote() });
    },
  }),
  makeTool({
    name: "draft_reply",
    description: "Draft a same-day reply to a prospect (goal: book a 15-min call with 2-3 concrete slots). Goes to the approval outbox.",
    properties: {
      lead_id: str("Lead id"),
      recipient: str("Recipient email"),
      subject: str("Subject"),
      body: str("Reply body with 2-3 proposed time slots"),
    },
    required: ["body"],
    handler: async (args) =>
      createDraft({
        agent: "sales",
        channel: "email",
        recipient: args.recipient ? String(args.recipient) : undefined,
        subject: args.subject ? String(args.subject) : "Re: your reply",
        body: String(args.body),
        entity_type: "lead",
        entity_id: args.lead_id ? String(args.lead_id) : undefined,
      }),
  }),
  makeTool({
    name: "call_prep_onepager",
    description: "Build a discovery-call one-pager from the CRM record: snapshot, 3 questions to ask, likely objections + responses.",
    properties: { lead_id: str("Lead id") },
    required: ["lead_id"],
    handler: async (args) => {
      const lead = await getRow("leads", String(args.lead_id));
      if (!lead) return JSON.stringify({ ok: false, error: "Lead not found" });
      return JSON.stringify({
        snapshot: lead,
        three_questions: [
          "Who owns HR today — founder, office manager, or nobody?",
          "When was your last compliance scare (audit, complaint, misclassification, ROE)?",
          "What are your hiring plans this year?",
        ],
        objection_playbook: {
          too_small: "Cost of one compliance miss vs. subscription price — cite a provincial fine range.",
          existing_payroll_tool: "We're the completion layer on top of payroll, not a replacement; we integrate.",
          trust_ai: "Human approves everything; full audit trail; error-correction SLA; insurance.",
          price: "Anchor against fractional HR ($4–8K/mo) and PEO costs, not software.",
        },
        note: demoNote(),
      });
    },
  }),
  makeTool({
    name: "draft_proposal",
    description:
      "Draft a proposal for approval: modules, tier, per-hire fee if Recruiting, annual-prepay discount, 30-day pilot.",
    properties: {
      lead_id: str("Lead id"),
      company: str("Company"),
      modules: str("Modules proposed, e.g. Recruiting + Compliance"),
      tier: str("Pricing tier"),
      body: str("Full proposal text"),
    },
    required: ["company", "modules", "body"],
    handler: async (args) =>
      createDraft({
        agent: "sales",
        channel: "proposal",
        recipient: String(args.company),
        subject: `Proposal — ${args.company}: ${args.modules} (${args.tier ?? "tier TBD"})`,
        body: String(args.body),
        entity_type: "lead",
        entity_id: args.lead_id ? String(args.lead_id) : undefined,
      }),
  }),
];

// ---------------------------------------------------------------- Client onboarding

export const clientOnboardingTools: AgentTool[] = [
  makeTool({
    name: "create_client",
    description: "Create the client profile all service agents depend on.",
    requiresApproval: true,
    properties: {
      legal_name: str("Legal name"),
      provinces: str("Provinces of operation, comma-separated"),
      employee_count: num("Employee count"),
      industry: str("Industry"),
      payroll_provider: str("Payroll provider"),
      key_contact: str("Key contact name"),
      key_contact_email: str("Key contact email"),
      tier: str("Purchased tier"),
      renewal_date: str("Renewal date YYYY-MM-DD"),
      channel_partner_lead_id: str("Optional: lead id of the accounting/channel partner firm"),
    },
    required: ["legal_name"],
    handler: async (args) => {
      const client = await insertRow("clients", {
        legal_name: args.legal_name,
        provinces: args.provinces ?? null,
        employee_count: args.employee_count ?? null,
        industry: args.industry ?? null,
        payroll_provider: args.payroll_provider ?? null,
        key_contact: args.key_contact ?? null,
        key_contact_email: args.key_contact_email ?? null,
        tier: args.tier ?? null,
        renewal_date: args.renewal_date ?? null,
        channel_partner_lead_id: args.channel_partner_lead_id ?? null,
        status: "onboarding",
      });
      await logAudit({ agent: "client_onboarding", action: "client_created", entity_type: "client", entity_id: String(client.id), status: "approved", detail: String(args.legal_name) });
      return JSON.stringify({ ok: true, client_id: client.id, note: demoNote() });
    },
  }),
  makeTool({
    name: "provision_module",
    description: "Provision a purchased module for a client: scope, approval contact, cadence.",
    properties: {
      client_id: str("Client id"),
      module: str("recruiting | onboarding | training | compliance"),
      scope: str("What the module covers for this client"),
      approval_contact: str("Who approves this module's outputs"),
      cadence: str("e.g. weekly monitor, monthly sweep"),
    },
    required: ["client_id", "module"],
    handler: async (args) => {
      const mod = await insertRow("client_modules", {
        client_id: args.client_id,
        module: args.module,
        scope: args.scope ?? null,
        approval_contact: args.approval_contact ?? null,
        cadence: args.cadence ?? null,
      });
      await logAudit({ agent: "client_onboarding", action: `module_provisioned:${args.module}`, entity_type: "client", entity_id: String(args.client_id) });
      return JSON.stringify({ ok: true, module_id: mod.id, note: demoNote() });
    },
  }),
  makeTool({
    name: "draft_intake_email",
    description: "Draft the intake questionnaire email (roster, policies, last compliance review, hiring plans, tooling). Approval outbox.",
    properties: {
      client_id: str("Client id"),
      recipient: str("Client contact email"),
      body: str("Intake email text"),
    },
    required: ["body"],
    handler: async (args) =>
      createDraft({
        agent: "client_onboarding",
        channel: "email",
        recipient: args.recipient ? String(args.recipient) : undefined,
        subject: "Welcome to Seeknimbly — intake questionnaire",
        body: String(args.body),
        entity_type: "client",
        entity_id: args.client_id ? String(args.client_id) : undefined,
      }),
  }),
  makeTool({
    name: "day1_compliance_snapshot",
    description:
      "Produce the Day-1 Compliance Snapshot scaffold from the client profile — run the 12-point audit against intake answers; it should catch at least one real gap.",
    properties: { client_id: str("Client id") },
    required: ["client_id"],
    handler: async (args) => {
      const client = await getRow("clients", String(args.client_id));
      if (!client) return JSON.stringify({ ok: false, error: "Client not found" });
      await logAudit({ agent: "client_onboarding", action: "day1_snapshot_started", entity_type: "client", entity_id: String(args.client_id) });
      return JSON.stringify({
        client,
        instruction:
          "Run the 12-point audit checklist against this profile and the intake answers. Score each item pass/gap/unknown. Deliver as a short scored report with the top 3 gaps and fixes first. Include: 'This is guidance, not legal advice.'",
        note: demoNote(),
      });
    },
  }),
  makeTool({
    name: "draft_kickoff_email",
    description:
      "Draft the kickoff email + 30-min call agenda. Set expectations: what agents do autonomously, what always requires client approval, response times. Approval outbox.",
    properties: {
      client_id: str("Client id"),
      recipient: str("Client contact email"),
      body: str("Kickoff email + agenda"),
    },
    required: ["body"],
    handler: async (args) =>
      createDraft({
        agent: "client_onboarding",
        channel: "email",
        recipient: args.recipient ? String(args.recipient) : undefined,
        subject: "Kickoff — your Seeknimbly agents are live",
        body: String(args.body),
        entity_type: "client",
        entity_id: args.client_id ? String(args.client_id) : undefined,
      }),
  }),
  makeTool({
    name: "list_clients",
    description: "List clients and their statuses.",
    properties: { status: str("Filter: onboarding | live | paused | churned (optional)") },
    handler: async (args) => {
      const rows = await listRows("clients", { filters: args.status ? { status: args.status } : {}, limit: 50 });
      return JSON.stringify({ count: rows.length, clients: rows, note: demoNote() });
    },
  }),
];

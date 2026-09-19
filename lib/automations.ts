/**
 * Automations node of the loop: recurring agent work, from the hermes cron
 * design. Each automation runs one agent with a fixed prompt; outputs follow
 * the same rails as interactive runs (drafts → outbox, audit log, memory).
 */

export type Automation = {
  id: string;
  label: string;
  description: string;
  /** Cron expression (5 fields) — used by vercel.json / external scheduler. */
  cron: string;
  cadence: string;
  agent: string;
  prompt: string;
};

export const AUTOMATIONS: Automation[] = [
  {
    id: "law-change-monitor",
    label: "Weekly law-change monitor",
    description: "Scan for employment-law changes in client provinces; draft Change Briefs for approval.",
    cron: "0 9 * * 1",
    cadence: "Mondays 9:00",
    agent: "compliance",
    prompt:
      "Run the weekly law-change monitor. Check list_compliance_calendar and list_compliance_events for anything new or upcoming in ON, BC, AB, QC. For each relevant change produce a Change Brief with draft_change_brief (what changed, effective date, who is affected, required action, draft edit, official source URL). Log new deadlines with log_compliance_event. Summarize what you found and what needs approval.",
  },
  {
    id: "calendar-sweep",
    label: "Monthly compliance calendar sweep",
    description: "Check the compliance calendar against clients; log reminders 10 business days ahead.",
    cron: "0 9 1 * *",
    cadence: "1st of month 9:00",
    agent: "compliance",
    prompt:
      "Run the monthly compliance calendar sweep. Use list_compliance_calendar and log_compliance_event to create reminder events for every deadline applicable in the next 45 days (CRA remittances, T4 season, WSIB/WCB reporting, minimum wage changes). Summarize the reminders created.",
  },
  {
    id: "lead-gen-daily",
    label: "Daily lead-gen cadence",
    description: "Score fresh leads and draft outreach for the top prospects; follow-ups for stale ones.",
    cron: "0 8 * * 1-5",
    cadence: "Weekdays 8:00",
    agent: "lead_gen",
    prompt:
      "Morning cadence: use list_leads to review the pipeline. Draft outreach (draft_outreach) for up to 3 'new' leads with score >= 50, and follow-up drafts for leads in 'contacted' with 4+ days since last touch and fewer than 3 touches. Respect CASL. Recall memories about what outreach worked before. Summarize the drafts created for approval.",
  },
  {
    id: "onboarding-checkins",
    label: "Onboarding check-in sweep",
    description: "Surface due 7/30/60/90-day check-ins and overdue statutory tasks.",
    cron: "0 9 * * *",
    cadence: "Daily 9:00",
    agent: "onboarding",
    prompt:
      "Daily sweep: use list_onboarding_status to find check-in tasks and statutory tasks due today or overdue across all hires. Summarize by hire what needs action, most urgent first. Flag anything statutory that is overdue.",
  },
  {
    id: "sales-followups",
    label: "Sales follow-up sweep",
    description: "Same-day reply drafts and call prep for active deals.",
    cron: "0 10 * * 1-5",
    cadence: "Weekdays 10:00",
    agent: "sales",
    prompt:
      "Review list_leads for stages replied, call_booked, proposal, negotiating. For replied leads draft_reply proposing 2-3 time slots. For call_booked leads produce call_prep_onepager. Recall relevant objection memories first. Summarize drafts created for approval.",
  },
];

export function getAutomation(id: string): Automation | undefined {
  return AUTOMATIONS.find((a) => a.id === id);
}

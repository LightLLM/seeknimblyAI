/**
 * Memory node of the loop: every agent can persist learnings and recall them.
 * Per AGENTS.md, outcome data (what worked, client preferences, objections and
 * responses, compliance events caught) is the company's primary moat.
 */

import { insertRow, listRows } from "@/lib/store";
import { logAudit } from "@/lib/audit";
import { makeTool, str, num, demoNote } from "@/lib/agents/tool-helpers";
import type { AgentTool } from "@/lib/agents/types";

export const MEMORY_KINDS = ["outcome", "preference", "objection", "learning", "compliance_catch"] as const;

export function memoryTools(agentId: string): AgentTool[] {
  return [
    makeTool({
      name: "save_memory",
      description:
        "Persist a durable learning: prospect interaction outcomes, client preferences, objections + the response that worked, compliance events caught. This outcome data is the company's moat — save it whenever you learn something reusable.",
      properties: {
        kind: str(`One of: ${MEMORY_KINDS.join(" | ")}`),
        content: str("The learning, specific and reusable (1-3 sentences)"),
        subject: str("Who/what it is about, e.g. client name, province, objection type"),
      },
      required: ["kind", "content"],
      handler: async (args) => {
        const kind = MEMORY_KINDS.includes(args.kind as (typeof MEMORY_KINDS)[number])
          ? String(args.kind)
          : "learning";
        const row = await insertRow("memories", {
          agent: agentId,
          kind,
          subject: args.subject ?? null,
          content: String(args.content).slice(0, 2000),
        });
        await logAudit({ agent: agentId, action: `memory_saved:${kind}`, entity_type: "memory", entity_id: String(row.id), detail: String(args.subject ?? "") });
        return JSON.stringify({ ok: true, memory_id: row.id, note: demoNote() });
      },
    }),
    makeTool({
      name: "recall_memories",
      description:
        "Recall saved memories before acting: check past outcomes, client preferences, and objection responses. Optionally filter by keyword and kind.",
      properties: {
        query: str("Keyword to match against content/subject (optional)"),
        kind: str(`Filter: ${MEMORY_KINDS.join(" | ")} (optional)`),
        limit: num("Max results (default 10)"),
      },
      handler: async (args) => {
        const rows = await listRows("memories", {
          filters: args.kind ? { kind: args.kind } : {},
          limit: 200,
        });
        const q = args.query ? String(args.query).toLowerCase() : null;
        const matched = (q
          ? rows.filter(
              (r) =>
                String(r.content ?? "").toLowerCase().includes(q) ||
                String(r.subject ?? "").toLowerCase().includes(q)
            )
          : rows
        ).slice(0, Math.min(Number(args.limit) || 10, 50));
        return JSON.stringify({ count: matched.length, memories: matched, note: demoNote() });
      },
    }),
  ];
}

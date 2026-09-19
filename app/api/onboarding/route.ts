/** GET /api/onboarding — hires + tasks for the org (F5 checklist dashboard). */

import { NextRequest, NextResponse } from "next/server";
import { requireUser, withOrgScope } from "@/lib/api-auth";
import { listRows, updateRow } from "@/lib/store";
import { z } from "zod";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  return withOrgScope(auth.org.orgId, async () => {
    const [hires, tasks] = await Promise.all([
      listRows("hires", { limit: 100 }),
      listRows("onboarding_tasks", { limit: 500 }),
    ]);
    return NextResponse.json({
      hires: hires.map((h) => ({
        ...h,
        tasks: tasks.filter((t) => String(t.hire_id) === String(h.id)),
      })),
      overdue: tasks.filter((t) => {
        if (t.status === "done") return false;
        if (!t.due_date) return false;
        return new Date(String(t.due_date)).getTime() < Date.now();
      }),
    });
  });
}

const PatchBody = z.object({
  task_id: z.string().min(1),
  status: z.enum(["pending", "done", "blocked"]),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  return withOrgScope(auth.org.orgId, async () => {
    const updated = await updateRow("onboarding_tasks", body.task_id, { status: body.status });
    if (!updated) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    await logAudit({
      agent: "onboarding",
      action: `task_${body.status}`,
      actor: auth.email,
      entity_type: "onboarding_task",
      entity_id: body.task_id,
    });
    return NextResponse.json({ ok: true, task: updated });
  });
}

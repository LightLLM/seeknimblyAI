/**
 * 90-day retention sweep: promote hires past day 90 to retained_90d when still
 * active; leave exited alone. Deterministic companion to update_hire_status.
 */

import { listRows, updateRow } from "@/lib/store";
import { logAudit } from "@/lib/audit";

export type RetentionSweepResult = {
  scanned: number;
  promoted: number;
};

const ACTIVE = new Set(["pre_start", "week_1", "ramping", "active"]);

export async function runRetentionSweep(now = Date.now()): Promise<RetentionSweepResult> {
  const hires = await listRows("hires", { limit: 500 });
  let promoted = 0;
  for (const hire of hires) {
    const status = String(hire.status ?? "");
    if (status === "retained_90d" || status === "exited") continue;
    if (!ACTIVE.has(status) && status !== "") continue;
    if (!hire.start_date) continue;
    const start = new Date(String(hire.start_date)).getTime();
    if (!Number.isFinite(start)) continue;
    const days = (now - start) / (1000 * 60 * 60 * 24);
    if (days < 90) continue;
    if (status === "retained_90d" || status === "exited") continue;
    await updateRow("hires", String(hire.id), { status: "retained_90d" });
    promoted++;
    await logAudit({
      agent: "onboarding",
      action: "hire_retained_90d",
      entity_type: "hire",
      entity_id: String(hire.id),
      detail: String(hire.name ?? ""),
    });
  }
  return { scanned: hires.length, promoted };
}

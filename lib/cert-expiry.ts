/**
 * Certification expiry sweep — marks lapsed certs and logs reminder events
 * for items expiring within `withinDays` (default 30). Deterministic; no LLM.
 */

import { listRows, updateRow, insertRow } from "@/lib/store";
import { logAudit } from "@/lib/audit";

export type CertExpiryResult = {
  scanned: number;
  expired: number;
  reminders: number;
};

function daysUntil(iso: string, now = Date.now()): number {
  return (new Date(iso).getTime() - now) / (1000 * 60 * 60 * 24);
}

export async function runCertExpirySweep(opts: { withinDays?: number } = {}): Promise<CertExpiryResult> {
  const withinDays = opts.withinDays ?? 30;
  const items = await listRows("learning_items", { limit: 500 });
  const certs = items.filter((i) => String(i.kind) === "certification" && i.expiry_date);
  let expired = 0;
  let reminders = 0;

  for (const cert of certs) {
    const expiry = String(cert.expiry_date);
    const days = daysUntil(expiry);
    if (days < 0 && String(cert.status) !== "expired") {
      await updateRow("learning_items", String(cert.id), { status: "expired" });
      expired++;
      await insertRow("compliance_events", {
        kind: "reminder",
        title: `Certification expired: ${cert.title}`,
        detail: `Expired on ${expiry}. Renew or remove from active roster.`,
        status: "open",
        due_date: expiry,
      });
      await logAudit({
        agent: "training",
        action: "certification_expired",
        entity_type: "learning_item",
        entity_id: String(cert.id),
        detail: String(cert.title).slice(0, 200),
      });
    } else if (days >= 0 && days <= withinDays && String(cert.status) !== "expired") {
      const existing = await listRows("compliance_events", {
        filters: { kind: "reminder", status: "open" },
        limit: 100,
      });
      const already = existing.some(
        (e) =>
          String(e.title).includes(String(cert.title)) &&
          String(e.detail ?? "").includes(String(cert.id))
      );
      if (!already) {
        await insertRow("compliance_events", {
          kind: "reminder",
          title: `Certification expiring soon: ${cert.title}`,
          detail: `learning_item ${cert.id} expires ${expiry} (in ${Math.ceil(days)} days).`,
          status: "open",
          due_date: expiry,
        });
        reminders++;
        await logAudit({
          agent: "training",
          action: "certification_expiry_reminder",
          entity_type: "learning_item",
          entity_id: String(cert.id),
          detail: `expires ${expiry}`,
        });
      }
    }
  }

  return { scanned: certs.length, expired, reminders };
}

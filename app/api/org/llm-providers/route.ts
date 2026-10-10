/**
 * GET/PUT /api/org/llm-providers — workspace AI provider allowlist.
 * null allowed = all providers; array restricts customer chat to those vendors.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, withOrgScope } from "@/lib/api-auth";
import {
  LLM_PROVIDER_IDS,
  LLM_PROVIDER_LABELS,
  getOrgAllowedProviders,
  setOrgAllowedProviders,
  isModelProvider,
} from "@/lib/org-llm";
import { getProviderAvailability } from "@/lib/llm";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  return withOrgScope(auth.org.orgId, async () => {
    const allowed = await getOrgAllowedProviders(auth.org.orgId);
    const serverAvail = getProviderAvailability();
    return NextResponse.json({
      allowed,
      providers: LLM_PROVIDER_IDS.map((id) => ({
        id,
        label: LLM_PROVIDER_LABELS[id],
        serverConfigured: serverAvail[id],
        enabled: allowed == null ? true : allowed.includes(id),
      })),
    });
  });
}

const BODY = z.object({
  /** null clears the allowlist (all providers). Non-empty array restricts. */
  allowed: z.array(z.string()).nullable(),
});

export async function PUT(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  if (auth.org.role !== "owner" && auth.org.role !== "admin") {
    return NextResponse.json({ error: "Only owners/admins can change AI providers." }, { status: 403 });
  }

  let body: z.infer<typeof BODY>;
  try {
    body = BODY.parse(await req.json());
  } catch (e) {
    const message = e instanceof z.ZodError ? e.errors.map((x) => x.message).join("; ") : "Invalid body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const providers =
    body.allowed == null ? null : body.allowed.filter(isModelProvider);

  if (body.allowed != null && providers!.length === 0) {
    return NextResponse.json(
      { error: "Select at least one provider, or send null to allow all." },
      { status: 400 }
    );
  }

  return withOrgScope(auth.org.orgId, async () => {
    const allowed = await setOrgAllowedProviders(auth.org.orgId, providers);
    await logAudit({
      agent: "system",
      action: "org_llm_providers_updated",
      actor: auth.email,
      status: "ok",
      detail: allowed == null ? "all" : allowed.join(","),
    });
    return NextResponse.json({ allowed });
  });
}

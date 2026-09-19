/**
 * Org membership + invites. First login creates a personal org; owners can
 * invite teammates so multiple people share one tenant (channel partners, ops).
 */

import { randomBytes } from "crypto";
import { insertRow, listRows, updateRow, getRow, deleteRow, isSupabaseConfigured } from "@/lib/store";

export type OrgContext = {
  orgId: string;
  email: string;
  role: string;
  orgName: string;
};

export async function resolveOrgForEmail(email: string): Promise<OrgContext> {
  const normalized = email.trim().toLowerCase();
  const memberships = await listRows("org_members", {
    filters: { email: normalized },
    limit: 1,
    orderBy: "created_at",
    ascending: true,
    skipOrgScope: true,
  });
  if (memberships[0]?.org_id) {
    const org = await getRow("orgs", String(memberships[0].org_id));
    return {
      orgId: String(memberships[0].org_id),
      email: normalized,
      role: String(memberships[0].role ?? "member"),
      orgName: String(org?.name ?? "Workspace"),
    };
  }

  const org = await insertRow("orgs", {
    name: `${normalized}'s workspace`,
  });
  await insertRow("org_members", {
    org_id: org.id,
    email: normalized,
    role: "owner",
  });
  return {
    orgId: String(org.id),
    email: normalized,
    role: "owner",
    orgName: String(org.name),
  };
}

export async function listOrgMembers(orgId: string) {
  return listRows("org_members", {
    filters: { org_id: orgId },
    limit: 100,
    skipOrgScope: true,
    orderBy: "created_at",
    ascending: true,
  });
}

export async function createInvite(params: {
  orgId: string;
  email: string;
  role: "admin" | "member";
  invitedBy: string;
}): Promise<{ token: string; id: string }> {
  const email = params.email.trim().toLowerCase();
  const existingMembers = await listRows("org_members", {
    filters: { org_id: params.orgId, email },
    limit: 1,
    skipOrgScope: true,
  });
  if (existingMembers.length > 0) {
    throw new Error("That email is already a member of this workspace.");
  }
  const token = randomBytes(24).toString("hex");
  const row = await insertRow("org_invites", {
    org_id: params.orgId,
    email,
    role: params.role,
    token,
    invited_by: params.invitedBy,
    status: "pending",
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  return { token, id: String(row.id) };
}

export async function listPendingInvites(orgId: string) {
  const rows = await listRows("org_invites", {
    filters: { org_id: orgId, status: "pending" },
    limit: 50,
    skipOrgScope: true,
  });
  return rows;
}

export async function acceptInvite(token: string, acceptorEmail: string): Promise<OrgContext> {
  const email = acceptorEmail.trim().toLowerCase();
  const invites = await listRows("org_invites", {
    filters: { token, status: "pending" },
    limit: 1,
    skipOrgScope: true,
  });
  const invite = invites[0];
  if (!invite) throw new Error("Invite not found or already used.");
  if (String(invite.email).toLowerCase() !== email) {
    throw new Error("Sign in with the invited email address to accept.");
  }
  if (String(invite.status) === "revoked") {
    throw new Error("This invite was revoked.");
  }
  if (invite.expires_at && new Date(String(invite.expires_at)).getTime() < Date.now()) {
    throw new Error("This invite has expired.");
  }
  const orgId = String(invite.org_id);
  const existing = await listRows("org_members", {
    filters: { org_id: orgId, email },
    limit: 1,
    skipOrgScope: true,
  });
  if (existing.length === 0) {
    await insertRow("org_members", {
      org_id: orgId,
      email,
      role: invite.role ?? "member",
    });
  }
  await updateRow("org_invites", String(invite.id), {
    status: "accepted",
    accepted_at: new Date().toISOString(),
  });
  const org = await getRow("orgs", orgId);
  return {
    orgId,
    email,
    role: String(invite.role ?? "member"),
    orgName: String(org?.name ?? "Workspace"),
  };
}

export async function revokeInvite(orgId: string, inviteId: string): Promise<void> {
  const invite = await getRow("org_invites", inviteId);
  if (!invite || String(invite.org_id) !== orgId) {
    throw new Error("Invite not found.");
  }
  if (String(invite.status) !== "pending") {
    throw new Error("Only pending invites can be revoked.");
  }
  await updateRow("org_invites", inviteId, {
    status: "revoked",
    revoked_at: new Date().toISOString(),
  });
}

export async function removeOrgMember(params: {
  orgId: string;
  memberId: string;
  actorEmail: string;
  actorRole: string;
}): Promise<void> {
  const members = await listOrgMembers(params.orgId);
  const target = members.find((m) => String(m.id) === params.memberId);
  if (!target) throw new Error("Member not found.");
  if (String(target.email).toLowerCase() === params.actorEmail.trim().toLowerCase()) {
    throw new Error("You cannot remove yourself.");
  }
  const targetRole = String(target.role ?? "member");
  if (targetRole === "owner") {
    throw new Error("Cannot remove the workspace owner.");
  }
  if (params.actorRole === "admin" && targetRole === "admin") {
    throw new Error("Admins cannot remove other admins.");
  }
  if (params.actorRole !== "owner" && params.actorRole !== "admin") {
    throw new Error("Only owners/admins can remove members.");
  }
  const ok = await deleteRow("org_members", params.memberId);
  if (!ok) throw new Error("Member not found.");
}

export function orgConfiguredNote(): string | undefined {
  if (!isSupabaseConfigured()) {
    return "demo mode: org scoping is in-memory only";
  }
  return undefined;
}

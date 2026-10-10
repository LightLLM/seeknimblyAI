/**
 * App user accounts (email/password + OAuth). Separate from Supabase Auth.
 */

import { insertRow, listRows, updateRow } from "@/lib/store";
import { hashPassword, verifyPassword } from "@/lib/password";

export type AppUser = {
  id: string;
  email: string;
  password_hash: string | null;
  name: string | null;
  providers: string[];
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseProviders(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return raw ? [raw] : [];
    }
  }
  return [];
}

function toAppUser(row: Record<string, unknown>): AppUser {
  return {
    id: String(row.id),
    email: String(row.email),
    password_hash: row.password_hash != null ? String(row.password_hash) : null,
    name: row.name != null ? String(row.name) : null,
    providers: parseProviders(row.providers),
  };
}

export async function findUserByEmail(email: string): Promise<AppUser | null> {
  const normalized = normalizeEmail(email);
  const rows = await listRows("app_users", {
    filters: { email: normalized },
    limit: 1,
    skipOrgScope: true,
  });
  return rows[0] ? toAppUser(rows[0]) : null;
}

export async function createPasswordUser(params: {
  email: string;
  password: string;
  name?: string;
}): Promise<AppUser> {
  const email = normalizeEmail(params.email);
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error("An account with this email already exists. Sign in instead.");
  }
  const password_hash = await hashPassword(params.password);
  const name = params.name?.trim() || email.split("@")[0] || email;
  const row = await insertRow("app_users", {
    email,
    password_hash,
    name,
    providers: ["credentials"],
  });
  return toAppUser(row);
}

/** Upsert OAuth identity; links provider onto existing email account. */
export async function ensureOAuthUser(params: {
  email: string;
  name?: string | null;
  provider: string;
}): Promise<AppUser> {
  const email = normalizeEmail(params.email);
  const existing = await findUserByEmail(email);
  if (existing) {
    const providers = Array.from(new Set([...existing.providers, params.provider]));
    const patch: Record<string, unknown> = { providers };
    if (!existing.name && params.name) patch.name = params.name;
    await updateRow("app_users", existing.id, patch);
    return { ...existing, providers, name: (patch.name as string) ?? existing.name };
  }
  const row = await insertRow("app_users", {
    email,
    password_hash: null,
    name: params.name?.trim() || email.split("@")[0] || email,
    providers: [params.provider],
  });
  return toAppUser(row);
}

export async function authenticatePasswordUser(
  email: string,
  password: string
): Promise<AppUser | null> {
  const user = await findUserByEmail(email);
  if (!user?.password_hash) return null;
  const ok = await verifyPassword(password, user.password_hash);
  return ok ? user : null;
}

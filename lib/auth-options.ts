/**
 * Shared NextAuth options — credentials (users + admin + magic link),
 * Google, and Microsoft (Azure AD) when env keys are present.
 */

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  authenticatePasswordUser,
  ensureOAuthUser,
} from "@/lib/users";
import { isSupabaseConfigured } from "@/lib/store";

export function googleAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

export function microsoftAuthConfigured(): boolean {
  return Boolean(
    process.env.AZURE_AD_CLIENT_ID?.trim() &&
      process.env.AZURE_AD_CLIENT_SECRET?.trim() &&
      process.env.AZURE_AD_TENANT_ID?.trim()
  );
}

export function buildAuthOptions(): NextAuthOptions {
  const providers: NextAuthOptions["providers"] = [
    CredentialsProvider({
      id: "credentials",
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        token: { label: "Magic token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials) return null;

        // Magic-link trial
        if (credentials.token && typeof credentials.token === "string") {
          if (!isSupabaseConfigured()) return null;
          try {
            const supabase = getSupabaseAdmin();
            const { data: row, error: fetchError } = await supabase
              .from("trial_signups")
              .select("id, email, company_name")
              .eq("token", credentials.token)
              .is("used_at", null)
              .gt("token_expires_at", new Date().toISOString())
              .single();

            if (fetchError || !row) return null;

            const { error: updateError } = await supabase
              .from("trial_signups")
              .update({ used_at: new Date().toISOString() })
              .eq("id", row.id);

            if (updateError) return null;

            const email = String(row.email).trim().toLowerCase();
            const name =
              (row.company_name as string) || email.split("@")[0] || email;
            const user = await ensureOAuthUser({
              email,
              name,
              provider: "magic-link",
            });
            return { id: user.id, email: user.email, name: user.name ?? name };
          } catch {
            return null;
          }
        }

        if (!credentials.email || !credentials.password) return null;
        const email = String(credentials.email).trim().toLowerCase();
        const password = String(credentials.password);

        // Env admin bypass (ops)
        const adminEmail = process.env.AUTH_EMAIL?.trim().toLowerCase();
        const adminPassword = process.env.AUTH_PASSWORD;
        if (adminEmail && adminPassword && email === adminEmail && password === adminPassword) {
          return {
            id: "admin",
            email: adminEmail,
            name: adminEmail.split("@")[0],
          };
        }

        const user = await authenticatePasswordUser(email, password);
        if (!user) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email.split("@")[0],
        };
      },
    }),
  ];

  if (googleAuthConfigured()) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!.trim(),
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
        allowDangerousEmailAccountLinking: true,
      })
    );
  }

  if (microsoftAuthConfigured()) {
    providers.push(
      AzureADProvider({
        clientId: process.env.AZURE_AD_CLIENT_ID!.trim(),
        clientSecret: process.env.AZURE_AD_CLIENT_SECRET!.trim(),
        tenantId: process.env.AZURE_AD_TENANT_ID!.trim(),
        allowDangerousEmailAccountLinking: true,
      })
    );
  }

  return {
    providers,
    session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
    pages: { signIn: "/login" },
    callbacks: {
      async signIn({ user, account }) {
        if (!user.email) return false;
        if (account?.provider && account.provider !== "credentials") {
          try {
            await ensureOAuthUser({
              email: user.email,
              name: user.name,
              provider: account.provider,
            });
          } catch (e) {
            console.error("[auth] ensureOAuthUser failed:", e);
            return false;
          }
        }
        return true;
      },
      async jwt({ token, user }) {
        if (user) {
          token.id = user.id;
          token.email = user.email;
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.id = token.id as string;
          session.user.email = token.email as string;
        }
        return session;
      },
    },
    secret: process.env.NEXTAUTH_SECRET,
  };
}

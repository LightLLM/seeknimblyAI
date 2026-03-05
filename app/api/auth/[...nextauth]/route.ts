import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getSupabaseAdmin } from "@/lib/supabase";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        token: { label: "Magic token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials) return null;

        if (credentials.token && typeof credentials.token === "string") {
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

            const name = (row.company_name as string) || (row.email as string).split("@")[0];
            return {
              id: String(row.id),
              email: row.email as string,
              name: name || (row.email as string).split("@")[0],
            };
          } catch {
            return null;
          }
        }

        if (!credentials?.email || !credentials?.password) return null;
        const email = process.env.AUTH_EMAIL;
        const password = process.env.AUTH_PASSWORD;
        if (!email || !password) return null;
        if (credentials.email === email && credentials.password === password) {
          return { id: "1", email: credentials.email, name: credentials.email.split("@")[0] };
        }
        return null;
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  callbacks: {
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
});

export { handler as GET, handler as POST };

import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { accounts, db, sessions, users, verificationTokens } from "@itsm/db";
import { findUserByEmail, loginSchema, resolveAuthContext, verifyPassword } from "@itsm/core";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { OIDCConfig } from "next-auth/providers";

/**
 * Generic OIDC provider (Google Workspace, Azure AD / Entra ID, Okta,
 * Auth0, or any other OIDC-compliant IdP), configured entirely via
 * environment variables. This is the chosen architecture for enterprise
 * SSO here: lean on Auth.js's native OIDC support (it does the
 * discovery/PKCE/token exchange for you) instead of hardcoding specific
 * providers or hand-rolling an OIDC client, unlike GLPI. SAML is
 * deliberately deferred and not implemented.
 *
 * Returns `null` when the 3 env vars aren't all set, so the provider is
 * simply omitted from `providers` below and login keeps working with
 * Credentials only - adding SSO later is a config change, not a code change.
 */
function genericOidcProvider(): OIDCConfig<Record<string, unknown>> | null {
  const issuer = process.env.OIDC_ISSUER;
  const clientId = process.env.OIDC_CLIENT_ID;
  const clientSecret = process.env.OIDC_CLIENT_SECRET;
  if (!issuer || !clientId || !clientSecret) return null;

  return {
    id: "oidc",
    name: "SSO",
    type: "oidc",
    issuer,
    clientId,
    clientSecret,
  };
}

const oidcProvider = genericOidcProvider();

declare module "next-auth" {
  interface Session {
    userId: string;
    activeEntityId: string | null;
    activeProfileId: string | null;
  }
}

// Augmenting "next-auth/jwt" directly fails (TS2664): that module is a pure
// `export * from "@auth/core/jwt"` re-export barrel, which TypeScript can't
// target for augmentation - documented Auth.js v5 limitation. Augment the
// underlying @auth/core module instead (added as an explicit devDependency).
declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    activeEntityId?: string | null;
    activeProfileId?: string | null;
  }
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // Credentials provider only supports JWT sessions in Auth.js (no OAuth
  // account row to persist a DB session against). "Switch active
  // entity/profile without re-login" is implemented via the `update()`
  // trigger below instead of a mutable DB session row.
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await findUserByEmail(parsed.data.email);
        if (!user || !user.isActive) return null;

        const valid = await verifyPassword(user, parsed.data.password);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.displayName };
      },
    }),
    ...(oidcProvider ? [oidcProvider] : []),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user?.id) {
        token.userId = user.id;
        // Resolve the default entity/profile immediately so the first
        // request post-login already has a usable active context.
        const context = await resolveAuthContext({
          userId: user.id,
          activeEntityId: null,
          activeProfileId: null,
        });
        token.activeEntityId = context?.activeEntity.id ?? null;
        token.activeProfileId = context?.activeProfile.id ?? null;
      }

      if (trigger === "update" && session) {
        if ("activeEntityId" in session) token.activeEntityId = session.activeEntityId;
        if ("activeProfileId" in session) token.activeProfileId = session.activeProfileId;
      }

      return token;
    },
    async session({ session, token }) {
      session.userId = token.userId as string;
      session.activeEntityId = (token.activeEntityId as string | null) ?? null;
      session.activeProfileId = (token.activeProfileId as string | null) ?? null;
      return session;
    },
  },
});

import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { accounts, db, sessions, users, verificationTokens } from "@itsm/db";
import { resolveAuthContext, stampLastLogin, verifyLoginCode, verifyPrimaryFactor } from "@itsm/core";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { OIDCConfig } from "next-auth/providers";
import { cache } from "react";

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
    language: string;
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
    language?: string;
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
        code: { label: "Code", type: "text" },
      },
      // Two-factor is opt-in per user (users.two_factor_enabled, off by
      // default - see /account). For a 2FA user, this only ever runs as the
      // SECOND step (see loginAction in apps/web/actions/auth.actions.ts) -
      // the first step already verified email+password via
      // verifyPrimaryFactor and emailed a code, without calling signIn at
      // all. Users without 2FA enabled sign in directly on the first step,
      // same as before this feature existed.
      async authorize(raw) {
        const user = await verifyPrimaryFactor(raw?.email, raw?.password);
        if (!user) return null;

        if (user.twoFactorEnabled) {
          const code = typeof raw?.code === "string" ? raw.code : "";
          const codeValid = await verifyLoginCode(user.id, code);
          if (!codeValid) return null;
        }

        return user;
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
        // context.user is the full users row resolveAuthContext already fetched -
        // reuse it instead of a second query just for language.
        token.language = context?.user.language ?? "es";
        // Fires exactly once per sign-in (this branch only runs when `user` is present,
        // i.e. right after `authorize()` succeeds) - covers both the local and LDAP paths
        // without duplicating the call in authorize()'s two return branches.
        await stampLastLogin(user.id);
      }

      if (trigger === "update" && session) {
        if ("activeEntityId" in session) token.activeEntityId = session.activeEntityId;
        if ("activeProfileId" in session) token.activeProfileId = session.activeProfileId;
        if ("language" in session) token.language = session.language;
      }

      return token;
    },
    async session({ session, token }) {
      session.userId = token.userId as string;
      session.activeEntityId = (token.activeEntityId as string | null) ?? null;
      session.activeProfileId = (token.activeProfileId as string | null) ?? null;
      session.language = (token.language as string | undefined) ?? "es";
      return session;
    },
  },
});

/**
 * `auth()` itself is NOT wrapped in React `cache()` by next-auth - every direct
 * call re-runs the full JWT decode + `jwt`/`session` callback pair from scratch.
 * This wrapper memoizes it per request so every module that needs the session
 * (lib/session.ts, i18n/request.ts, ...) shares a single decode instead of
 * each paying the cost independently.
 */
export const getSession = cache(() => auth());

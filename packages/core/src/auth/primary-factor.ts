import { listAllEntities } from "../entities/entity-service";
import { findUserByEmail, verifyPassword } from "../users/user-service";
import { assignEntityAndProfileFromLdap, syncLdapUser, tryLdapLogin } from "./ldap-service";
import { loginSchema } from "../validation/user.zod";

export interface PrimaryFactorResult {
  id: string;
  email: string;
  name: string | null;
  twoFactorEnabled: boolean;
}

/**
 * Verifies email+password (local account, falling back to LDAP) without
 * touching 2FA at all - shared by the login form's "check password, then
 * send a code" step and Auth.js's `authorize()` (which additionally
 * requires the code before returning a session). Kept here instead of
 * inline in apps/web/lib/auth.ts so both call sites can't drift apart.
 */
export async function verifyPrimaryFactor(rawEmail: unknown, rawPassword: unknown): Promise<PrimaryFactorResult | null> {
  const parsed = loginSchema.safeParse({ email: rawEmail, password: rawPassword });
  if (!parsed.success) return null;

  const existingUser = await findUserByEmail(parsed.data.email);
  // A deactivated account can't log in via either path - LDAP falling back to
  // re-enable a locally-deactivated user would defeat the point of deactivating it.
  if (existingUser && !existingUser.isActive) return null;

  if (existingUser) {
    const valid = await verifyPassword(existingUser, parsed.data.password);
    if (valid) {
      return {
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.displayName,
        twoFactorEnabled: existingUser.twoFactorEnabled,
      };
    }
  }

  // No local account, or the local password didn't match - fall back to LDAP.
  // `tryLdapLogin` is a no-op (returns null) when no active ldap_auth_sources
  // are configured, so this is always safe to attempt.
  const ldapResult = await tryLdapLogin(parsed.data.email, parsed.data.password);
  if (!ldapResult) return null;

  const syncedUser = await syncLdapUser(ldapResult.ldapAttributes, ldapResult.source);
  if (!syncedUser.isActive) return null;

  if (!existingUser) {
    // Only run entity/profile assignment rules on first sync, not on every
    // subsequent LDAP login - assignUserProfile has no unique constraint on
    // (userId, entityId, profileId), see assignEntityAndProfileFromLdap's doc comment.
    const rootEntity = (await listAllEntities()).find((e) => e.parentId === null);
    if (rootEntity) {
      await assignEntityAndProfileFromLdap(syncedUser.id, ldapResult.ldapAttributes, rootEntity.id);
    }
  }

  return {
    id: syncedUser.id,
    email: syncedUser.email,
    name: syncedUser.displayName,
    twoFactorEnabled: syncedUser.twoFactorEnabled,
  };
}

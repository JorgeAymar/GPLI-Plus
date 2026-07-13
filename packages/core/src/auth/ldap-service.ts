import { eq } from "drizzle-orm";
import { db, ldapAuthSources, type LdapAuthSource, type User } from "@itsm/db";
// ldapjs has no first-class ESM/promise API - it's the classic Node
// callback-style client (bind/search/unbind all take `(err, ...) => void`).
// @types/ldapjs models this faithfully; every call below is wrapped in
// `new Promise(...)` to bridge it into the async/await style used elsewhere
// in this package.
import ldap from "ldapjs";
import crypto from "node:crypto";
import { assignUserProfile } from "../rbac/profile-service";
import { evaluateRules } from "../rules/rule-engine";
import { createUser, findUserByEmail } from "../users/user-service";

export async function createLdapAuthSource(input: {
  name: string;
  host: string;
  port?: number;
  baseDn: string;
  bindDn: string;
  bindPasswordEncrypted: string;
  loginField?: string;
  syncField: string;
  groupField?: string | null;
  useTls?: boolean;
  isActive?: boolean;
}): Promise<LdapAuthSource> {
  const [created] = await db
    .insert(ldapAuthSources)
    .values({
      name: input.name,
      host: input.host,
      port: input.port ?? 389,
      baseDn: input.baseDn,
      bindDn: input.bindDn,
      bindPasswordEncrypted: input.bindPasswordEncrypted,
      loginField: input.loginField ?? "uid",
      syncField: input.syncField,
      groupField: input.groupField ?? null,
      useTls: input.useTls ?? false,
      isActive: input.isActive ?? true,
    })
    .returning();
  if (!created) throw new Error("Failed to insert ldap_auth_sources row");
  return created;
}

export async function listLdapAuthSources(): Promise<LdapAuthSource[]> {
  return db.select().from(ldapAuthSources).orderBy(ldapAuthSources.name);
}

export async function getActiveLdapAuthSources(): Promise<LdapAuthSource[]> {
  return db.select().from(ldapAuthSources).where(eq(ldapAuthSources.isActive, true)).orderBy(ldapAuthSources.name);
}

function bindAsync(client: ldap.Client, dn: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    client.bind(dn, password, (err) => (err ? reject(err) : resolve()));
  });
}

function searchAsync(client: ldap.Client, base: string, options: ldap.SearchOptions): Promise<ldap.SearchEntry[]> {
  return new Promise((resolve, reject) => {
    client.search(base, options, (err, res) => {
      if (err) {
        reject(err);
        return;
      }
      const entries: ldap.SearchEntry[] = [];
      res.on("searchEntry", (entry) => entries.push(entry));
      res.on("error", (searchErr) => reject(searchErr));
      res.on("end", () => resolve(entries));
    });
  });
}

function unbindAsync(client: ldap.Client): Promise<void> {
  return new Promise((resolve) => {
    client.unbind(() => resolve());
  });
}

/**
 * Escapes a value per RFC 4515 before interpolating it into an LDAP search
 * filter string - `username` here is attacker-controlled (it's the login
 * form field), so without this a value like `*)(uid=*` could widen or
 * hijack the search filter (LDAP filter injection).
 */
function escapeLdapFilterValue(value: string): string {
  return value.replace(/[\\*()\0]/g, (char) => {
    switch (char) {
      case "\\":
        return "\\5c";
      case "*":
        return "\\2a";
      case "(":
        return "\\28";
      case ")":
        return "\\29";
      default:
        return "\\00";
    }
  });
}

/** Flattens an ldapjs SearchEntry's attributes into a plain string map, plus its DN under "dn". */
function entryToAttributes(entry: ldap.SearchEntry): Record<string, string> {
  const attrs: Record<string, string> = { dn: entry.objectName ?? "" };
  for (const attribute of entry.attributes) {
    const values = attribute.values;
    const first = Array.isArray(values) ? values[0] : values;
    if (first !== undefined) attrs[attribute.type] = first;
  }
  return attrs;
}

/**
 * Tries every active LDAP source in turn: bind as the source's service
 * account, search for `username` under its baseDn, then re-bind as the
 * found entry's DN with the user-supplied password to actually verify it
 * (LDAP servers don't expose password hashes, so a successful bind is the
 * only way to check a password). The first source where both binds and the
 * search succeed wins; any failure at any step falls through to the next
 * configured source rather than aborting the whole login attempt.
 */
export async function tryLdapLogin(
  username: string,
  password: string,
): Promise<{ ldapAttributes: Record<string, string>; source: LdapAuthSource } | null> {
  const sources = await getActiveLdapAuthSources();

  for (const source of sources) {
    const protocol = source.useTls ? "ldaps" : "ldap";
    const client = ldap.createClient({ url: `${protocol}://${source.host}:${source.port}`, reconnect: false });
    // Connection-level errors (e.g. ECONNREFUSED) emit on the client itself;
    // without a listener Node treats an unhandled "error" event as a thrown
    // exception. The corresponding bind/search call below still gets the
    // same error via its own callback, so it's safe to swallow it here.
    client.on("error", () => {});

    try {
      await bindAsync(client, source.bindDn, source.bindPasswordEncrypted);

      const entries = await searchAsync(client, source.baseDn, {
        scope: "sub",
        filter: `(${source.loginField}=${escapeLdapFilterValue(username)})`,
        attributes: [],
      });

      const [entry] = entries;
      if (!entry?.objectName) continue;

      await bindAsync(client, entry.objectName, password);

      return { ldapAttributes: entryToAttributes(entry), source };
    } catch {
      // This source failed (bad service-account bind, user not found, wrong
      // password, network error, ...) - fall through to the next source.
    } finally {
      await unbindAsync(client);
    }
  }

  return null;
}

/**
 * Finds or creates the local user matching an LDAP entry. Lookup is by
 * email (`mail`), mirroring how GLPI reconciles LDAP identities to local
 * accounts. A brand-new user gets a random local password: it's never
 * actually used to authenticate, since a user synced from LDAP always logs
 * in via `tryLdapLogin` (the local password hash only exists to satisfy the
 * NOT NULL / createUser contract, not as an alternate login path).
 */
export async function syncLdapUser(ldapAttributes: Record<string, string>, source: LdapAuthSource): Promise<User> {
  const email = ldapAttributes.mail ?? ldapAttributes.email;
  if (!email) {
    throw new Error(`LDAP entry from source "${source.name}" has no "mail"/"email" attribute - cannot sync user`);
  }

  const existing = await findUserByEmail(email);
  if (existing) return existing;

  const username = ldapAttributes[source.loginField] ?? ldapAttributes.uid ?? email;
  const displayName = ldapAttributes.displayName ?? ldapAttributes.cn ?? username;
  const randomPassword = crypto.randomBytes(32).toString("hex");

  return createUser({
    email,
    username,
    password: randomPassword,
    displayName,
  });
}

/**
 * Runs the "right_assignment" rule set (this project's equivalent of GLPI's
 * RuleRight) against the raw LDAP attributes to decide which entity+profile
 * a freshly-synced (or re-logging-in) LDAP user should get. Only acts when
 * some matched rule actually set both `entityId` and `profileId` on the
 * output - if no rule matches, the user is left with whatever
 * entity/profile assignment (if any) they already have.
 *
 * Does not check for a pre-existing identical assignment before inserting:
 * `assignUserProfile` is a plain insert with no unique constraint on
 * (userId, entityId, profileId), so calling this repeatedly for the same
 * user (e.g. on every LDAP login) will create duplicate rows. Acceptable
 * for this slice per the task's explicit scope note; revisit if LDAP logins
 * end up calling this on every request rather than only on first sync.
 */
export async function assignEntityAndProfileFromLdap(
  userId: string,
  ldapAttributes: Record<string, unknown>,
  defaultEntityId: string,
): Promise<void> {
  const { output } = await evaluateRules("right_assignment", defaultEntityId, ldapAttributes);

  const entityId = typeof output.entityId === "string" ? output.entityId : undefined;
  const profileId = typeof output.profileId === "string" ? output.profileId : undefined;
  if (!entityId || !profileId) return;

  await assignUserProfile({
    userId,
    entityId,
    profileId,
    isRecursive: true,
    isDefault: true,
  });
}

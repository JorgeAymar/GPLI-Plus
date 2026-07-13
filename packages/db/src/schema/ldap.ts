import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * LDAP auth source config (SSO "server" side of GLPI's `glpi_authldaps`).
 *
 * `bindPasswordEncrypted` is stored as PLAIN TEXT in this v1 slice - the
 * column name documents intent ("this should eventually be encrypted at
 * rest"), not current behavior. Real encryption-at-rest is an infrastructure
 * concern (KMS-backed column encryption, pgcrypto, vault-issued secrets,
 * etc.) that spans every credential-bearing table in this schema, not just
 * this one - out of scope for this slice. Do not treat this column as
 * secure; restrict DB access accordingly until that broader concern is
 * addressed.
 */
export const ldapAuthSources = pgTable("ldap_auth_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  host: text("host").notNull(),
  port: integer("port").notNull().default(389),
  baseDn: text("base_dn").notNull(),
  bindDn: text("bind_dn").notNull(),
  // See module doc comment above: plain text in v1, not encrypted at rest.
  bindPasswordEncrypted: text("bind_password_encrypted").notNull(),
  loginField: text("login_field").notNull().default("uid"),
  syncField: text("sync_field").notNull(),
  groupField: text("group_field"),
  useTls: boolean("use_tls").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export type LdapAuthSource = typeof ldapAuthSources.$inferSelect;
export type NewLdapAuthSource = typeof ldapAuthSources.$inferInsert;

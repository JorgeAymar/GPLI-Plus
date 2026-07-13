import "dotenv/config";
import { db, entities, ldapAuthSources, profiles, rules, users, type Entity, type LdapAuthSource, type Profile } from "@itsm/db";
import { eq, like } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEntity } from "../entities/entity-service";
import { createProfile, listUserProfileAssignments } from "../rbac/profile-service";
import { addRuleAction, addRuleCriteria, createRule } from "../rules/rule-engine";
import { findUserByEmail } from "../users/user-service";
import { assignEntityAndProfileFromLdap, createLdapAuthSource, syncLdapUser } from "./ldap-service";

/**
 * `tryLdapLogin` itself needs a real LDAP server to bind/search against, which this
 * environment doesn't have - not covered here. `syncLdapUser`/`assignEntityAndProfileFromLdap`
 * take plain attribute maps as input (no LDAP connection involved), so they're fully
 * testable in isolation - and they're exactly the two functions now wired into
 * apps/web/lib/auth.ts's `authorize()` LDAP fallback path.
 */
const PREFIX = "__vitest_ldap__";
const RUN_ID = randomUUID().slice(0, 8);

describe("ldap-service", () => {
  let root: Entity;
  let profile: Profile;
  let source: LdapAuthSource;
  const createdUserIds: string[] = [];
  const createdRuleIds: string[] = [];

  beforeAll(async () => {
    root = await createEntity({ name: `${PREFIX}root_${RUN_ID}` });
    profile = await createProfile({ name: `${PREFIX}profile_${RUN_ID}`, interface: "central" });
    // syncLdapUser only reads `source.loginField` (to fall back on when an entry has no
    // "mail"/"email" attribute) - never actually connects to `host`/`bindDn`, so a fixture
    // row is enough, no real LDAP server needed for these tests.
    source = await createLdapAuthSource({
      name: `${PREFIX}source_${RUN_ID}`,
      host: "ldap.example.test",
      baseDn: "dc=example,dc=test",
      bindDn: "cn=admin,dc=example,dc=test",
      bindPasswordEncrypted: "not-a-real-secret",
      syncField: "uid",
      loginField: "uid",
    });
  });

  afterAll(async () => {
    for (const id of createdUserIds) {
      await db.delete(users).where(eq(users.id, id));
    }
    for (const id of createdRuleIds) {
      await db.delete(rules).where(eq(rules.id, id));
    }
    await db.delete(profiles).where(eq(profiles.id, profile.id));
    await db.delete(entities).where(eq(entities.id, root.id));
    await db.delete(ldapAuthSources).where(eq(ldapAuthSources.id, source.id));
    await db.delete(users).where(like(users.email, `${PREFIX}%`));
  });

  describe("syncLdapUser", () => {
    it("creates a new local user from LDAP attributes when no matching email exists", async () => {
      const email = `${PREFIX}new_${RUN_ID}@example.test`;
      const user = await syncLdapUser(
        { mail: email, uid: `jdoe_${RUN_ID}`, cn: "Jane Doe", displayName: "Jane Doe" },
        source,
      );
      createdUserIds.push(user.id);

      expect(user.email).toBe(email);
      expect(user.displayName).toBe("Jane Doe");
      expect(user.isActive).toBe(true);
    });

    it("finds and returns the existing local user instead of creating a duplicate", async () => {
      const email = `${PREFIX}existing_${RUN_ID}@example.test`;
      const first = await syncLdapUser({ mail: email, uid: `first_${RUN_ID}` }, source);
      createdUserIds.push(first.id);

      const second = await syncLdapUser(
        { mail: email, uid: `first_${RUN_ID}`, cn: "Should Not Matter" },
        source,
      );

      expect(second.id).toBe(first.id);
      const stillOne = await findUserByEmail(email);
      expect(stillOne?.id).toBe(first.id);
    });

    it("throws when the LDAP entry has no mail/email attribute", async () => {
      await expect(
        syncLdapUser({ uid: `noemail_${RUN_ID}` }, source),
      ).rejects.toThrow(/mail/i);
    });
  });

  describe("assignEntityAndProfileFromLdap", () => {
    it("assigns entity+profile when a matching right_assignment rule sets both", async () => {
      const email = `${PREFIX}ruled_${RUN_ID}@example.test`;
      const user = await syncLdapUser({ mail: email, uid: `ruled_${RUN_ID}`, department: "IT" }, source);
      createdUserIds.push(user.id);

      const rule = await createRule({ entityId: root.id, ruleType: "right_assignment", name: `${PREFIX}rule_${RUN_ID}` });
      createdRuleIds.push(rule.id);
      await addRuleCriteria({ ruleId: rule.id, field: "department", operator: "is", value: "IT" });
      await addRuleAction({ ruleId: rule.id, actionType: "assign", field: "entityId", value: root.id });
      await addRuleAction({ ruleId: rule.id, actionType: "assign", field: "profileId", value: profile.id });

      await assignEntityAndProfileFromLdap(user.id, { department: "IT" }, root.id);

      const assignments = await listUserProfileAssignments(user.id);
      expect(assignments.some((a) => a.entityId === root.id && a.profileId === profile.id)).toBe(true);
    });

    it("assigns nothing when no rule matches the given attributes", async () => {
      const email = `${PREFIX}unmatched_${RUN_ID}@example.test`;
      const user = await syncLdapUser({ mail: email, uid: `unmatched_${RUN_ID}` }, source);
      createdUserIds.push(user.id);

      await assignEntityAndProfileFromLdap(user.id, { department: "SOMETHING_NO_RULE_MATCHES" }, root.id);

      const assignments = await listUserProfileAssignments(user.id);
      expect(assignments).toHaveLength(0);
    });
  });
});

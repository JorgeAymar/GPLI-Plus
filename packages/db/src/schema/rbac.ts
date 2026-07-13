import { type AnyPgColumn, boolean, index, integer, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { entities } from "./entities";
import { users } from "./users";

export const profileInterfaceEnum = pgEnum("profile_interface", ["central", "simplified"]);

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id").references((): AnyPgColumn => groups.id),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("groups_entity_idx").on(table.entityId), index("groups_parent_idx").on(table.parentId)],
);

export const userGroups = pgTable(
  "user_groups",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    isManager: boolean("is_manager").notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.userId, table.groupId] }), index("user_groups_group_idx").on(table.groupId)],
);

/** Named permission set. `interface` decides which UI shell (Central vs Simplified) a profile grants. */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  interface: profileInterfaceEnum("interface").notNull().default("central"),
  isDefault: boolean("is_default").notNull().default(false),
  description: text("description"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * `rights` is a bitmask (see @itsm/core/auth/permissions RIGHT constants).
 * `moduleKey` is a dotted string like "assets.computer" or "assistance.ticket" -
 * new modules register new rows here without any schema migration.
 */
export const profileModuleRights = pgTable(
  "profile_module_rights",
  {
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    moduleKey: text("module_key").notNull(),
    rights: integer("rights").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.profileId, table.moduleKey] })],
);

/** N profiles x N entities per user. `isRecursive` extends the grant to sub-entities via entities.path. */
export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    isRecursive: boolean("is_recursive").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  // userId is filtered on every single requireRight()/getEffectiveRights() call - the hottest
  // lookup in the whole app. profileId backs the reverse "which users have profile X" lookup.
  (table) => [index("user_profiles_user_idx").on(table.userId), index("user_profiles_profile_idx").on(table.profileId)],
);

export type Group = typeof groups.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type ProfileModuleRight = typeof profileModuleRights.$inferSelect;
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;

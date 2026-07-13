import { boolean, index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { budgets } from "./budgets";
import { dropdownItems } from "./dropdowns";
import { entities } from "./entities";
import { users } from "./users";

/**
 * Ticket/Problem/Change ("ITIL objects") share a common column set and a set
 * of polymorphic satellite tables (actors, timeline, validations, costs),
 * discriminated by `itilType` + `itilId`. Postgres table inheritance is
 * fragile with FKs/indexes, so instead of DB-level inheritance each object
 * gets its own real table built from this shared column-factory function -
 * see tickets.ts/problems.ts/changes.ts. The factory must return FRESH
 * column builder instances on every call (builders are stateful), so it's a
 * function, never a shared object literal reused across tables.
 */
export const itilStatusEnum = pgEnum("itil_status", ["new", "assigned", "planned", "pending", "solved", "closed"]);
export type ItilStatus = (typeof itilStatusEnum.enumValues)[number];

export function itilBaseColumns() {
  return {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    title: text("title").notNull(),
    content: text("content").notNull(),
    status: itilStatusEnum("status").notNull().default("new"),
    urgency: integer("urgency").notNull().default(3),
    impact: integer("impact").notNull().default(3),
    priority: integer("priority").notNull().default(3),
    categoryDropdownItemId: uuid("category_dropdown_item_id").references(() => dropdownItems.id),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
    solvedAt: timestamp("solved_at", { mode: "date" }),
    closedAt: timestamp("closed_at", { mode: "date" }),
  };
}

export const itilTypeEnum = pgEnum("itil_type", ["ticket", "problem", "change"]);
export type ItilType = (typeof itilTypeEnum.enumValues)[number];

export const itilActorRoleEnum = pgEnum("itil_actor_role", ["requester", "assignee", "observer"]);
export type ItilActorRole = (typeof itilActorRoleEnum.enumValues)[number];
export const itilActorKindEnum = pgEnum("itil_actor_kind", ["user", "group", "supplier"]);
export type ItilActorKind = (typeof itilActorKindEnum.enumValues)[number];

/** actorId is polymorphic on actorKind (user/group/future supplier) - intentionally no FK. */
export const itilActors = pgTable(
  "itil_actors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itilType: itilTypeEnum("itil_type").notNull(),
    itilId: uuid("itil_id").notNull(),
    actorRole: itilActorRoleEnum("actor_role").notNull(),
    actorKind: itilActorKindEnum("actor_kind").notNull(),
    actorId: uuid("actor_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("itil_actors_lookup_idx").on(table.itilType, table.itilId)],
);

export const itilTimelineItemTypeEnum = pgEnum("itil_timeline_item_type", ["followup", "task", "solution", "internal_note"]);
export type ItilTimelineItemType = (typeof itilTimelineItemTypeEnum.enumValues)[number];

export const itilTimelineItems = pgTable(
  "itil_timeline_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itilType: itilTypeEnum("itil_type").notNull(),
    itilId: uuid("itil_id").notNull(),
    itemType: itilTimelineItemTypeEnum("item_type").notNull(),
    content: text("content").notNull(),
    isPrivate: boolean("is_private").notNull().default(false),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    timeSpentMinutes: integer("time_spent_minutes"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("itil_timeline_lookup_idx").on(table.itilType, table.itilId)],
);

export const itilValidatorKindEnum = pgEnum("itil_validator_kind", ["user", "group"]);
export type ItilValidatorKind = (typeof itilValidatorKindEnum.enumValues)[number];
export const itilValidationStatusEnum = pgEnum("itil_validation_status", ["waiting", "approved", "refused"]);
export type ItilValidationStatus = (typeof itilValidationStatusEnum.enumValues)[number];

export const itilValidations = pgTable(
  "itil_validations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itilType: itilTypeEnum("itil_type").notNull(),
    itilId: uuid("itil_id").notNull(),
    validatorKind: itilValidatorKindEnum("validator_kind").notNull(),
    validatorId: uuid("validator_id").notNull(),
    status: itilValidationStatusEnum("status").notNull().default("waiting"),
    comment: text("comment"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { mode: "date" }),
  },
  (table) => [index("itil_validations_lookup_idx").on(table.itilType, table.itilId)],
);

export const itilCosts = pgTable(
  "itil_costs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itilType: itilTypeEnum("itil_type").notNull(),
    itilId: uuid("itil_id").notNull(),
    costType: text("cost_type").notNull(),
    amountCents: integer("amount_cents").notNull(),
    budgetId: uuid("budget_id").references(() => budgets.id),
    comment: text("comment"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("itil_costs_lookup_idx").on(table.itilType, table.itilId)],
);

export type ItilActor = typeof itilActors.$inferSelect;
export type NewItilActor = typeof itilActors.$inferInsert;
export type ItilTimelineItem = typeof itilTimelineItems.$inferSelect;
export type NewItilTimelineItem = typeof itilTimelineItems.$inferInsert;
export type ItilValidation = typeof itilValidations.$inferSelect;
export type NewItilValidation = typeof itilValidations.$inferInsert;
export type ItilCost = typeof itilCosts.$inferSelect;
export type NewItilCost = typeof itilCosts.$inferInsert;

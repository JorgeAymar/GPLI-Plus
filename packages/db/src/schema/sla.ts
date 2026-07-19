import { boolean, index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { entities } from "./entities";
import { itilTypeEnum } from "./itil-shared";

/**
 * Single-tier SLA definition (a target in minutes for time-to-own and
 * time-to-resolve). No multi-level escalation matrix yet - that's a natural
 * Phase 3c/6 extension once notifications exist to actually escalate to
 * (a breached SLA with no one to notify is just a flag).
 */
export const slaPolicies = pgTable(
  "sla_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    name: text("name").notNull(),
    description: text("description"),
    ttoMinutes: integer("tto_minutes"), // time-to-own (first response) target; null = not tracked
    ttrMinutes: integer("ttr_minutes"), // time-to-resolve target; null = not tracked
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("sla_policies_entity_idx").on(table.entityId)],
);

export const slaTypeEnum = pgEnum("sla_type", ["tto", "ttr"]);
export type SlaType = (typeof slaTypeEnum.enumValues)[number];

/** Polymorphic like the other itil satellites - an itil object can hold one tto and one ttr assignment. */
export const itilSlaAssignments = pgTable(
  "itil_sla_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itilType: itilTypeEnum("itil_type").notNull(),
    itilId: uuid("itil_id").notNull(),
    slaPolicyId: uuid("sla_policy_id")
      .notNull()
      .references(() => slaPolicies.id),
    slaType: slaTypeEnum("sla_type").notNull(),
    dueAt: timestamp("due_at", { mode: "date" }).notNull(),
    isBreached: boolean("is_breached").notNull().default(false),
    breachedAt: timestamp("breached_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("itil_sla_assignments_lookup_idx").on(table.itilType, table.itilId),
    index("itil_sla_assignments_sweep_idx").on(table.isBreached, table.dueAt),
    index("itil_sla_assignments_sla_policy_idx").on(table.slaPolicyId),
  ],
);

export type SlaPolicy = typeof slaPolicies.$inferSelect;
export type NewSlaPolicy = typeof slaPolicies.$inferInsert;
export type ItilSlaAssignment = typeof itilSlaAssignments.$inferSelect;
export type NewItilSlaAssignment = typeof itilSlaAssignments.$inferInsert;

import { boolean, index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { assets } from "./assets";
import { entities } from "./entities";

/**
 * One row per agent/device that reports inventory data (JSON-only protocol,
 * clean-room reimplementation - no GLPI XML/FusionInventory format). `deviceId`
 * is whatever stable identifier the agent generates locally (e.g. a UUID it
 * persists on first run); it's how repeat submissions from the same machine
 * are recognized regardless of hostname changes.
 */
export const inventoryAgents = pgTable(
  "inventory_agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deviceId: text("device_id").notNull().unique(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    name: text("name").notNull(),
    assetId: uuid("asset_id").references(() => assets.id),
    lastContactAt: timestamp("last_contact_at", { mode: "date" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("inventory_agents_entity_idx").on(table.entityId), index("inventory_agents_asset_idx").on(table.assetId)],
);

/**
 * Fields an admin has decided the agent must never overwrite again on a
 * future submission (e.g. a manually-corrected name/location). Checked by
 * inventory-service.submitInventory before building the update payload.
 */
export const inventoryLockedFields = pgTable(
  "inventory_locked_fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    fieldName: text("field_name").notNull(),
  },
  (table) => [uniqueIndex("inventory_locked_fields_asset_field_unique").on(table.assetId, table.fieldName)],
);

export const inventorySubmissionStatusEnum = pgEnum("inventory_submission_status", ["pending", "processed", "rejected"]);
export type InventorySubmissionStatus = (typeof inventorySubmissionStatusEnum.enumValues)[number];

/** Audit trail of every payload received from an agent, whether or not it matched/created an asset. */
export const inventorySubmissions = pgTable(
  "inventory_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => inventoryAgents.id, { onDelete: "cascade" }),
    rawPayload: jsonb("raw_payload").notNull(),
    status: inventorySubmissionStatusEnum("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    receivedAt: timestamp("received_at", { mode: "date" }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { mode: "date" }),
  },
  (table) => [index("inventory_submissions_agent_idx").on(table.agentId)],
);

export type InventoryAgent = typeof inventoryAgents.$inferSelect;
export type NewInventoryAgent = typeof inventoryAgents.$inferInsert;
export type InventoryLockedField = typeof inventoryLockedFields.$inferSelect;
export type NewInventoryLockedField = typeof inventoryLockedFields.$inferInsert;
export type InventorySubmission = typeof inventorySubmissions.$inferSelect;
export type NewInventorySubmission = typeof inventorySubmissions.$inferInsert;

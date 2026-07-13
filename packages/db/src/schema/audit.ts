import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { entities } from "./entities";
import { users } from "./users";

/** Single generic append-only log reused by every module instead of per-module audit tables. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    action: text("action").notNull(),
    objectType: text("object_type").notNull(),
    objectId: uuid("object_id").notNull(),
    before: jsonb("before_jsonb"),
    after: jsonb("after_jsonb"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_log_object_idx").on(table.objectType, table.objectId),
    index("audit_log_created_at_idx").on(table.createdAt),
  ],
);

export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;

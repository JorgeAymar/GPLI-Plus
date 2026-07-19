import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { entities } from "./entities";
import { users } from "./users";

/**
 * A single uploaded file, stored via the storage adapter (see
 * packages/core/src/storage/storage-adapter.ts) at `storageKey` - the DB row
 * only holds metadata, never the file bytes.
 */
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    name: text("name").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull(),
    uploadedByUserId: uuid("uploaded_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("documents_entity_idx").on(table.entityId), index("documents_uploaded_by_idx").on(table.uploadedByUserId)],
);

/**
 * Polymorphic attachment link: one document can be attached to any item in
 * the system (`itemType`+`itemId`, no FK - same pattern as itil_actors).
 * A single document can be attached to more than one item.
 */
export const documentItems = pgTable(
  "document_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    itemType: text("item_type").notNull(),
    itemId: uuid("item_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("document_items_lookup_idx").on(table.itemType, table.itemId),
    index("document_items_document_idx").on(table.documentId),
  ],
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentItem = typeof documentItems.$inferSelect;
export type NewDocumentItem = typeof documentItems.$inferInsert;

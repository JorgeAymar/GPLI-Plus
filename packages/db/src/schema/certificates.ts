import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { assets } from "./assets";
import { entities } from "./entities";

export const certificateTypeEnum = pgEnum("certificate_type", ["ssl", "code_signing", "other"]);
export type CertificateType = (typeof certificateTypeEnum.enumValues)[number];

export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    name: text("name").notNull(),
    certificateType: certificateTypeEnum("certificate_type").notNull().default("ssl"),
    issuer: text("issuer"),
    serialNumber: text("serial_number"),
    validFrom: timestamp("valid_from", { mode: "date" }),
    validUntil: timestamp("valid_until", { mode: "date" }),
    assignedAssetId: uuid("assigned_asset_id").references(() => assets.id),
    comment: text("comment"),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("certificates_entity_idx").on(table.entityId), index("certificates_assigned_asset_idx").on(table.assignedAssetId)],
);

export type Certificate = typeof certificates.$inferSelect;
export type NewCertificate = typeof certificates.$inferInsert;

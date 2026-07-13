import { integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { assets } from "./assets";
import { dropdownItems } from "./dropdowns";
import { entities } from "./entities";

export const licenseTypeEnum = pgEnum("license_type", ["per_seat", "per_device", "volume", "subscription", "oem", "freeware"]);
export type LicenseType = (typeof licenseTypeEnum.enumValues)[number];

export const software = pgTable("software", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id")
    .notNull()
    .references(() => entities.id),
  name: text("name").notNull(),
  manufacturerDropdownItemId: uuid("manufacturer_dropdown_item_id").references(() => dropdownItems.id),
  categoryDropdownItemId: uuid("category_dropdown_item_id").references(() => dropdownItems.id),
  comment: text("comment"),
  deletedAt: timestamp("deleted_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const softwareVersions = pgTable(
  "software_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    softwareId: uuid("software_id")
      .notNull()
      .references(() => software.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    osDropdownItemId: uuid("os_dropdown_item_id").references(() => dropdownItems.id),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("software_versions_unique").on(table.softwareId, table.name)],
);

/** No countSeatsUsed denormalized counter - it's a cheap COUNT(*) over asset_software_installations (see software-service.ts). */
export const softwareLicenses = pgTable("software_licenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id")
    .notNull()
    .references(() => entities.id),
  softwareId: uuid("software_id")
    .notNull()
    .references(() => software.id, { onDelete: "cascade" }),
  softwareVersionId: uuid("software_version_id").references(() => softwareVersions.id),
  name: text("name").notNull(),
  licenseType: licenseTypeEnum("license_type").notNull(),
  serialNumber: text("serial_number"),
  seatsTotal: integer("seats_total"), // null = unlimited
  purchaseDate: timestamp("purchase_date", { mode: "date" }),
  expirationDate: timestamp("expiration_date", { mode: "date" }),
  comment: text("comment"),
  deletedAt: timestamp("deleted_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const assetSoftwareInstallations = pgTable(
  "asset_software_installations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    softwareVersionId: uuid("software_version_id")
      .notNull()
      .references(() => softwareVersions.id),
    softwareLicenseId: uuid("software_license_id").references(() => softwareLicenses.id), // null = unlicensed/unknown seat
    installDate: timestamp("install_date", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("installations_unique").on(table.assetId, table.softwareVersionId)],
);

export type Software = typeof software.$inferSelect;
export type NewSoftware = typeof software.$inferInsert;
export type SoftwareVersion = typeof softwareVersions.$inferSelect;
export type NewSoftwareVersion = typeof softwareVersions.$inferInsert;
export type SoftwareLicense = typeof softwareLicenses.$inferSelect;
export type NewSoftwareLicense = typeof softwareLicenses.$inferInsert;
export type AssetSoftwareInstallation = typeof assetSoftwareInstallations.$inferSelect;
export type NewAssetSoftwareInstallation = typeof assetSoftwareInstallations.$inferInsert;

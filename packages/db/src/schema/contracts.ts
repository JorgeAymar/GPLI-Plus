import { index, integer, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { assets } from "./assets";
import { entities } from "./entities";
import { suppliers } from "./suppliers";

export const contractTypeEnum = pgEnum("contract_type", ["maintenance", "lease", "license", "support", "other"]);
export type ContractType = (typeof contractTypeEnum.enumValues)[number];
export const billingFrequencyEnum = pgEnum("billing_frequency", ["monthly", "quarterly", "annual", "one_time"]);
export type BillingFrequency = (typeof billingFrequencyEnum.enumValues)[number];

export const contracts = pgTable(
  "contracts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    name: text("name").notNull(),
    contractType: contractTypeEnum("contract_type").notNull().default("other"),
    billingFrequency: billingFrequencyEnum("billing_frequency").notNull().default("annual"),
    costCents: integer("cost_cents"),
    startDate: timestamp("start_date", { mode: "date" }),
    endDate: timestamp("end_date", { mode: "date" }),
    renewalNoticeDays: integer("renewal_notice_days"),
    comment: text("comment"),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("contracts_entity_idx").on(table.entityId), index("contracts_supplier_idx").on(table.supplierId)],
);

/** Which assets a contract covers (e.g. a maintenance contract covering 10 computers). */
export const contractAssets = pgTable(
  "contract_assets",
  {
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.contractId, table.assetId] }), index("contract_assets_asset_idx").on(table.assetId)],
);

export type Contract = typeof contracts.$inferSelect;
export type NewContract = typeof contracts.$inferInsert;
export type ContractAsset = typeof contractAssets.$inferSelect;

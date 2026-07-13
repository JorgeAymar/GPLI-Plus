import { index, pgTable, timestamp } from "drizzle-orm/pg-core";
import { itilBaseColumns } from "./itil-shared";

export const changes = pgTable(
  "changes",
  {
    ...itilBaseColumns(),
    plannedStartAt: timestamp("planned_start_at", { mode: "date" }),
    plannedEndAt: timestamp("planned_end_at", { mode: "date" }),
  },
  (table) => [index("changes_entity_idx").on(table.entityId)],
);

export type Change = typeof changes.$inferSelect;
export type NewChange = typeof changes.$inferInsert;

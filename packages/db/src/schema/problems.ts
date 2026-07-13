import { index, pgTable } from "drizzle-orm/pg-core";
import { itilBaseColumns } from "./itil-shared";

export const problems = pgTable(
  "problems",
  {
    ...itilBaseColumns(),
  },
  (table) => [index("problems_entity_idx").on(table.entityId)],
);

export type Problem = typeof problems.$inferSelect;
export type NewProblem = typeof problems.$inferInsert;

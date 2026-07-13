import { pgTable } from "drizzle-orm/pg-core";
import { itilBaseColumns } from "./itil-shared";

export const problems = pgTable("problems", {
  ...itilBaseColumns(),
});

export type Problem = typeof problems.$inferSelect;
export type NewProblem = typeof problems.$inferInsert;

import { type AnyPgColumn, boolean, index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { budgets } from "./budgets";
import { dropdownItems } from "./dropdowns";
import { entities } from "./entities";
import { groups } from "./rbac";
import { users } from "./users";

export const projectTeamMemberKindEnum = pgEnum("project_team_member_kind", ["user", "group", "supplier", "contact"]);
export type ProjectTeamMemberKind = (typeof projectTeamMemberKindEnum.enumValues)[number];

export const projectTeamMemberRoleEnum = pgEnum("project_team_member_role", ["owner", "member"]);
export type ProjectTeamMemberRole = (typeof projectTeamMemberRoleEnum.enumValues)[number];

export const projectTaskLinkTypeEnum = pgEnum("project_task_link_type", [
  "finish_to_start",
  "start_to_start",
  "finish_to_finish",
  "start_to_finish",
]);
export type ProjectTaskLinkType = (typeof projectTaskLinkTypeEnum.enumValues)[number];

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id),
    parentProjectId: uuid("parent_project_id").references((): AnyPgColumn => projects.id),
    name: text("name").notNull(),
    code: text("code"),
    priority: integer("priority").notNull().default(3),
    projectStateDropdownItemId: uuid("project_state_dropdown_item_id").references(() => dropdownItems.id),
    projectTypeDropdownItemId: uuid("project_type_dropdown_item_id").references(() => dropdownItems.id),
    planStartAt: timestamp("plan_start_at", { mode: "date" }),
    planEndAt: timestamp("plan_end_at", { mode: "date" }),
    actualStartAt: timestamp("actual_start_at", { mode: "date" }),
    actualEndAt: timestamp("actual_end_at", { mode: "date" }),
    percentDone: integer("percent_done").notNull().default(0),
    autoPercentDone: boolean("auto_percent_done").notNull().default(false),
    isTemplate: boolean("is_template").notNull().default(false),
    managerUserId: uuid("manager_user_id").references(() => users.id),
    groupId: uuid("group_id").references(() => groups.id),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("projects_entity_idx").on(table.entityId)],
);

export const projectTasks = pgTable(
  "project_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    parentTaskId: uuid("parent_task_id").references((): AnyPgColumn => projectTasks.id),
    name: text("name").notNull(),
    projectTaskStateDropdownItemId: uuid("project_task_state_dropdown_item_id").references(() => dropdownItems.id),
    plannedDurationMinutes: integer("planned_duration_minutes"),
    effectiveDurationMinutes: integer("effective_duration_minutes"),
    percentDone: integer("percent_done").notNull().default(0),
    autoPercentDone: boolean("auto_percent_done").notNull().default(false),
    isMilestone: boolean("is_milestone").notNull().default(false),
    planStartAt: timestamp("plan_start_at", { mode: "date" }),
    planEndAt: timestamp("plan_end_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("project_tasks_project_idx").on(table.projectId)],
);

export const projectTaskLinks = pgTable(
  "project_task_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceTaskId: uuid("source_task_id")
      .notNull()
      .references(() => projectTasks.id, { onDelete: "cascade" }),
    targetTaskId: uuid("target_task_id")
      .notNull()
      .references(() => projectTasks.id, { onDelete: "cascade" }),
    linkType: projectTaskLinkTypeEnum("link_type").notNull().default("finish_to_start"),
    lagMinutes: integer("lag_minutes").notNull().default(0),
  },
  (table) => [index("project_task_links_source_idx").on(table.sourceTaskId), index("project_task_links_target_idx").on(table.targetTaskId)],
);

/** memberId is polymorphic on memberKind (user/group/supplier/contact) - intentionally no FK, same pattern as itilActors in itil-shared.ts. */
export const projectTeamMembers = pgTable(
  "project_team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    memberKind: projectTeamMemberKindEnum("member_kind").notNull(),
    memberId: uuid("member_id").notNull(),
    role: projectTeamMemberRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("project_team_members_project_idx").on(table.projectId)],
);

export const projectCosts = pgTable(
  "project_costs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    budgetId: uuid("budget_id").references(() => budgets.id),
    beginDate: timestamp("begin_date", { mode: "date" }),
    endDate: timestamp("end_date", { mode: "date" }),
    comment: text("comment"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("project_costs_project_idx").on(table.projectId)],
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectTask = typeof projectTasks.$inferSelect;
export type NewProjectTask = typeof projectTasks.$inferInsert;
export type ProjectTaskLink = typeof projectTaskLinks.$inferSelect;
export type NewProjectTaskLink = typeof projectTaskLinks.$inferInsert;
export type ProjectTeamMember = typeof projectTeamMembers.$inferSelect;
export type NewProjectTeamMember = typeof projectTeamMembers.$inferInsert;
export type ProjectCost = typeof projectCosts.$inferSelect;
export type NewProjectCost = typeof projectCosts.$inferInsert;

import { z } from "zod";

export const projectTeamMemberKindSchema = z.enum(["user", "group", "supplier", "contact"]);
export const projectTeamMemberRoleSchema = z.enum(["owner", "member"]);
export const projectTaskLinkTypeSchema = z.enum(["finish_to_start", "start_to_start", "finish_to_finish", "start_to_finish"]);

export const createProjectSchema = z.object({
  entityId: z.string().uuid(),
  parentProjectId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(255),
  code: z.string().max(255).nullable().optional(),
  priority: z.number().int().min(1).max(5).optional(),
  projectStateDropdownItemId: z.string().uuid().nullable().optional(),
  projectTypeDropdownItemId: z.string().uuid().nullable().optional(),
  planStartAt: z.coerce.date().nullable().optional(),
  planEndAt: z.coerce.date().nullable().optional(),
  actualStartAt: z.coerce.date().nullable().optional(),
  actualEndAt: z.coerce.date().nullable().optional(),
  percentDone: z.number().int().min(0).max(100).optional(),
  autoPercentDone: z.boolean().optional(),
  isTemplate: z.boolean().optional(),
  managerUserId: z.string().uuid().nullable().optional(),
  groupId: z.string().uuid().nullable().optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema.omit({ entityId: true }).partial();
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const createProjectTaskSchema = z.object({
  projectId: z.string().uuid(),
  parentTaskId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(255),
  projectTaskStateDropdownItemId: z.string().uuid().nullable().optional(),
  plannedDurationMinutes: z.number().int().min(0).nullable().optional(),
  effectiveDurationMinutes: z.number().int().min(0).nullable().optional(),
  percentDone: z.number().int().min(0).max(100).optional(),
  autoPercentDone: z.boolean().optional(),
  isMilestone: z.boolean().optional(),
  planStartAt: z.coerce.date().nullable().optional(),
  planEndAt: z.coerce.date().nullable().optional(),
});
export type CreateProjectTaskInput = z.infer<typeof createProjectTaskSchema>;

export const updateProjectTaskSchema = createProjectTaskSchema.omit({ projectId: true }).partial();
export type UpdateProjectTaskInput = z.infer<typeof updateProjectTaskSchema>;

export const createProjectTaskLinkSchema = z.object({
  sourceTaskId: z.string().uuid(),
  targetTaskId: z.string().uuid(),
  linkType: projectTaskLinkTypeSchema.optional(),
  lagMinutes: z.number().int().optional(),
});
export type CreateProjectTaskLinkInput = z.infer<typeof createProjectTaskLinkSchema>;

export const createProjectTeamMemberSchema = z.object({
  projectId: z.string().uuid(),
  memberKind: projectTeamMemberKindSchema,
  memberId: z.string().uuid(),
  role: projectTeamMemberRoleSchema.optional(),
});
export type CreateProjectTeamMemberInput = z.infer<typeof createProjectTeamMemberSchema>;

export const createProjectCostSchema = z.object({
  projectId: z.string().uuid(),
  amountCents: z.number().int().min(0),
  budgetId: z.string().uuid().nullable().optional(),
  beginDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  comment: z.string().max(2000).nullable().optional(),
});
export type CreateProjectCostInput = z.infer<typeof createProjectCostSchema>;

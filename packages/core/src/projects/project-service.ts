import {
  db,
  projectCosts,
  projectTaskLinks,
  projectTasks,
  projectTeamMembers,
  projects,
  type Project,
  type ProjectCost,
  type ProjectTask,
  type ProjectTaskLink,
  type ProjectTeamMember,
} from "@itsm/db";
import { and, eq, inArray, isNull, type SQL } from "drizzle-orm";
import { listSubtree } from "../entities/entity-service";
import type {
  CreateProjectCostInput,
  CreateProjectInput,
  CreateProjectTaskInput,
  CreateProjectTaskLinkInput,
  CreateProjectTeamMemberInput,
  UpdateProjectInput,
  UpdateProjectTaskInput,
} from "../validation/project.zod";

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const [created] = await db
    .insert(projects)
    .values({
      entityId: input.entityId,
      parentProjectId: input.parentProjectId ?? null,
      name: input.name,
      code: input.code ?? null,
      priority: input.priority ?? 3,
      projectStateDropdownItemId: input.projectStateDropdownItemId ?? null,
      projectTypeDropdownItemId: input.projectTypeDropdownItemId ?? null,
      planStartAt: input.planStartAt ?? null,
      planEndAt: input.planEndAt ?? null,
      actualStartAt: input.actualStartAt ?? null,
      actualEndAt: input.actualEndAt ?? null,
      percentDone: input.percentDone ?? 0,
      autoPercentDone: input.autoPercentDone ?? false,
      isTemplate: input.isTemplate ?? false,
      managerUserId: input.managerUserId ?? null,
      groupId: input.groupId ?? null,
    })
    .returning();
  if (!created) throw new Error("Failed to insert project");
  return created;
}

export async function getProject(id: string): Promise<Project | undefined> {
  const [row] = await db.select().from(projects).where(eq(projects.id, id));
  return row;
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
  const [updated] = await db
    .update(projects)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();
  if (!updated) throw new Error(`Project ${id} not found`);
  return updated;
}

/**
 * By default excludes templates (isTemplate = true) and soft-deleted rows.
 * `includeTemplates: true` surfaces templates alongside real projects.
 * Filtering to top-level only (parentProjectId IS NULL) is left to callers
 * (e.g. the projects list page) since not every listing needs that.
 */
export async function listProjects(
  entityId: string,
  options?: { includeSubtree?: boolean; includeTemplates?: boolean },
): Promise<Project[]> {
  const entityIds = options?.includeSubtree ? (await listSubtree(entityId)).map((e) => e.id) : [entityId];

  const conditions: SQL[] = [inArray(projects.entityId, entityIds), isNull(projects.deletedAt)];
  if (!options?.includeTemplates) conditions.push(eq(projects.isTemplate, false));

  return db
    .select()
    .from(projects)
    .where(and(...conditions))
    .orderBy(projects.name);
}

export async function createProjectTask(input: CreateProjectTaskInput): Promise<ProjectTask> {
  const [created] = await db
    .insert(projectTasks)
    .values({
      projectId: input.projectId,
      parentTaskId: input.parentTaskId ?? null,
      name: input.name,
      projectTaskStateDropdownItemId: input.projectTaskStateDropdownItemId ?? null,
      plannedDurationMinutes: input.plannedDurationMinutes ?? null,
      effectiveDurationMinutes: input.effectiveDurationMinutes ?? null,
      percentDone: input.percentDone ?? 0,
      autoPercentDone: input.autoPercentDone ?? false,
      isMilestone: input.isMilestone ?? false,
      planStartAt: input.planStartAt ?? null,
      planEndAt: input.planEndAt ?? null,
    })
    .returning();
  if (!created) throw new Error("Failed to insert project task");
  return created;
}

export async function updateProjectTask(id: string, input: UpdateProjectTaskInput): Promise<ProjectTask> {
  const [updated] = await db
    .update(projectTasks)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(projectTasks.id, id))
    .returning();
  if (!updated) throw new Error(`Project task ${id} not found`);
  return updated;
}

/** All tasks belonging to a project, including nested ones - the UI builds the tree via parentTaskId. */
export async function listProjectTasks(projectId: string): Promise<ProjectTask[]> {
  return db.select().from(projectTasks).where(eq(projectTasks.projectId, projectId)).orderBy(projectTasks.createdAt);
}

/**
 * If `autoPercentDone` is false, does nothing (returns the project as-is).
 * If true, averages the percentDone of direct sub-projects + top-level tasks
 * (simple arithmetic mean, rounded) and persists it. If there's nothing to
 * average, leaves percentDone untouched. Then bubbles up to the parent
 * project (if any) - safe without cycle protection because parentProjectId
 * is set once at creation and never reassigned in this v1.
 */
export async function recalculateProjectPercentDone(projectId: string): Promise<Project> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  if (!project.autoPercentDone) return project;

  const [subProjects, topLevelTasks] = await Promise.all([
    db.select().from(projects).where(eq(projects.parentProjectId, projectId)),
    db.select().from(projectTasks).where(and(eq(projectTasks.projectId, projectId), isNull(projectTasks.parentTaskId))),
  ]);

  const percentages = [...subProjects.map((p) => p.percentDone), ...topLevelTasks.map((t) => t.percentDone)];
  if (percentages.length === 0) return project;

  const average = Math.round(percentages.reduce((sum, p) => sum + p, 0) / percentages.length);
  const updated = await updateProject(projectId, { percentDone: average });

  if (updated.parentProjectId) {
    await recalculateProjectPercentDone(updated.parentProjectId);
  }

  return updated;
}

export async function addProjectTeamMember(input: CreateProjectTeamMemberInput): Promise<ProjectTeamMember> {
  const [created] = await db
    .insert(projectTeamMembers)
    .values({
      projectId: input.projectId,
      memberKind: input.memberKind,
      memberId: input.memberId,
      role: input.role ?? "member",
    })
    .returning();
  if (!created) throw new Error("Failed to insert project team member");
  return created;
}

export async function listProjectTeamMembers(projectId: string): Promise<ProjectTeamMember[]> {
  return db.select().from(projectTeamMembers).where(eq(projectTeamMembers.projectId, projectId));
}

export async function removeProjectTeamMember(id: string): Promise<void> {
  await db.delete(projectTeamMembers).where(eq(projectTeamMembers.id, id));
}

/** BFS over existing links, walking forward (source -> target) starting at `startTaskId`, looking for `targetTaskId`. */
function isReachable(startTaskId: string, targetTaskId: string, links: ProjectTaskLink[]): boolean {
  const visited = new Set<string>([startTaskId]);
  const queue: string[] = [startTaskId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    if (current === targetTaskId) return true;

    for (const link of links) {
      if (link.sourceTaskId === current && !visited.has(link.targetTaskId)) {
        visited.add(link.targetTaskId);
        queue.push(link.targetTaskId);
      }
    }
  }

  return false;
}

/**
 * Rejects a link if it would create a cycle: if a chain of existing links
 * already lets you walk from `targetTaskId` to `sourceTaskId`, adding
 * sourceTaskId -> targetTaskId would close the loop (e.g. existing A -> B,
 * proposed B -> A).
 */
export async function addProjectTaskLink(input: CreateProjectTaskLinkInput): Promise<ProjectTaskLink> {
  const existingLinks = await db.select().from(projectTaskLinks);
  if (isReachable(input.targetTaskId, input.sourceTaskId, existingLinks)) {
    throw new Error("Esta dependencia crearía un ciclo");
  }

  const [created] = await db
    .insert(projectTaskLinks)
    .values({
      sourceTaskId: input.sourceTaskId,
      targetTaskId: input.targetTaskId,
      linkType: input.linkType ?? "finish_to_start",
      lagMinutes: input.lagMinutes ?? 0,
    })
    .returning();
  if (!created) throw new Error("Failed to insert project task link");
  return created;
}

/** All links for a project's tasks, found via the source task's projectId. */
export async function listProjectTaskLinks(projectId: string): Promise<ProjectTaskLink[]> {
  const rows = await db
    .select({ link: projectTaskLinks })
    .from(projectTaskLinks)
    .innerJoin(projectTasks, eq(projectTasks.id, projectTaskLinks.sourceTaskId))
    .where(eq(projectTasks.projectId, projectId));
  return rows.map((r) => r.link);
}

export async function addProjectCost(input: CreateProjectCostInput): Promise<ProjectCost> {
  const [created] = await db
    .insert(projectCosts)
    .values({
      projectId: input.projectId,
      amountCents: input.amountCents,
      budgetId: input.budgetId ?? null,
      beginDate: input.beginDate ?? null,
      endDate: input.endDate ?? null,
      comment: input.comment ?? null,
    })
    .returning();
  if (!created) throw new Error("Failed to insert project cost");
  return created;
}

export async function listProjectCosts(projectId: string): Promise<ProjectCost[]> {
  return db.select().from(projectCosts).where(eq(projectCosts.projectId, projectId)).orderBy(projectCosts.createdAt);
}

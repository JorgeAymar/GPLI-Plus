"use server";

import { requireAuthContext } from "@/lib/session";
import {
  MODULE,
  RIGHT,
  addProjectCost,
  addProjectTaskLink,
  addProjectTeamMember,
  createProject,
  createProjectCostSchema,
  createProjectSchema,
  createProjectTask,
  createProjectTaskLinkSchema,
  createProjectTaskSchema,
  createProjectTeamMemberSchema,
  getProject,
  requireRight,
  requireRightOnEntity,
  updateProject,
  updateProjectSchema,
} from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createProjectAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.TOOLS_PROJECT, RIGHT.CREATE);
  const parsed = createProjectSchema.parse(input);
  const project = await createProject(parsed);
  revalidatePath("/tools/projects");
  return project;
}

/**
 * See requireTicketRight in tickets.actions.ts for why this checks the project's own entity
 * rather than the caller's active entity - used both for editing the project itself and for
 * adding tasks/team members/costs to it, since all of those act on an existing project.
 */
async function requireProjectRight(projectId: string, required: number) {
  const context = await requireAuthContext();
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  await requireRightOnEntity(context, MODULE.TOOLS_PROJECT, required, project.entityId);
  return context;
}

export async function updateProjectAction(id: string, input: unknown) {
  await requireProjectRight(id, RIGHT.UPDATE);
  const parsed = updateProjectSchema.parse(input);
  const project = await updateProject(id, parsed);
  revalidatePath("/tools/projects");
  revalidatePath(`/tools/projects/${id}`);
  return project;
}

// Adding a task/team member/cost to a project modifies that project's related
// data, so - like linkContractAssetAction in contracts.actions.ts - these
// require UPDATE on the project module rather than CREATE.
export async function createProjectTaskAction(input: unknown) {
  const parsed = createProjectTaskSchema.parse(input);
  await requireProjectRight(parsed.projectId, RIGHT.UPDATE);
  const task = await createProjectTask(parsed);
  revalidatePath(`/tools/projects/${parsed.projectId}`);
  return task;
}

export async function addProjectTeamMemberAction(input: unknown) {
  const parsed = createProjectTeamMemberSchema.parse(input);
  await requireProjectRight(parsed.projectId, RIGHT.UPDATE);
  const member = await addProjectTeamMember(parsed);
  revalidatePath(`/tools/projects/${parsed.projectId}`);
  return member;
}

// createProjectTaskLinkSchema has no projectId (a link is keyed by two task
// ids), so the caller passes it separately purely to know which detail page
// to revalidate.
export async function addProjectTaskLinkAction(input: unknown, projectId: string) {
  await requireProjectRight(projectId, RIGHT.UPDATE);
  const parsed = createProjectTaskLinkSchema.parse(input);
  const link = await addProjectTaskLink(parsed);
  revalidatePath(`/tools/projects/${projectId}`);
  return link;
}

export async function addProjectCostAction(input: unknown) {
  const parsed = createProjectCostSchema.parse(input);
  await requireProjectRight(parsed.projectId, RIGHT.UPDATE);
  const cost = await addProjectCost(parsed);
  revalidatePath(`/tools/projects/${parsed.projectId}`);
  return cost;
}

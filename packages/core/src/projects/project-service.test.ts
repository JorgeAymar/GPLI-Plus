import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, projectCosts, projectTaskLinks, projectTasks, projectTeamMembers, projects, type Entity } from "@itsm/db";
import { createTestEntity, deleteTestEntities } from "../__vitest_tools__/fixtures";
import {
  addProjectCost,
  addProjectTaskLink,
  addProjectTeamMember,
  createProject,
  createProjectTask,
  getProject,
  listProjectCosts,
  listProjectTaskLinks,
  listProjectTasks,
  listProjectTeamMembers,
  listProjects,
  recalculateProjectPercentDone,
  removeProjectTeamMember,
  updateProject,
  updateProjectTask,
} from "./project-service";

describe("project-service", () => {
  let entity: Entity;
  const entityIds: string[] = [];
  const projectIds: string[] = [];
  const taskIds: string[] = [];

  beforeAll(async () => {
    entity = await createTestEntity();
    entityIds.push(entity.id);
  });

  afterAll(async () => {
    for (const taskId of taskIds) {
      await db.delete(projectTaskLinks).where(eq(projectTaskLinks.sourceTaskId, taskId));
      await db.delete(projectTaskLinks).where(eq(projectTaskLinks.targetTaskId, taskId));
    }
    for (const projectId of projectIds) {
      await db.delete(projectCosts).where(eq(projectCosts.projectId, projectId));
      await db.delete(projectTeamMembers).where(eq(projectTeamMembers.projectId, projectId));
      await db.delete(projectTasks).where(eq(projectTasks.projectId, projectId));
    }
    if (projectIds.length > 0) {
      await db.delete(projects).where(eq(projects.entityId, entity.id));
    }
    await deleteTestEntities(entityIds);
  });

  async function makeProject(overrides?: Partial<Parameters<typeof createProject>[0]>) {
    const project = await createProject({ entityId: entity.id, name: `__vitest_tools__ project ${crypto.randomUUID().slice(0, 8)}`, ...overrides });
    projectIds.push(project.id);
    return project;
  }

  it("createProject + getProject + updateProject roundtrip", async () => {
    const project = await makeProject({ code: "PRJ-1" });
    const fetched = await getProject(project.id);
    expect(fetched?.code).toBe("PRJ-1");

    const updated = await updateProject(project.id, { name: "__vitest_tools__ renamed" });
    expect(updated.name).toBe("__vitest_tools__ renamed");
  });

  it("listProjects scopes by entity, excludes templates by default, and can include them", async () => {
    const real = await makeProject();
    const template = await makeProject({ isTemplate: true });

    const withoutTemplates = await listProjects(entity.id);
    expect(withoutTemplates.map((p) => p.id)).toContain(real.id);
    expect(withoutTemplates.map((p) => p.id)).not.toContain(template.id);

    const withTemplates = await listProjects(entity.id, { includeTemplates: true });
    expect(withTemplates.map((p) => p.id)).toContain(template.id);
  });

  it("listProjects excludes soft-deleted projects", async () => {
    const project = await makeProject();
    await db.update(projects).set({ deletedAt: new Date() }).where(eq(projects.id, project.id));

    const listed = await listProjects(entity.id);
    expect(listed.map((p) => p.id)).not.toContain(project.id);
  });

  it("createProjectTask + updateProjectTask + listProjectTasks", async () => {
    const project = await makeProject();
    const task = await createProjectTask({ projectId: project.id, name: "__vitest_tools__ task" });
    taskIds.push(task.id);

    const updated = await updateProjectTask(task.id, { percentDone: 42 });
    expect(updated.percentDone).toBe(42);

    const listed = await listProjectTasks(project.id);
    expect(listed.map((t) => t.id)).toContain(task.id);
  });

  it("recalculateProjectPercentDone is a no-op when autoPercentDone is false", async () => {
    const project = await makeProject({ autoPercentDone: false, percentDone: 10 });
    const result = await recalculateProjectPercentDone(project.id);
    expect(result.percentDone).toBe(10);
  });

  it("recalculateProjectPercentDone averages top-level tasks when autoPercentDone is true", async () => {
    const project = await makeProject({ autoPercentDone: true });
    const taskA = await createProjectTask({ projectId: project.id, name: "__vitest_tools__ task A", percentDone: 20 });
    const taskB = await createProjectTask({ projectId: project.id, name: "__vitest_tools__ task B", percentDone: 60 });
    taskIds.push(taskA.id, taskB.id);

    const result = await recalculateProjectPercentDone(project.id);
    expect(result.percentDone).toBe(40); // (20 + 60) / 2
  });

  it("recalculateProjectPercentDone bubbles the average up to the parent project", async () => {
    const parent = await makeProject({ autoPercentDone: true, percentDone: 0 });
    const child = await makeProject({ autoPercentDone: false, percentDone: 80, parentProjectId: parent.id });
    // Give the parent a top-level task too, so it has something besides the child sub-project to average -
    // recalculateProjectPercentDone averages sub-projects + top-level tasks together.
    const parentTask = await createProjectTask({ projectId: parent.id, name: "__vitest_tools__ parent task", percentDone: 20 });
    taskIds.push(parentTask.id);

    await recalculateProjectPercentDone(child.id);
    const parentAfter = await getProject(parent.id);
    // recalculateProjectPercentDone was only called on the child, which has no auto-percent itself and
    // no sub-projects/tasks of its own to average - it returns as-is without touching the parent, since
    // only *its own* percentDone recalculation (if autoPercentDone) bubbles upward.
    expect(parentAfter?.percentDone).toBe(0);

    // Now trigger it from the parent directly - it should average [child.percentDone, parentTask.percentDone].
    const recalculated = await recalculateProjectPercentDone(parent.id);
    expect(recalculated.percentDone).toBe(50); // (80 + 20) / 2
  });

  it("addProjectTeamMember + listProjectTeamMembers + removeProjectTeamMember", async () => {
    const project = await makeProject();
    const member = await addProjectTeamMember({ projectId: project.id, memberKind: "user", memberId: crypto.randomUUID() });

    let members = await listProjectTeamMembers(project.id);
    expect(members.map((m) => m.id)).toContain(member.id);

    await removeProjectTeamMember(member.id);
    members = await listProjectTeamMembers(project.id);
    expect(members.map((m) => m.id)).not.toContain(member.id);
  });

  it("addProjectTaskLink rejects a link that would create a cycle", async () => {
    const project = await makeProject();
    const taskA = await createProjectTask({ projectId: project.id, name: "__vitest_tools__ A" });
    const taskB = await createProjectTask({ projectId: project.id, name: "__vitest_tools__ B" });
    taskIds.push(taskA.id, taskB.id);

    await addProjectTaskLink({ sourceTaskId: taskA.id, targetTaskId: taskB.id });

    await expect(addProjectTaskLink({ sourceTaskId: taskB.id, targetTaskId: taskA.id })).rejects.toThrow(/ciclo/);

    const links = await listProjectTaskLinks(project.id);
    expect(links).toHaveLength(1);
  });

  it("addProjectCost + listProjectCosts", async () => {
    const project = await makeProject();
    const cost = await addProjectCost({ projectId: project.id, amountCents: 12_345 });

    const costs = await listProjectCosts(project.id);
    expect(costs.map((c) => c.id)).toContain(cost.id);
    expect(costs.find((c) => c.id === cost.id)?.amountCents).toBe(12_345);
  });
});

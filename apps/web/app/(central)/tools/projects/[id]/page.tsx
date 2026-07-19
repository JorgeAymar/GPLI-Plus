import { requireAuthContext } from "@/lib/session";
import {
  DROPDOWN_CATEGORY,
  getDropdownCategoryByKey,
  getProject,
  listDropdownItems,
  listProjectCosts,
  listProjectTasks,
  listProjectTeamMembers,
  listUsers,
} from "@itsm/core";
import type { ProjectTask } from "@itsm/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectCostForm } from "./project-cost-form";
import { ProjectTaskForm } from "./project-task-form";
import { ProjectTeamForm } from "./project-team-form";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(id);
  return { title: project?.name ?? "Proyecto" };
}

/** Flattens the parentTaskId tree into ordered rows with a depth, so the list can indent by CSS instead of nested JSX. */
function buildTaskRows(tasks: ProjectTask[]): { task: ProjectTask; depth: number }[] {
  const childrenByParent = new Map<string, ProjectTask[]>();
  const roots: ProjectTask[] = [];
  for (const task of tasks) {
    if (task.parentTaskId) {
      const siblings = childrenByParent.get(task.parentTaskId) ?? [];
      siblings.push(task);
      childrenByParent.set(task.parentTaskId, siblings);
    } else {
      roots.push(task);
    }
  }

  const rows: { task: ProjectTask; depth: number }[] = [];
  function walk(nodes: ProjectTask[], depth: number) {
    for (const task of nodes) {
      rows.push({ task, depth });
      walk(childrenByParent.get(task.id) ?? [], depth + 1);
    }
  }
  walk(roots, 0);
  return rows;
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireAuthContext();

  const project = await getProject(id);
  if (!project) notFound();

  const [tasks, teamMembers, costs, users, taskStateCategory] = await Promise.all([
    listProjectTasks(id),
    listProjectTeamMembers(id),
    listProjectCosts(id),
    listUsers(),
    getDropdownCategoryByKey(DROPDOWN_CATEGORY.PROJECT_TASK_STATE),
  ]);

  const taskStateItems = taskStateCategory ? await listDropdownItems(taskStateCategory.id, context.activeEntity.id) : [];
  const taskRows = buildTaskRows(tasks);

  // Kanban: one column per project_task_state dropdown item visible from the
  // active entity, plus a catch-all "Sin estado" column for tasks with no
  // state or a state from outside that visible set.
  const knownStateIds = new Set(taskStateItems.map((item) => item.id));
  const columns = [
    ...taskStateItems.map((item) => ({
      key: item.id,
      label: item.name,
      tasks: tasks.filter((t) => t.projectTaskStateDropdownItemId === item.id),
    })),
    {
      key: "none",
      label: "Sin estado",
      tasks: tasks.filter((t) => !t.projectTaskStateDropdownItemId || !knownStateIds.has(t.projectTaskStateDropdownItemId)),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <dl className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <dt className="opacity-60">Código</dt>
          <dd>{project.code ?? "-"}</dd>
          <dt className="opacity-60">Prioridad</dt>
          <dd>{project.priority}</dd>
          <dt className="opacity-60">Inicio planeado</dt>
          <dd>{project.planStartAt ? project.planStartAt.toLocaleDateString() : "-"}</dd>
          <dt className="opacity-60">Fin planeado</dt>
          <dd>{project.planEndAt ? project.planEndAt.toLocaleDateString() : "-"}</dd>
          <dt className="opacity-60">Avance</dt>
          <dd>{project.percentDone}%</dd>
        </dl>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Tareas</h2>
          <ul className="space-y-1">
            {taskRows.map(({ task, depth }) => (
              <li key={task.id} className="text-sm" style={{ paddingLeft: `${depth * 16}px` }}>
                {task.isMilestone ? "◆ " : ""}
                {task.name} <span className="opacity-40">({task.percentDone}%)</span>
              </li>
            ))}
            {taskRows.length === 0 ? <li className="text-sm opacity-50">Sin tareas todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nueva tarea</h2>
          <ProjectTaskForm projectId={id} tasks={tasks} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Equipo</h2>
          <ul className="space-y-1">
            {teamMembers.map((m) => (
              <li key={m.id} className="text-sm">
                {users.find((u) => u.id === m.memberId)?.displayName ?? m.memberId} <span className="opacity-40">({m.role})</span>
              </li>
            ))}
            {teamMembers.length === 0 ? <li className="text-sm opacity-50">Sin miembros todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Agregar miembro</h2>
          <ProjectTeamForm projectId={id} users={users} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Costos</h2>
          <ul className="space-y-1">
            {costs.map((c) => (
              <li key={c.id} className="text-sm">
                ${(c.amountCents / 100).toFixed(2)} {c.comment ? <span className="opacity-40">· {c.comment}</span> : null}
              </li>
            ))}
            {costs.length === 0 ? <li className="text-sm opacity-50">Sin costos todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Agregar costo</h2>
          <ProjectCostForm projectId={id} />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium opacity-70">Kanban por estado de tarea</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          {columns.map((col) => (
            <div key={col.key} className="rounded-md border border-black/10 p-3 dark:border-white/10">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide opacity-60">{col.label}</h3>
              <ul className="space-y-1">
                {col.tasks.map((t) => (
                  <li key={t.id} className="rounded bg-black/5 px-2 py-1 text-sm dark:bg-white/5">
                    {t.name}
                  </li>
                ))}
                {col.tasks.length === 0 ? <li className="text-xs opacity-40">Vacío</li> : null}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

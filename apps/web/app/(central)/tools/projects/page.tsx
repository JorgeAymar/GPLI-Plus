import { requireAuthContext } from "@/lib/session";
import { listProjects } from "@itsm/core";
import Link from "next/link";
import { ProjectForm } from "./project-form";

export default async function ProjectsPage() {
  const context = await requireAuthContext();
  const allProjects = await listProjects(context.activeEntity.id, { includeSubtree: true });
  // Top-level only here (parentProjectId IS NULL) - listProjects() itself
  // stays generic (used elsewhere for the full subtree, e.g. building the
  // Kanban/percent-done rollups), so the "top-level" filter lives in this page.
  const topLevelProjects = allProjects.filter((p) => !p.parentProjectId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Proyectos</h1>
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Existentes</h2>
          <ul className="space-y-1">
            {topLevelProjects.map((p) => (
              <li key={p.id} className="text-sm">
                <Link href={`/tools/projects/${p.id}`} className="hover:underline">
                  {p.name}
                </Link>{" "}
                <span className="opacity-40">
                  {p.code ? `[${p.code}] ` : ""}({p.percentDone}%)
                </span>
              </li>
            ))}
            {topLevelProjects.length === 0 ? <li className="text-sm opacity-50">Sin proyectos todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nuevo proyecto</h2>
          <ProjectForm entityId={context.activeEntity.id} />
        </div>
      </div>
    </div>
  );
}

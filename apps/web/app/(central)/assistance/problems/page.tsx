import { requireAuthContext } from "@/lib/session";
import { getDropdownCategoryByKey, listDropdownItems, listProblems } from "@itsm/core";
import Link from "next/link";
import { ProblemForm } from "./problem-form";

export default async function ProblemsPage() {
  const context = await requireAuthContext();
  const problems = await listProblems(context.activeEntity.id, { includeSubtree: true });

  // itil_category is the shared category dropdown for tickets/problems/changes (see seed.ts).
  const categoryCategory = await getDropdownCategoryByKey("itil_category");
  const categoryOptions = categoryCategory ? await listDropdownItems(categoryCategory.id, context.activeEntity.id) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Problemas</h1>
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Existentes</h2>
          <ul className="space-y-1">
            {problems.map((p) => (
              <li key={p.id}>
                <Link href={`/assistance/problems/${p.id}`} className="text-sm hover:underline">
                  {p.title} <span className="opacity-40">({p.status})</span>
                </Link>
              </li>
            ))}
            {problems.length === 0 ? <li className="text-sm opacity-50">Sin problemas todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nuevo problema</h2>
          <ProblemForm entityId={context.activeEntity.id} categoryOptions={categoryOptions} />
        </div>
      </div>
    </div>
  );
}

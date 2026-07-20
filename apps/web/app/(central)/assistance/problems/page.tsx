import { requireAuthContext } from "@/lib/session";
import { StatusBadge } from "@/components/status-badge";
import { DROPDOWN_CATEGORY, getDropdownCategoryByKey, listDropdownItems, listProblems } from "@itsm/core";
import Link from "next/link";
import { ProblemForm } from "./problem-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Problemas" };

export default async function ProblemsPage() {
  const context = await requireAuthContext();
  const problems = await listProblems(context.activeEntity.id, { includeSubtree: true });

  // ITIL_CATEGORY is the shared category dropdown for tickets/problems/changes (see seed.ts).
  const categoryCategory = await getDropdownCategoryByKey(DROPDOWN_CATEGORY.ITIL_CATEGORY);
  const categoryOptions = categoryCategory ? await listDropdownItems(categoryCategory.id, context.activeEntity.id) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Problemas</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Existentes</h2>
          <ul className="space-y-1">
            {problems.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <Link href={`/assistance/problems/${p.id}`} className="text-sm hover:underline">
                  {p.title}
                </Link>
                <StatusBadge status={p.status} />
              </li>
            ))}
            {problems.length === 0 ? <li className="text-sm opacity-50">Sin problemas todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-60">Nuevo problema</h2>
          <ProblemForm entityId={context.activeEntity.id} categoryOptions={categoryOptions} />
        </div>
      </div>
    </div>
  );
}

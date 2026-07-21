import { requireAuthContext } from "@/lib/session";
import { listGroups } from "@itsm/core";
import Link from "next/link";
import { GroupForm } from "./group-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Grupos" };

export default async function GroupsPage() {
  const context = await requireAuthContext();
  const groups = await listGroups(context.activeEntity.id, { includeSubtree: true });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Grupos</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
          <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">Existentes</h2>
          <ul className="divide-y divide-black/5 dark:divide-white/5">
            {groups.map((g) => (
              <li key={g.id} className="py-2 text-sm">
                <Link href={`/administration/groups/${g.id}`} className="hover:underline">
                  {g.name}
                </Link>
              </li>
            ))}
            {groups.length === 0 ? <li className="py-2 text-sm opacity-50">Sin grupos todavía.</li> : null}
          </ul>
        </div>
        <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
          <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-medium opacity-60 dark:border-white/10">Nuevo grupo</h2>
          <GroupForm entityId={context.activeEntity.id} />
        </div>
      </div>
    </div>
  );
}

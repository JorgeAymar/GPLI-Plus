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
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Existentes</h2>
          <ul className="space-y-1">
            {groups.map((g) => (
              <li key={g.id} className="text-sm">
                <Link href={`/administration/groups/${g.id}`} className="hover:underline">
                  {g.name}
                </Link>
              </li>
            ))}
            {groups.length === 0 ? <li className="text-sm opacity-50">Sin grupos todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nuevo grupo</h2>
          <GroupForm entityId={context.activeEntity.id} />
        </div>
      </div>
    </div>
  );
}

import { listAllEntities } from "@itsm/core";
import { EntityForm } from "./entity-form";
import { EntityTree } from "./entity-tree";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Entidades" };

export default async function EntitiesPage() {
  const entities = await listAllEntities();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Entidades</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
          <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">Árbol de entidades</h2>
          <EntityTree entities={entities} />
        </div>
        <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
          <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-medium opacity-60 dark:border-white/10">Nueva entidad</h2>
          <EntityForm entities={entities} />
        </div>
      </div>
    </div>
  );
}

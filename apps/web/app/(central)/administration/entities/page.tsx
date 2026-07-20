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
        <div>
          <h2 className="mb-2 text-sm font-semibold">Árbol de entidades</h2>
          <EntityTree entities={entities} />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-60">Nueva entidad</h2>
          <EntityForm entities={entities} />
        </div>
      </div>
    </div>
  );
}

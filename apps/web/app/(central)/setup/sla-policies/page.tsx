import { requireAuthContext } from "@/lib/session";
import { listSlaPolicies } from "@itsm/core";
import { SlaPolicyForm } from "./sla-policy-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Políticas SLA" };

export default async function SlaPoliciesPage() {
  const context = await requireAuthContext();
  const policies = await listSlaPolicies(context.activeEntity.id, { includeSubtree: true });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Políticas SLA</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
          <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">Existentes</h2>
          <ul className="space-y-1">
            {policies.map((p) => (
              <li key={p.id} className="text-sm">
                {p.name}{" "}
                <span className="opacity-40">
                  (respuesta: {p.ttoMinutes ? `${p.ttoMinutes}min` : "N/A"}, resolución: {p.ttrMinutes ? `${p.ttrMinutes}min` : "N/A"})
                </span>
              </li>
            ))}
            {policies.length === 0 ? <li className="text-sm opacity-50">Sin políticas todavía.</li> : null}
          </ul>
        </div>
        <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
          <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-medium opacity-60 dark:border-white/10">Nueva política</h2>
          <SlaPolicyForm entityId={context.activeEntity.id} />
        </div>
      </div>
    </div>
  );
}

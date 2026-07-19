import { requireAuthContext } from "@/lib/session";
import { getAsset, listInventoryAgents, listLockedFields, listSubmissionsForAgent } from "@itsm/core";
import { AcceptUnmanagedButton } from "./accept-unmanaged-button";
import { LockFieldForm } from "./lock-field-form";

function formatDate(date: Date | null | undefined): string {
  return date ? new Date(date).toLocaleString("es") : "-";
}

const STATUS_LABEL: Record<string, string> = {
  pending: "pendiente",
  processed: "procesado",
  rejected: "rechazado",
};

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Agentes de inventario" };

export default async function InventoryAgentsPage() {
  const context = await requireAuthContext();
  const agents = await listInventoryAgents(context.activeEntity.id, { includeSubtree: true });

  const agentDetails = await Promise.all(
    agents.map(async (agent) => {
      const [asset, submissions] = await Promise.all([
        agent.assetId ? getAsset(agent.assetId) : Promise.resolve(undefined),
        listSubmissionsForAgent(agent.id),
      ]);
      const lockedFields = asset ? await listLockedFields(asset.id) : [];
      return { agent, asset, lockedFields, submissions: submissions.slice(0, 5) };
    }),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Agentes de inventario</h1>
      <p className="text-sm opacity-60">
        Máquinas que reportan su inventario automáticamente vía el protocolo JSON del agente. Cada envío queda auditado abajo, matchee
        o no con un activo existente.
      </p>

      <ul className="space-y-6">
        {agentDetails.map(({ agent, asset, lockedFields, submissions }) => (
          <li key={agent.id} className="rounded-md border border-black/10 p-4 dark:border-white/10">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{agent.name}</p>
                <p className="text-xs opacity-60">deviceId: {agent.deviceId}</p>
              </div>
              <p className="text-xs opacity-60">Último contacto: {formatDate(agent.lastContactAt)}</p>
            </div>

            <p className="mt-2 text-sm">
              Activo vinculado:{" "}
              {asset ? asset.name : <span className="opacity-50">(ninguno todavía - esperando primer envío procesado)</span>}
            </p>

            <div className="mt-3">
              <h3 className="mb-1 text-xs font-medium uppercase opacity-60">Últimos envíos</h3>
              <ul className="space-y-1">
                {submissions.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span>
                      <span
                        className={
                          s.status === "processed" ? "text-green-600" : s.status === "rejected" ? "text-red-600" : "opacity-70"
                        }
                      >
                        {STATUS_LABEL[s.status] ?? s.status}
                      </span>{" "}
                      <span className="opacity-50">({formatDate(s.receivedAt)})</span>
                      {s.rejectionReason ? <span className="opacity-50"> - {s.rejectionReason}</span> : null}
                    </span>
                    {s.status !== "processed" ? <AcceptUnmanagedButton submissionId={s.id} /> : null}
                  </li>
                ))}
                {submissions.length === 0 ? <li className="text-sm opacity-50">Sin envíos todavía.</li> : null}
              </ul>
            </div>

            {asset ? (
              <div className="mt-3">
                <h3 className="mb-1 text-xs font-medium uppercase opacity-60">
                  Campos bloqueados{lockedFields.length > 0 ? ` (${lockedFields.map((f) => f.fieldName).join(", ")})` : ""}
                </h3>
                <LockFieldForm assetId={asset.id} />
              </div>
            ) : null}
          </li>
        ))}
        {agentDetails.length === 0 ? <li className="text-sm opacity-50">Sin agentes de inventario todavía.</li> : null}
      </ul>
    </div>
  );
}

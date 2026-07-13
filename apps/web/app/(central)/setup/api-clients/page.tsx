import { requireAuthContext } from "@/lib/session";
import { listApiClients, MODULE } from "@itsm/core";
import { ApiClientForm } from "./api-client-form";
import { RevokeApiClientButton } from "./revoke-api-client-button";

export default async function ApiClientsPage() {
  const context = await requireAuthContext();
  const clients = await listApiClients(context.activeEntity.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Clientes API</h1>
      <p className="max-w-2xl text-sm opacity-70">
        Tokens tipo bearer (estilo Stripe) para que scripts propios del cliente consuman la API REST pública en{" "}
        <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">/api/v1/&lt;itemtype&gt;</code>. No es un servidor
        OAuth2 - cada cliente tiene un scope fijo (módulos permitidos) asignado al crearlo.
      </p>

      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Clientes existentes</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left opacity-60">
                <th className="pb-2">Nombre</th>
                <th className="pb-2">Prefijo</th>
                <th className="pb-2">Scopes</th>
                <th className="pb-2">Estado</th>
                <th className="pb-2">Último uso</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-t border-black/5 dark:border-white/5">
                  <td className="py-2">{c.name}</td>
                  <td className="py-2 font-mono opacity-70">{c.apiKeyPrefix}…</td>
                  <td className="py-2 opacity-70">{c.scopes.length > 0 ? c.scopes.join(", ") : "-"}</td>
                  <td className="py-2">
                    {c.isActive ? (
                      <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-xs text-green-700 dark:text-green-400">
                        Activo
                      </span>
                    ) : (
                      <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-xs text-red-700 dark:text-red-400">
                        Revocado
                      </span>
                    )}
                  </td>
                  <td className="py-2 opacity-70">{c.lastUsedAt ? c.lastUsedAt.toLocaleString() : "Nunca"}</td>
                  <td className="py-2">{c.isActive ? <RevokeApiClientButton id={c.id} /> : null}</td>
                </tr>
              ))}
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-2 opacity-50">
                    Sin clientes API todavía.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nuevo cliente API</h2>
          <ApiClientForm entityId={context.activeEntity.id} scopeOptions={Object.values(MODULE)} />
        </div>
      </div>
    </div>
  );
}

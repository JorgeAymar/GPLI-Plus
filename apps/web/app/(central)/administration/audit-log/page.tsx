import Link from "next/link";
import { requireAuthContext } from "@/lib/session";
import { countAuditLog, listAuditLog, MODULE, requireRight, RIGHT } from "@itsm/core";

const PAGE_SIZE = 50;

interface AuditLogSearchParams {
  objectType?: string;
  actorUserId?: string;
  from?: string;
  to?: string;
  page?: string;
}

/** `from`/`to` come from <input type="date"> (day granularity) - widen to the full local day so the range is inclusive. */
function parseDateStart(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00.000`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseDateEnd(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Builds a pagination link that preserves every filter already in the URL, only overriding `page`. */
function buildHref(params: AuditLogSearchParams, page: number): string {
  const query = new URLSearchParams();
  if (params.objectType) query.set("objectType", params.objectType);
  if (params.actorUserId) query.set("actorUserId", params.actorUserId);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  query.set("page", String(page));
  return `/administration/audit-log?${query.toString()}`;
}

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Registro de auditoría" };

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<AuditLogSearchParams> }) {
  const params = await searchParams;

  const context = await requireAuthContext();
  await requireRight(context, MODULE.ADMINISTRATION_AUDIT_LOG, RIGHT.READ);

  const parsedPage = Number(params.page);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;

  const filters = {
    objectType: params.objectType || undefined,
    actorUserId: params.actorUserId || undefined,
    from: parseDateStart(params.from),
    to: parseDateEnd(params.to),
  };

  const [entries, total] = await Promise.all([
    listAuditLog(filters, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    countAuditLog(filters),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Registro de auditoría</h1>

      <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
      <form className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="objectType" className="text-xs opacity-70">
            Tipo de objeto
          </label>
          <input
            id="objectType"
            name="objectType"
            type="text"
            defaultValue={params.objectType ?? ""}
            placeholder="ej. kb_article"
            className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="actorUserId" className="text-xs opacity-70">
            Usuario (UUID)
          </label>
          <input
            id="actorUserId"
            name="actorUserId"
            type="text"
            defaultValue={params.actorUserId ?? ""}
            placeholder="UUID del usuario"
            className="w-56 rounded-md border border-black/15 bg-transparent px-3 py-2 font-mono text-sm dark:border-white/15"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="from" className="text-xs opacity-70">
            Desde
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={params.from ?? ""}
            className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="to" className="text-xs opacity-70">
            Hasta
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={params.to ?? ""}
            className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
          />
        </div>
        <button type="submit" className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15">
          Filtrar
        </button>
      </form>

      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="pb-2 text-[11px] font-bold tracking-wider text-black/60 uppercase dark:text-white/60">Fecha</th>
            <th className="pb-2 text-[11px] font-bold tracking-wider text-black/60 uppercase dark:text-white/60">Acción</th>
            <th className="pb-2 text-[11px] font-bold tracking-wider text-black/60 uppercase dark:text-white/60">Tipo</th>
            <th className="pb-2 text-[11px] font-bold tracking-wider text-black/60 uppercase dark:text-white/60">Objeto</th>
            <th className="pb-2 text-[11px] font-bold tracking-wider text-black/60 uppercase dark:text-white/60">Usuario</th>
            <th className="pb-2 text-[11px] font-bold tracking-wider text-black/60 uppercase dark:text-white/60">Cambios</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-t border-black/5 align-top dark:border-white/5">
              <td className="whitespace-nowrap py-2 opacity-70">{entry.createdAt.toLocaleString()}</td>
              <td className="py-2">{entry.action}</td>
              <td className="py-2 opacity-70">{entry.objectType}</td>
              <td className="py-2 font-mono text-xs opacity-70" title={entry.objectId}>
                {entry.objectId.slice(0, 8)}…
              </td>
              <td className="py-2 font-mono text-xs opacity-70">{entry.actorUserId ?? "sistema"}</td>
              <td className="py-2">
                <details>
                  <summary className="cursor-pointer text-xs opacity-70">Ver cambios</summary>
                  <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-black/5 p-2 text-xs dark:bg-white/5">
                    {JSON.stringify({ before: entry.before, after: entry.after }, null, 2)}
                  </pre>
                </details>
              </td>
            </tr>
          ))}
          {entries.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-2 opacity-50">
                Sin registros de auditoría para estos filtros.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="opacity-70">
          Página {page} de {totalPages} ({total} registros)
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link href={buildHref(params, page - 1)} className="rounded-md border border-black/15 px-3 py-1.5 dark:border-white/15">
              Anterior
            </Link>
          ) : null}
          {page < totalPages ? (
            <Link href={buildHref(params, page + 1)} className="rounded-md border border-black/15 px-3 py-1.5 dark:border-white/15">
              Siguiente
            </Link>
          ) : null}
        </div>
      </div>
      </div>
    </div>
  );
}

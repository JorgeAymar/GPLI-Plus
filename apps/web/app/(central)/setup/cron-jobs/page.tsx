import { requireAuthContext } from "@/lib/session";
import { listCronSchedules, listRecentJobRuns, MODULE, requireRight, RIGHT } from "@itsm/core";

const RECENT_RUNS_LIMIT = 50;

// pg-boss job states: created, retry, active, completed, cancelled, failed.
function stateColorClass(state: string): string {
  if (state === "completed") return "text-green-600 dark:text-green-400";
  if (state === "failed") return "text-red-600 dark:text-red-400";
  return "opacity-60";
}

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Trabajos programados" };

export default async function CronJobsPage() {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.SETUP_CRON, RIGHT.READ);

  const [schedules, runs] = await Promise.all([listCronSchedules(), listRecentJobRuns(RECENT_RUNS_LIMIT)]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Trabajos programados</h1>
        <p className="mt-1 text-sm opacity-60">
          Vista de solo lectura de los jobs de pg-boss registrados por el worker. No es posible ejecutar un job manualmente
          desde aquí.
        </p>
      </div>

      <section className="rounded-md border border-black/10 p-6 dark:border-white/10">
        <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">Horarios programados (pgboss.schedule)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left opacity-60">
              <th className="pb-2">Cola</th>
              <th className="pb-2">Expresión cron</th>
              <th className="pb-2">Zona horaria</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((s) => (
              <tr key={s.name} className="border-t border-black/5 dark:border-white/5">
                <td className="py-2">{s.name}</td>
                <td className="py-2 font-mono opacity-70">{s.cron}</td>
                <td className="py-2 opacity-70">{s.timezone ?? "UTC"}</td>
              </tr>
            ))}
            {schedules.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-2 opacity-50">
                  Sin horarios programados todavía.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="rounded-md border border-black/10 p-6 dark:border-white/10">
        <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">
          Últimas ejecuciones (pgboss.job, últimas {RECENT_RUNS_LIMIT})
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left opacity-60">
              <th className="pb-2">Cola</th>
              <th className="pb-2">Estado</th>
              <th className="pb-2">Creado</th>
              <th className="pb-2">Iniciado</th>
              <th className="pb-2">Completado</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r, i) => (
              <tr key={i} className="border-t border-black/5 dark:border-white/5">
                <td className="py-2">{r.name}</td>
                <td className={`py-2 font-medium ${stateColorClass(r.state)}`}>{r.state}</td>
                <td className="py-2 opacity-70">{r.createdOn.toLocaleString()}</td>
                <td className="py-2 opacity-70">{r.startedOn ? r.startedOn.toLocaleString() : "-"}</td>
                <td className="py-2 opacity-70">{r.completedOn ? r.completedOn.toLocaleString() : "-"}</td>
              </tr>
            ))}
            {runs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-2 opacity-50">
                  Sin ejecuciones todavía.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

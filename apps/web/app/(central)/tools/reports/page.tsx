import { requireAuthContext } from "@/lib/session";
import { getEffectiveRights, hasRight, MODULE, RIGHT } from "@itsm/core";
import Link from "next/link";

interface ReportLink {
  href: string;
  label: string;
  description: string;
  /** Reports has no data of its own - visibility is gated by READ on the module that owns the underlying rows. */
  moduleKey: string;
}

const REPORT_LINKS: ReportLink[] = [
  {
    href: "/tools/reports/assets-by-type",
    label: "Activos por tipo",
    description: "Cantidad de activos agrupados por tipo.",
    moduleKey: MODULE.ASSETS_GENERIC,
  },
  {
    href: "/tools/reports/assets-by-status",
    label: "Activos por estado",
    description: "Cantidad de activos agrupados por estado.",
    moduleKey: MODULE.ASSETS_GENERIC,
  },
  {
    href: "/tools/reports/yearly-assets",
    label: "Altas de activos por año",
    description: "Activos dados de alta, agrupados por año de creación.",
    moduleKey: MODULE.ASSETS_GENERIC,
  },
  {
    href: "/tools/reports/contracts-expiring",
    label: "Contratos por vencer",
    description: "Contratos cuya fecha de fin cae dentro de los próximos N días.",
    moduleKey: MODULE.MANAGEMENT_CONTRACT,
  },
  {
    href: "/tools/reports/tickets-by-status",
    label: "Tickets por estado",
    description: "Cantidad de tickets agrupados por estado.",
    moduleKey: MODULE.ASSISTANCE_TICKET,
  },
  {
    href: "/tools/reports/reservations-usage",
    label: "Uso de reservas",
    description: "Cantidad de reservas agrupadas por activo.",
    moduleKey: MODULE.TOOLS_RESERVATION,
  },
  {
    href: "/tools/reports/tickets-created-by-day",
    label: "Tickets creados por día",
    description: "Serie temporal de tickets creados en los últimos 30 días.",
    moduleKey: MODULE.TOOLS_REPORT,
  },
  {
    href: "/tools/reports/sla-compliance",
    label: "Cumplimiento de SLA",
    description: "Porcentaje de asignaciones SLA de tickets cumplidas en los últimos 30 días.",
    moduleKey: MODULE.TOOLS_REPORT,
  },
];

export default async function ReportsIndexPage() {
  const context = await requireAuthContext();

  // Menú dinámico condicionado por permisos: para cada link se consulta
  // RIGHT.READ sobre el módulo dueño de los datos (activos/contratos/tickets),
  // no sobre MODULE.TOOLS_REPORT - igual que en el GLPI original, "Reports"
  // es una vista sin permisos propios sobre los datos que agrega.
  const visibleLinks = (
    await Promise.all(
      REPORT_LINKS.map(async (link) => {
        const rights = await getEffectiveRights(context.user.id, context.activeEntity.id, link.moduleKey);
        return hasRight(rights, RIGHT.READ) ? link : null;
      }),
    )
  ).filter((link): link is ReportLink => link !== null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reportes</h1>
      <p className="text-sm opacity-70">Agregaciones on-the-fly sobre datos existentes - este módulo no tiene tablas propias.</p>

      {visibleLinks.length === 0 ? (
        <p className="text-sm opacity-50">No tenés permisos de lectura sobre ningún reporte disponible.</p>
      ) : (
        <ul className="space-y-2">
          {visibleLinks.map((link) => (
            <li key={link.href} className="rounded-md border border-black/10 p-4 dark:border-white/10">
              <Link href={link.href} className="text-sm font-medium hover:underline">
                {link.label}
              </Link>
              <p className="mt-1 text-xs opacity-60">{link.description}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

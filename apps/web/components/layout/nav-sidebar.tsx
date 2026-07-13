import Link from "next/link";

interface NavItem {
  href?: string;
  label: string;
  section?: boolean;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { label: "Asistencia", section: true },
  { href: "/assistance/tickets", label: "Tickets" },
  { href: "/assistance/problems", label: "Problemas" },
  { href: "/assistance/changes", label: "Cambios" },
  { href: "/assistance/recurring-tickets", label: "Tickets recurrentes" },
  { label: "Activos", section: true },
  { href: "/assets", label: "Todos los activos" },
  { href: "/assets/computers", label: "Computadoras" },
  { href: "/assets/network-equipment", label: "Equipos de red" },
  { href: "/assets/software", label: "Software" },
  { href: "/assets/dcim", label: "DCIM" },
  { href: "/assets/dcim/cables", label: "Cables" },
  { label: "Gestión", section: true },
  { href: "/management/suppliers", label: "Proveedores" },
  { href: "/management/contacts", label: "Contactos" },
  { href: "/management/contracts", label: "Contratos" },
  { href: "/management/budgets", label: "Presupuestos" },
  { href: "/management/certificates", label: "Certificados" },
  { href: "/management/consumables", label: "Consumibles" },
  { label: "Herramientas", section: true },
  { href: "/tools/knowledge-base", label: "Base de conocimiento" },
  { href: "/tools/reservations", label: "Reservas" },
  { href: "/tools/projects", label: "Proyectos" },
  { href: "/tools/reports", label: "Reportes" },
  { href: "/tools/saved-searches", label: "Búsquedas guardadas" },
  { href: "/tools/rss-feeds", label: "Feeds RSS" },
  { href: "/tools/dashboards", label: "Dashboards" },
  { href: "/tools/reminders", label: "Recordatorios" },
  { href: "/tools/planning", label: "Planificación" },
  { label: "Administración", section: true },
  { href: "/administration/entities", label: "Entidades" },
  { href: "/administration/users", label: "Usuarios" },
  { href: "/administration/groups", label: "Grupos" },
  { href: "/administration/profiles", label: "Perfiles" },
  { href: "/administration/audit-log", label: "Registro de auditoría" },
  { label: "Configuración", section: true },
  { href: "/setup/asset-definitions", label: "Tipos de activo" },
  { href: "/setup/dropdowns", label: "Listas desplegables" },
  { href: "/setup/sla-policies", label: "Políticas SLA" },
  { href: "/setup/notification-templates", label: "Plantillas de notificación" },
  { href: "/setup/rules", label: "Reglas" },
  { href: "/setup/inventory-agents", label: "Agentes de inventario" },
  { href: "/setup/api-clients", label: "Clientes API" },
  { href: "/setup/webhooks", label: "Webhooks" },
  { href: "/setup/auth-sources", label: "Fuentes de autenticación (LDAP/OIDC)" },
  { href: "/setup/service-catalog", label: "Catálogo de servicios" },
  { href: "/setup/ticket-fields", label: "Campos de ticket" },
  { href: "/setup/cron-jobs", label: "Trabajos programados" },
];

export function NavSidebar() {
  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-black/10 p-4 dark:border-white/10">
      {NAV.map((item) =>
        item.section ? (
          <div key={item.label} className="mt-4 px-3 pb-1 text-xs font-medium uppercase tracking-wide opacity-50 first:mt-0">
            {item.label}
          </div>
        ) : (
          <Link
            key={item.href}
            href={item.href!}
            className="rounded-md px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
          >
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
}

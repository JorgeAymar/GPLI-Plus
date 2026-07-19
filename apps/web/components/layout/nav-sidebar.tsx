import Link from "next/link";
import { getTranslations } from "next-intl/server";

interface NavItem {
  href?: string;
  labelKey: string;
  section?: boolean;
}

const NAV: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard" },
  { href: "/account", labelKey: "account" },
  { labelKey: "sectionAsistencia", section: true },
  { href: "/assistance/tickets", labelKey: "tickets" },
  { href: "/assistance/problems", labelKey: "problems" },
  { href: "/assistance/changes", labelKey: "changes" },
  { href: "/assistance/recurring-tickets", labelKey: "recurringTickets" },
  { labelKey: "sectionActivos", section: true },
  { href: "/assets", labelKey: "allAssets" },
  { href: "/assets/computers", labelKey: "computers" },
  { href: "/assets/network-equipment", labelKey: "networkEquipment" },
  { href: "/assets/software", labelKey: "software" },
  { href: "/assets/dcim", labelKey: "dcim" },
  { href: "/assets/dcim/cables", labelKey: "cables" },
  { labelKey: "sectionGestion", section: true },
  { href: "/management/suppliers", labelKey: "suppliers" },
  { href: "/management/contacts", labelKey: "contacts" },
  { href: "/management/contracts", labelKey: "contracts" },
  { href: "/management/budgets", labelKey: "budgets" },
  { href: "/management/certificates", labelKey: "certificates" },
  { href: "/management/consumables", labelKey: "consumables" },
  { labelKey: "sectionHerramientas", section: true },
  { href: "/tools/knowledge-base", labelKey: "knowledgeBase" },
  { href: "/tools/reservations", labelKey: "reservations" },
  { href: "/tools/projects", labelKey: "projects" },
  { href: "/tools/reports", labelKey: "reports" },
  { href: "/tools/saved-searches", labelKey: "savedSearches" },
  { href: "/tools/rss-feeds", labelKey: "rssFeeds" },
  { href: "/tools/dashboards", labelKey: "dashboards" },
  { href: "/tools/reminders", labelKey: "reminders" },
  { href: "/tools/planning", labelKey: "planning" },
  { labelKey: "sectionAdministracion", section: true },
  { href: "/administration/entities", labelKey: "entities" },
  { href: "/administration/users", labelKey: "users" },
  { href: "/administration/groups", labelKey: "groups" },
  { href: "/administration/profiles", labelKey: "profiles" },
  { href: "/administration/audit-log", labelKey: "auditLog" },
  { labelKey: "sectionConfiguracion", section: true },
  { href: "/setup/asset-definitions", labelKey: "assetDefinitions" },
  { href: "/setup/dropdowns", labelKey: "dropdowns" },
  { href: "/setup/sla-policies", labelKey: "slaPolicies" },
  { href: "/setup/notification-templates", labelKey: "notificationTemplates" },
  { href: "/setup/rules", labelKey: "rules" },
  { href: "/setup/inventory-agents", labelKey: "inventoryAgents" },
  { href: "/setup/api-clients", labelKey: "apiClients" },
  { href: "/setup/webhooks", labelKey: "webhooks" },
  { href: "/setup/auth-sources", labelKey: "authSources" },
  { href: "/setup/service-catalog", labelKey: "serviceCatalog" },
  { href: "/setup/ticket-fields", labelKey: "ticketFields" },
  { href: "/setup/cron-jobs", labelKey: "cronJobs" },
];

export async function NavSidebar() {
  const t = await getTranslations("nav");

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-black/10 p-4 dark:border-white/10">
      {NAV.map((item) =>
        item.section ? (
          <div key={item.labelKey} className="mt-4 px-3 pb-1 text-xs font-medium uppercase tracking-wide opacity-50 first:mt-0">
            {t(item.labelKey)}
          </div>
        ) : (
          <Link
            key={item.href}
            href={item.href!}
            className="rounded-md px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
          >
            {t(item.labelKey)}
          </Link>
        ),
      )}
    </nav>
  );
}

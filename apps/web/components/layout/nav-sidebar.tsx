"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

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

/**
 * Determines which NAV entry should be treated as "active" for a given
 * pathname. Matches exact hrefs as well as nested detail routes (e.g.
 * `/assistance/tickets/42` under `/assistance/tickets`), and resolves
 * ambiguity between a parent and a more specific child href (e.g. `/assets`
 * vs `/assets/computers`) by picking the longest matching href.
 */
function findActiveHref(pathname: string): string | undefined {
  let activeHref: string | undefined;
  for (const item of NAV) {
    if (!item.href) continue;
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && (!activeHref || item.href.length > activeHref.length)) {
      activeHref = item.href;
    }
  }
  return activeHref;
}

export function NavSidebar({ aiAssistantEnabled }: { aiAssistantEnabled?: boolean }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const activeHref = findActiveHref(pathname);

  return (
    <nav className="sticky top-0 flex h-screen w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-black/10 p-4 dark:border-white/10">
      {aiAssistantEnabled ? (
        <Link
          href="/assistant"
          aria-current={pathname === "/assistant" ? "page" : undefined}
          className={
            pathname === "/assistant"
              ? "rounded-md bg-accent/10 px-3 py-2 text-sm font-semibold text-accent"
              : "rounded-md px-3 py-2 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5"
          }
        >
          {t("aiAssistant")}
        </Link>
      ) : null}
      {NAV.map((item) =>
        item.section ? (
          <div key={item.labelKey} className="mt-4 px-3 pb-1 text-xs font-medium uppercase tracking-wide opacity-70 first:mt-0">
            {t(item.labelKey)}
          </div>
        ) : (
          <Link
            key={item.href}
            href={item.href!}
            aria-current={item.href === activeHref ? "page" : undefined}
            className={
              item.href === activeHref
                ? "rounded-md bg-accent/10 px-3 py-2 text-sm font-semibold text-accent"
                : "rounded-md px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
            }
          >
            {t(item.labelKey)}
          </Link>
        ),
      )}
    </nav>
  );
}

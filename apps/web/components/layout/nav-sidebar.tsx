"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useState, type SVGProps } from "react";

interface NavLeaf {
  href: string;
  labelKey: string;
}

interface NavCategory {
  key: string;
  labelKey: string;
  icon: (props: SVGProps<SVGSVGElement>) => React.JSX.Element;
  items: NavLeaf[];
}

interface NavGroup {
  groupLabelKey: string;
  categories: NavCategory[];
}

const iconProps = { viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function SupportIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps} {...props}>
      <circle cx="10" cy="7" r="3.25" />
      <path d="M4.5 17a5.5 5.5 0 0 1 11 0" />
    </svg>
  );
}

function BoxIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M4 8.5 10 5l6 3.5v6L10 18l-6-3.5v-6Z" />
      <path d="M4 8.5 10 12l6-3.5M10 12v6" />
    </svg>
  );
}

function BriefcaseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps} {...props}>
      <rect x="3" y="7" width="14" height="9.5" rx="1.5" />
      <path d="M7.5 7V5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7" />
      <path d="M3 11.5h14" />
    </svg>
  );
}

function WrenchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M13 4.5a3.5 3.5 0 0 0-4.53 4.53L4 13.5V16h2.5l4.47-4.47A3.5 3.5 0 0 0 15.5 7l-2.5 2.5-2-2L13.5 5" />
    </svg>
  );
}

function ShieldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M10 2.5 4.5 4.75V9.5c0 4 2.3 6.75 5.5 8 3.2-1.25 5.5-4 5.5-8V4.75L10 2.5Z" />
    </svg>
  );
}

function GearIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps} {...props}>
      <circle cx="10" cy="10" r="2.75" />
      <path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.05 5.05l1.4 1.4M13.55 13.55l1.4 1.4M14.95 5.05l-1.4 1.4M6.45 13.55l-1.4 1.4" />
    </svg>
  );
}

function ChevronIcon({ expanded, ...props }: SVGProps<SVGSVGElement> & { expanded: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d={expanded ? "M6 8l4 4 4-4" : "M8 6l4 4-4 4"} />
    </svg>
  );
}

const TOP_LEVEL: NavLeaf[] = [
  { href: "/dashboard", labelKey: "dashboard" },
  { href: "/account", labelKey: "account" },
];

const GROUPS: NavGroup[] = [
  {
    groupLabelKey: "groupPrincipal",
    categories: [
      {
        key: "asistencia",
        labelKey: "sectionAsistencia",
        icon: SupportIcon,
        items: [
          { href: "/assistance/tickets", labelKey: "tickets" },
          { href: "/assistance/problems", labelKey: "problems" },
          { href: "/assistance/changes", labelKey: "changes" },
          { href: "/assistance/recurring-tickets", labelKey: "recurringTickets" },
        ],
      },
      {
        key: "activos",
        labelKey: "sectionActivos",
        icon: BoxIcon,
        items: [
          { href: "/assets", labelKey: "allAssets" },
          { href: "/assets/computers", labelKey: "computers" },
          { href: "/assets/network-equipment", labelKey: "networkEquipment" },
          { href: "/assets/software", labelKey: "software" },
          { href: "/assets/dcim", labelKey: "dcim" },
          { href: "/assets/dcim/cables", labelKey: "cables" },
        ],
      },
      {
        key: "gestion",
        labelKey: "sectionGestion",
        icon: BriefcaseIcon,
        items: [
          { href: "/management/suppliers", labelKey: "suppliers" },
          { href: "/management/contacts", labelKey: "contacts" },
          { href: "/management/contracts", labelKey: "contracts" },
          { href: "/management/budgets", labelKey: "budgets" },
          { href: "/management/certificates", labelKey: "certificates" },
          { href: "/management/consumables", labelKey: "consumables" },
        ],
      },
      {
        key: "herramientas",
        labelKey: "sectionHerramientas",
        icon: WrenchIcon,
        items: [
          { href: "/tools/knowledge-base", labelKey: "knowledgeBase" },
          { href: "/tools/reservations", labelKey: "reservations" },
          { href: "/tools/projects", labelKey: "projects" },
          { href: "/tools/reports", labelKey: "reports" },
          { href: "/tools/saved-searches", labelKey: "savedSearches" },
          { href: "/tools/rss-feeds", labelKey: "rssFeeds" },
          { href: "/tools/dashboards", labelKey: "dashboards" },
          { href: "/tools/reminders", labelKey: "reminders" },
          { href: "/tools/planning", labelKey: "planning" },
        ],
      },
    ],
  },
  {
    groupLabelKey: "groupSistema",
    categories: [
      {
        key: "administracion",
        labelKey: "sectionAdministracion",
        icon: ShieldIcon,
        items: [
          { href: "/administration/entities", labelKey: "entities" },
          { href: "/administration/users", labelKey: "users" },
          { href: "/administration/groups", labelKey: "groups" },
          { href: "/administration/profiles", labelKey: "profiles" },
          { href: "/administration/audit-log", labelKey: "auditLog" },
        ],
      },
      {
        key: "configuracion",
        labelKey: "sectionConfiguracion",
        icon: GearIcon,
        items: [
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
        ],
      },
    ],
  },
];

const ALL_LEAVES: NavLeaf[] = GROUPS.flatMap((g) => g.categories.flatMap((c) => c.items));

/**
 * Determines which leaf href should be treated as "active" for a given
 * pathname. Matches exact hrefs as well as nested detail routes (e.g.
 * `/assistance/tickets/42` under `/assistance/tickets`), and resolves
 * ambiguity between a parent and a more specific child href (e.g. `/assets`
 * vs `/assets/computers`) by picking the longest matching href.
 */
function findActiveHref(pathname: string): string | undefined {
  let activeHref: string | undefined;
  for (const item of [...TOP_LEVEL, ...ALL_LEAVES]) {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && (!activeHref || item.href.length > activeHref.length)) {
      activeHref = item.href;
    }
  }
  return activeHref;
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "block rounded-md bg-accent/10 px-3 py-2 text-sm font-semibold text-accent"
          : "block rounded-md px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
      }
    >
      {label}
    </Link>
  );
}

export function NavSidebar({
  aiAssistantEnabled,
  userDisplayName,
  profileLabel,
}: {
  aiAssistantEnabled?: boolean;
  userDisplayName: string;
  profileLabel: string;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const activeHref = findActiveHref(pathname);
  // Every category starts expanded (matches the flat list this replaces, and
  // keeps every page reachable without a click) - collapsing is a per-session
  // convenience the user opts into, not persisted, so a category containing
  // the active page is always forced back open below rather than possibly
  // hiding the page you're actually on.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <nav className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-black/10 dark:border-white/10">
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
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

        {TOP_LEVEL.map((item) => (
          <NavLink key={item.href} href={item.href} label={t(item.labelKey)} active={item.href === activeHref} />
        ))}

        {GROUPS.map((group) => (
          <div key={group.groupLabelKey} className="mt-4 first:mt-0">
            <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wide opacity-50">{t(group.groupLabelKey)}</div>
            {group.categories.map((category) => {
              const hasActiveItem = category.items.some((i) => i.href === activeHref);
              const expanded = hasActiveItem || !collapsed[category.key];
              const Icon = category.icon;
              return (
                <div key={category.key}>
                  <button
                    type="button"
                    onClick={() => setCollapsed((prev) => ({ ...prev, [category.key]: !prev[category.key] }))}
                    aria-expanded={expanded}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-70" />
                    <span className="flex-1">{t(category.labelKey)}</span>
                    <ChevronIcon expanded={expanded} className="h-4 w-4 shrink-0 opacity-50" />
                  </button>
                  {expanded ? (
                    <div className="ml-3 space-y-0.5 border-l border-black/10 pl-3 dark:border-white/10">
                      {category.items.map((item) => (
                        <NavLink key={item.href} href={item.href} label={t(item.labelKey)} active={item.href === activeHref} />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-black/10 p-4 dark:border-white/10">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
          {userDisplayName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{userDisplayName}</div>
          <div className="truncate text-xs opacity-60">{profileLabel}</div>
        </div>
      </div>
    </nav>
  );
}

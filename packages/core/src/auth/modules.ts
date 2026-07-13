import type { ItilType } from "@itsm/db";

/** Dotted module keys used by profile_module_rights - new modules register new keys, no migration needed. */
export const MODULE = {
  ADMINISTRATION_ENTITY: "administration.entity",
  ADMINISTRATION_USER: "administration.user",
  ADMINISTRATION_PROFILE: "administration.profile",
  ADMINISTRATION_AUTH_SOURCE: "administration.auth_source",
  ADMINISTRATION_GROUP: "administration.group",
  ADMINISTRATION_AUDIT_LOG: "administration.audit_log",

  SETUP_ASSET_DEFINITION: "setup.asset_definition",
  SETUP_DROPDOWN: "setup.dropdown",
  SETUP_SLA_POLICY: "setup.sla_policy",
  SETUP_NOTIFICATION_TEMPLATE: "setup.notification_template",
  SETUP_RULE: "setup.rule",
  SETUP_TICKET_FIELD: "setup.ticket_field",
  SETUP_CRON: "setup.cron",

  ASSETS_COMPUTER: "assets.computer",
  ASSETS_NETWORK_EQUIPMENT: "assets.network_equipment",
  ASSETS_MONITOR: "assets.monitor",
  ASSETS_PRINTER: "assets.printer",
  ASSETS_PHONE: "assets.phone",
  ASSETS_PERIPHERAL: "assets.peripheral",
  // Fallback for any admin-created custom asset type (isSystem = false) -
  // avoids needing a new MODULE constant + deploy per custom type.
  ASSETS_GENERIC: "assets.generic",
  ASSETS_SOFTWARE: "assets.software",
  ASSETS_SOFTWARE_LICENSE: "assets.software_license",
  ASSETS_UNMANAGED: "assets.unmanaged",

  ASSISTANCE_TICKET: "assistance.ticket",
  ASSISTANCE_PROBLEM: "assistance.problem",
  ASSISTANCE_CHANGE: "assistance.change",
  ASSISTANCE_SERVICE_CATALOG: "assistance.service_catalog",

  MANAGEMENT_SUPPLIER: "management.supplier",
  MANAGEMENT_CONTACT: "management.contact",
  MANAGEMENT_CONTRACT: "management.contract",
  MANAGEMENT_BUDGET: "management.budget",
  MANAGEMENT_CERTIFICATE: "management.certificate",
  MANAGEMENT_DATACENTER: "management.datacenter",
  MANAGEMENT_DOMAIN: "management.domain",
  MANAGEMENT_LINE: "management.line",
  MANAGEMENT_DATABASE: "management.database",
  MANAGEMENT_CONSUMABLE: "management.consumable",

  TOOLS_KNOWLEDGE_BASE: "tools.knowledge_base",
  TOOLS_RESERVATION: "tools.reservation",
  TOOLS_PROJECT: "tools.project",
  TOOLS_REPORT: "tools.report",
  TOOLS_SAVED_SEARCH: "tools.saved_search",
  TOOLS_RSS_FEED: "tools.rss_feed",
  TOOLS_DASHBOARD: "tools.dashboard",
  TOOLS_REMINDER: "tools.reminder",
  TOOLS_PLANNING: "tools.planning",

  ADVANCED_INVENTORY: "advanced.inventory",
  ADVANCED_DCIM: "advanced.dcim",
  ADVANCED_IMPACT: "advanced.impact",
  ADVANCED_API: "advanced.api",
  ADVANCED_WEBHOOK: "advanced.webhook",
} as const;

export type ModuleKey = (typeof MODULE)[keyof typeof MODULE];

export function moduleKeyForItilType(itilType: ItilType): ModuleKey {
  const map: Record<ItilType, ModuleKey> = {
    ticket: MODULE.ASSISTANCE_TICKET,
    problem: MODULE.ASSISTANCE_PROBLEM,
    change: MODULE.ASSISTANCE_CHANGE,
  };
  return map[itilType];
}

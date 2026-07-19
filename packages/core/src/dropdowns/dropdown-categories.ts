/**
 * Well-known `dropdown_categories.key` values seeded by `packages/core/scripts/seed.ts`
 * and looked up directly by application code (list pages that need a specific
 * category's items - e.g. the shared ticket/problem/change category picker).
 * Centralizing them here avoids the same literal string drifting out of sync
 * across call sites (mirrors MODULE in auth/modules.ts for module-right keys).
 *
 * This is NOT an exhaustive list of every category that can exist - admins can
 * create arbitrary custom categories via createDropdownCategory() at runtime,
 * so getDropdownCategoryByKey() still accepts a plain `string`. This constant
 * only covers the baseline categories that application code references by a
 * fixed, known key.
 */
export const DROPDOWN_CATEGORY = {
  STATUS: "status",
  MANUFACTURER: "manufacturer",
  LOCATION: "location",
  OS: "os",
  OS_VERSION: "os_version",
  NETWORK_EQUIPMENT_TYPE: "network_equipment_type",
  SOFTWARE_CATEGORY: "software_category",
  ITIL_CATEGORY: "itil_category",
  PROJECT_STATE: "project_state",
  PROJECT_TYPE: "project_type",
  PROJECT_TASK_STATE: "project_task_state",
  CABLE_TYPE: "cable_type",
} as const;

export type DropdownCategoryKey = (typeof DROPDOWN_CATEGORY)[keyof typeof DROPDOWN_CATEGORY];

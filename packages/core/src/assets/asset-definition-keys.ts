/**
 * Well-known `asset_definitions.key` values seeded by `packages/core/scripts/seed.ts`
 * (the "core" system asset types) and looked up directly by application code -
 * e.g. computer-service.ts/network-equipment-service.ts resolving their own
 * dedicated asset_definitions row, or inventory-service.ts matching inbound
 * agent submissions to the "computer"/"unmanaged_device" types. Centralizing
 * them here avoids the same literal string drifting out of sync across call
 * sites (mirrors DROPDOWN_CATEGORY in dropdowns/dropdown-categories.ts and
 * MODULE in auth/modules.ts).
 *
 * This is NOT an exhaustive list of every asset type that can exist - admins
 * can create arbitrary custom asset definitions via createAssetDefinition()
 * at runtime (isSystem=false), so getAssetDefinitionByKey() still accepts a
 * plain `string`. This constant only covers the core system types that
 * application code references by a fixed, known key.
 */
export const ASSET_DEFINITION_KEY = {
  COMPUTER: "computer",
  MONITOR: "monitor",
  NETWORK_EQUIPMENT: "network_equipment",
  PRINTER: "printer",
  PHONE: "phone",
  PERIPHERAL: "peripheral",
  DATACENTER: "datacenter",
  DOMAIN: "domain",
  LINE: "line",
  DATABASE: "database",
  RACK: "rack",
  ENCLOSURE: "enclosure",
  PDU: "pdu",
  CLUSTER: "cluster",
  UNMANAGED_DEVICE: "unmanaged_device",
} as const;

export type AssetDefinitionKey = (typeof ASSET_DEFINITION_KEY)[keyof typeof ASSET_DEFINITION_KEY];

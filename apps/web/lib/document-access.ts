import { MODULE } from "@itsm/core";

/** Which module's rights gate an attachment on a given itemType. Extend as attachments get wired into more pages. */
const ITEM_TYPE_MODULE: Record<string, string> = {
  ticket: MODULE.ASSISTANCE_TICKET,
  computer: MODULE.ASSETS_COMPUTER,
};

export function moduleForItemType(itemType: string): string {
  const moduleKey = ITEM_TYPE_MODULE[itemType];
  if (!moduleKey) throw new Error(`Unknown itemType "${itemType}" for attachments`);
  return moduleKey;
}

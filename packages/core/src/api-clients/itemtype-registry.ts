import { getAsset, listAssets } from "../assets/asset-service";
import { getComputerWithAsset, listComputers } from "../assets/computer-service";
import { MODULE } from "../auth/modules";
import { getChange, listChanges } from "../itil/change-service";
import { getProblem, listProblems } from "../itil/problem-service";
import { getTicket, listTickets } from "../itil/ticket-service";

/**
 * Generic mapping from a public `/api/v1/<itemtype>` URL segment to the
 * internal service functions + MODULE scope that item type is gated behind.
 *
 * This is intentionally small - it demonstrates the pattern for 5 item
 * types, not all ~40 GLPI item types. Adding a new one is a 1-line addition
 * here (plus wiring its `create` fn if/when POST support grows beyond v1).
 */
export interface ItemtypeRegistryEntry {
  moduleKey: string;
  list: (entityId: string) => Promise<unknown[]>;
  // Not every item type has a simple single-row getter (e.g. computers join
  // assets + computers) - optional so the registry can omit it if genuinely
  // unavailable, rather than faking a signature that doesn't exist.
  get?: (id: string) => Promise<unknown | undefined>;
}

export const ITEMTYPE_REGISTRY: Record<string, ItemtypeRegistryEntry> = {
  tickets: {
    moduleKey: MODULE.ASSISTANCE_TICKET,
    list: (entityId) => listTickets(entityId, { includeSubtree: true }),
    get: getTicket,
  },
  assets: {
    moduleKey: MODULE.ASSETS_GENERIC,
    list: (entityId) => listAssets(entityId, { includeSubtree: true }),
    get: getAsset,
  },
  computers: {
    moduleKey: MODULE.ASSETS_COMPUTER,
    list: (entityId) => listComputers(entityId, { includeSubtree: true }),
    // listComputers/getComputerWithAsset already join assets+computers, so
    // this returns { asset, computer } rather than a bare Computer row.
    get: getComputerWithAsset,
  },
  problems: {
    moduleKey: MODULE.ASSISTANCE_PROBLEM,
    list: (entityId) => listProblems(entityId, { includeSubtree: true }),
    get: getProblem,
  },
  changes: {
    moduleKey: MODULE.ASSISTANCE_CHANGE,
    list: (entityId) => listChanges(entityId, { includeSubtree: true }),
    get: getChange,
  },
};

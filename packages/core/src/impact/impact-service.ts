import { db, impactContexts, impactRelations, type ImpactContext, type ImpactRelation } from "@itsm/db";
import { eq } from "drizzle-orm";
import { getAsset } from "../assets/asset-service";
import type { AddImpactRelationInput } from "../validation/impact.zod";

const DEFAULT_MAX_DEPTH = 5;

export async function addImpactRelation(input: AddImpactRelationInput): Promise<ImpactRelation> {
  const [created] = await db
    .insert(impactRelations)
    .values({
      sourceAssetId: input.sourceAssetId,
      impactedAssetId: input.impactedAssetId,
      label: input.label ?? null,
    })
    .returning();
  if (!created) throw new Error("Failed to insert impact relation");
  return created;
}

export async function removeImpactRelation(id: string): Promise<void> {
  await db.delete(impactRelations).where(eq(impactRelations.id, id));
}

/**
 * "forward" = relations where this asset is the source (what it impacts /
 * what depends on it going downstream). "backward" = relations where this
 * asset is the impacted one (what it depends on).
 */
export async function listDirectRelations(assetId: string, direction: "forward" | "backward"): Promise<ImpactRelation[]> {
  const column = direction === "forward" ? impactRelations.sourceAssetId : impactRelations.impactedAssetId;
  return db.select().from(impactRelations).where(eq(column, assetId));
}

async function listRelationsForDirection(
  assetId: string,
  direction: "forward" | "backward" | "both",
): Promise<ImpactRelation[]> {
  if (direction === "both") {
    const [forward, backward] = await Promise.all([listDirectRelations(assetId, "forward"), listDirectRelations(assetId, "backward")]);
    return [...forward, ...backward];
  }
  return listDirectRelations(assetId, direction);
}

export interface ImpactGraphNode {
  assetId: string;
  name: string;
  depth: number;
}

export interface ImpactGraphEdge {
  sourceAssetId: string;
  impactedAssetId: string;
  label: string | null;
}

export interface ImpactGraph {
  nodes: ImpactGraphNode[];
  edges: ImpactGraphEdge[];
}

/**
 * BFS from rootAssetId - same principle as isReachable() in
 * project-service.ts (a Set<string> of visited node ids so a cycle in the
 * relations can never cause an infinite loop), extended from 1 direction to
 * 2: "forward" walks sourceAssetId -> impactedAssetId edges (what this asset
 * impacts), "backward" walks the reverse (what this asset depends on), and
 * "both" (the default for the impact page) walks both at every hop.
 *
 * `maxDepth` (default 5) is a hard cap on hops from the root, independent of
 * the cycle guard - it exists to bound the size of a single, cycle-free but
 * potentially huge dependency chain (e.g. a flat network of 500 switches),
 * which the visited-set alone wouldn't stop.
 */
export async function buildImpactGraph(
  rootAssetId: string,
  options?: { maxDepth?: number; direction?: "forward" | "backward" | "both" },
): Promise<ImpactGraph> {
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
  const direction = options?.direction ?? "both";

  const rootAsset = await getAsset(rootAssetId);
  if (!rootAsset) throw new Error(`Asset ${rootAssetId} not found`);

  const nodesById = new Map<string, ImpactGraphNode>();
  nodesById.set(rootAssetId, { assetId: rootAssetId, name: rootAsset.name, depth: 0 });

  const edgeKeys = new Set<string>();
  const edges: ImpactGraphEdge[] = [];

  let frontier: string[] = [rootAssetId];
  let currentDepth = 0;

  while (frontier.length > 0 && currentDepth < maxDepth) {
    const nextFrontier: string[] = [];

    for (const currentId of frontier) {
      const relations = await listRelationsForDirection(currentId, direction);

      for (const relation of relations) {
        const edgeKey = `${relation.sourceAssetId}:${relation.impactedAssetId}`;
        if (!edgeKeys.has(edgeKey)) {
          edgeKeys.add(edgeKey);
          edges.push({ sourceAssetId: relation.sourceAssetId, impactedAssetId: relation.impactedAssetId, label: relation.label });
        }

        const neighborId = relation.sourceAssetId === currentId ? relation.impactedAssetId : relation.sourceAssetId;
        if (nodesById.has(neighborId)) continue; // already visited - this is what keeps cycles from looping forever

        const neighborAsset = await getAsset(neighborId);
        if (!neighborAsset) continue; // defensive: shouldn't happen since FKs cascade-delete, but don't surface a broken node

        nodesById.set(neighborId, { assetId: neighborId, name: neighborAsset.name, depth: currentDepth + 1 });
        nextFrontier.push(neighborId);
      }
    }

    frontier = nextFrontier;
    currentDepth += 1;
  }

  return { nodes: Array.from(nodesById.values()), edges };
}

export async function getOrCreateImpactContext(rootAssetId: string): Promise<ImpactContext> {
  const [existing] = await db.select().from(impactContexts).where(eq(impactContexts.rootAssetId, rootAssetId));
  if (existing) return existing;

  // onConflictDoNothing (same pattern as linkContractAsset in contract-service.ts)
  // makes this race-safe: if two callers get here concurrently for the same
  // rootAssetId, one insert wins and the other becomes a no-op, then both
  // re-select and see the winner's row.
  await db.insert(impactContexts).values({ rootAssetId }).onConflictDoNothing();

  const [context] = await db.select().from(impactContexts).where(eq(impactContexts.rootAssetId, rootAssetId));
  if (!context) throw new Error(`Failed to get or create impact context for asset ${rootAssetId}`);
  return context;
}

export async function updateImpactContextMaxDepth(rootAssetId: string, maxDepth: number): Promise<ImpactContext> {
  const context = await getOrCreateImpactContext(rootAssetId);
  const [updated] = await db
    .update(impactContexts)
    .set({ maxDepth, updatedAt: new Date() })
    .where(eq(impactContexts.id, context.id))
    .returning();
  if (!updated) throw new Error(`Impact context for asset ${rootAssetId} not found`);
  return updated;
}

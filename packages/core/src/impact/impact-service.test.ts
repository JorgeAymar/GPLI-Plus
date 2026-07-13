import "dotenv/config";
import { assets, auditLog, db, entities, impactContexts, impactRelations } from "@itsm/db";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAssetDefinitionByKey } from "../assets/asset-definition-service";
import { createAsset } from "../assets/asset-service";
import { createEntity } from "../entities/entity-service";
import {
  addImpactRelation,
  buildImpactGraph,
  getOrCreateImpactContext,
  listDirectRelations,
  removeImpactRelation,
  updateImpactContextMaxDepth,
} from "./impact-service";

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PREFIX = `__vitest_assets__${RUN}_`;

describe("impact-service", () => {
  let entityId: string;
  const assetIds: string[] = [];

  async function makeAsset(name: string): Promise<string> {
    const def = await getAssetDefinitionByKey("unmanaged_device");
    if (!def) throw new Error('Seed data missing: asset definition "unmanaged_device" not found. Run `pnpm seed` first.');
    const asset = await createAsset({ entityId, assetDefinitionId: def.id, name }, null);
    assetIds.push(asset.id);
    return asset.id;
  }

  beforeAll(async () => {
    const entity = await createEntity({ name: `${PREFIX}impact-root` });
    entityId = entity.id;
  });

  afterAll(async () => {
    await db.delete(impactContexts).where(inArray(impactContexts.rootAssetId, assetIds));
    await db.delete(impactRelations).where(inArray(impactRelations.sourceAssetId, assetIds));
    await db.delete(auditLog).where(eq(auditLog.entityId, entityId));
    await db.delete(assets).where(eq(assets.entityId, entityId));
    await db.delete(entities).where(eq(entities.id, entityId));
  });

  it("creates a relation, finds it via listDirectRelations in both directions, and removes it", async () => {
    const dbServer = await makeAsset(`${PREFIX}db-server`);
    const appServer = await makeAsset(`${PREFIX}app-server`);

    const relation = await addImpactRelation({ sourceAssetId: dbServer, impactedAssetId: appServer, label: "hosts the DB" });
    expect(relation.sourceAssetId).toBe(dbServer);
    expect(relation.impactedAssetId).toBe(appServer);
    expect(relation.label).toBe("hosts the DB");

    const forward = await listDirectRelations(dbServer, "forward");
    expect(forward.map((r) => r.id)).toContain(relation.id);

    const backward = await listDirectRelations(appServer, "backward");
    expect(backward.map((r) => r.id)).toContain(relation.id);

    // From the other side there should be nothing.
    expect(await listDirectRelations(dbServer, "backward")).toEqual([]);
    expect(await listDirectRelations(appServer, "forward")).toEqual([]);

    await removeImpactRelation(relation.id);
    expect(await listDirectRelations(dbServer, "forward")).toEqual([]);
  });

  it("a newly created relation appears when querying the impact graph of that asset", async () => {
    const dbServer = await makeAsset(`${PREFIX}graph-db-server`);
    const appServer = await makeAsset(`${PREFIX}graph-app-server`);

    await addImpactRelation({ sourceAssetId: dbServer, impactedAssetId: appServer, label: "hosts the DB" });

    const graph = await buildImpactGraph(dbServer);
    expect(graph.nodes.map((n) => n.assetId).sort()).toEqual([dbServer, appServer].sort());
    expect(graph.edges).toEqual([{ sourceAssetId: dbServer, impactedAssetId: appServer, label: "hosts the DB" }]);

    // Querying from the impacted asset's side (with the default "both" direction) also surfaces the same edge.
    const graphFromOtherSide = await buildImpactGraph(appServer);
    expect(graphFromOtherSide.nodes.map((n) => n.assetId).sort()).toEqual([dbServer, appServer].sort());
  });

  it("walks multi-hop chains and respects the forward/backward/both direction filter", async () => {
    const a = await makeAsset(`${PREFIX}chain-a`);
    const b = await makeAsset(`${PREFIX}chain-b`);
    const c = await makeAsset(`${PREFIX}chain-c`);

    await addImpactRelation({ sourceAssetId: a, impactedAssetId: b });
    await addImpactRelation({ sourceAssetId: b, impactedAssetId: c });

    const forwardFromA = await buildImpactGraph(a, { direction: "forward" });
    expect(forwardFromA.nodes.map((n) => n.assetId).sort()).toEqual([a, b, c].sort());
    expect(forwardFromA.nodes.find((n) => n.assetId === a)?.depth).toBe(0);
    expect(forwardFromA.nodes.find((n) => n.assetId === b)?.depth).toBe(1);
    expect(forwardFromA.nodes.find((n) => n.assetId === c)?.depth).toBe(2);

    // c has nothing downstream of it, so walking forward from c finds only itself.
    const forwardFromC = await buildImpactGraph(c, { direction: "forward" });
    expect(forwardFromC.nodes.map((n) => n.assetId)).toEqual([c]);

    // walking backward from c finds the whole chain (what c depends on).
    const backwardFromC = await buildImpactGraph(c, { direction: "backward" });
    expect(backwardFromC.nodes.map((n) => n.assetId).sort()).toEqual([a, b, c].sort());
  });

  it("does not loop forever on a cycle (A -> B -> A)", async () => {
    const a = await makeAsset(`${PREFIX}cycle-a`);
    const b = await makeAsset(`${PREFIX}cycle-b`);

    await addImpactRelation({ sourceAssetId: a, impactedAssetId: b });
    await addImpactRelation({ sourceAssetId: b, impactedAssetId: a });

    const graph = await buildImpactGraph(a);
    expect(graph.nodes.map((n) => n.assetId).sort()).toEqual([a, b].sort());
    expect(graph.edges).toHaveLength(2);
  });

  it("caps traversal at maxDepth hops", async () => {
    const nodes = await Promise.all(
      Array.from({ length: 5 }, (_, i) => makeAsset(`${PREFIX}depth-chain-${i}`)),
    );
    for (let i = 0; i < nodes.length - 1; i++) {
      await addImpactRelation({ sourceAssetId: nodes[i]!, impactedAssetId: nodes[i + 1]! });
    }

    const shallow = await buildImpactGraph(nodes[0]!, { direction: "forward", maxDepth: 1 });
    expect(shallow.nodes.map((n) => n.assetId).sort()).toEqual([nodes[0], nodes[1]].sort());

    const full = await buildImpactGraph(nodes[0]!, { direction: "forward", maxDepth: 10 });
    expect(full.nodes.map((n) => n.assetId).sort()).toEqual([...nodes].sort());
  });

  it("throws when the root asset does not exist", async () => {
    await expect(buildImpactGraph("00000000-0000-0000-0000-000000000000")).rejects.toThrow();
  });

  describe("impact contexts", () => {
    it("getOrCreateImpactContext is idempotent and defaults maxDepth to 5", async () => {
      const asset = await makeAsset(`${PREFIX}context-asset`);

      const first = await getOrCreateImpactContext(asset);
      expect(first.rootAssetId).toBe(asset);
      expect(first.maxDepth).toBe(5);

      const second = await getOrCreateImpactContext(asset);
      expect(second.id).toBe(first.id);
    });

    it("updateImpactContextMaxDepth creates the context on demand and persists the new value", async () => {
      const asset = await makeAsset(`${PREFIX}context-update-asset`);

      const updated = await updateImpactContextMaxDepth(asset, 3);
      expect(updated.maxDepth).toBe(3);

      const fetchedAgain = await getOrCreateImpactContext(asset);
      expect(fetchedAgain.maxDepth).toBe(3);
    });
  });
});

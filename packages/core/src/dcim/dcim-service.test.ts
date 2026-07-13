import "dotenv/config";
import { assets, auditLog, cables, clusterMembers, db, enclosureSlots, entities, rackSlots } from "@itsm/db";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAssetDefinitionByKey } from "../assets/asset-definition-service";
import { createAsset } from "../assets/asset-service";
import { createEntity } from "../entities/entity-service";
import {
  addClusterMember,
  createCable,
  listCables,
  listCablesForAsset,
  listClusterMembers,
  listEnclosureSlots,
  listRackSlots,
  placeInEnclosure,
  placeInRack,
  removeClusterMember,
  removeFromEnclosure,
  removeFromRack,
} from "./dcim-service";

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PREFIX = `__vitest_assets__${RUN}_`;

describe("dcim-service", () => {
  let entityId: string;
  const assetIds: string[] = [];

  async function makeAsset(defKey: string, name: string): Promise<string> {
    const def = await getAssetDefinitionByKey(defKey);
    if (!def) throw new Error(`Seed data missing: asset definition "${defKey}" not found. Run \`pnpm seed\` first.`);
    const asset = await createAsset({ entityId, assetDefinitionId: def.id, name }, null);
    assetIds.push(asset.id);
    return asset.id;
  }

  beforeAll(async () => {
    const entity = await createEntity({ name: `${PREFIX}dcim-root` });
    entityId = entity.id;
  });

  afterAll(async () => {
    await db.delete(rackSlots).where(inArray(rackSlots.rackAssetId, assetIds));
    await db.delete(enclosureSlots).where(inArray(enclosureSlots.enclosureAssetId, assetIds));
    await db.delete(clusterMembers).where(inArray(clusterMembers.clusterAssetId, assetIds));
    await db.delete(cables).where(inArray(cables.endpointAAssetId, assetIds));

    await db.delete(auditLog).where(eq(auditLog.entityId, entityId));
    await db.delete(assets).where(eq(assets.entityId, entityId));
    await db.delete(entities).where(eq(entities.id, entityId));
  });

  describe("racks", () => {
    it("places an occupant in a rack and lists slots ordered by position", async () => {
      const rackAssetId = await makeAsset("rack", `${PREFIX}rack-1`);
      const server = await makeAsset("unmanaged_device", `${PREFIX}rack-1-server`);

      const slot = await placeInRack({ rackAssetId, occupantAssetId: server, positionU: 10, unitHeight: 2 });
      expect(slot.positionU).toBe(10);
      expect(slot.unitHeight).toBe(2);
      expect(slot.orientation).toBe("front");

      const another = await makeAsset("unmanaged_device", `${PREFIX}rack-1-server-2`);
      await placeInRack({ rackAssetId, occupantAssetId: another, positionU: 1, unitHeight: 1 });

      const list = await listRackSlots(rackAssetId);
      expect(list.map((s) => s.positionU)).toEqual([1, 10]);
    });

    it("rejects placing a second occupant at an overlapping U position in the same orientation", async () => {
      const rackAssetId = await makeAsset("rack", `${PREFIX}rack-overlap`);
      const first = await makeAsset("unmanaged_device", `${PREFIX}rack-overlap-first`);
      const second = await makeAsset("unmanaged_device", `${PREFIX}rack-overlap-second`);

      await placeInRack({ rackAssetId, occupantAssetId: first, positionU: 5, unitHeight: 4 }); // occupies U5-U8

      // Overlaps (5..9) with (5..9) at U6 - must be rejected.
      await expect(placeInRack({ rackAssetId, occupantAssetId: second, positionU: 6, unitHeight: 2 })).rejects.toThrow();

      // A non-overlapping position (starting right after the first slot ends) must succeed.
      const nonOverlapping = await placeInRack({ rackAssetId, occupantAssetId: second, positionU: 9, unitHeight: 1 });
      expect(nonOverlapping.positionU).toBe(9);
    });

    it("allows the same U position in a different orientation (front vs rear)", async () => {
      const rackAssetId = await makeAsset("rack", `${PREFIX}rack-orientation`);
      const front = await makeAsset("unmanaged_device", `${PREFIX}rack-orientation-front`);
      const rear = await makeAsset("unmanaged_device", `${PREFIX}rack-orientation-rear`);

      await placeInRack({ rackAssetId, occupantAssetId: front, positionU: 3, unitHeight: 1, orientation: "front" });
      const rearSlot = await placeInRack({ rackAssetId, occupantAssetId: rear, positionU: 3, unitHeight: 1, orientation: "rear" });
      expect(rearSlot.orientation).toBe("rear");
    });

    it("removeFromRack frees the slot", async () => {
      const rackAssetId = await makeAsset("rack", `${PREFIX}rack-remove`);
      const occupant = await makeAsset("unmanaged_device", `${PREFIX}rack-remove-occupant`);

      const slot = await placeInRack({ rackAssetId, occupantAssetId: occupant, positionU: 1, unitHeight: 1 });
      await removeFromRack(slot.id);
      expect(await listRackSlots(rackAssetId)).toEqual([]);

      // Now the same position can be reused.
      const reused = await placeInRack({ rackAssetId, occupantAssetId: occupant, positionU: 1, unitHeight: 1 });
      expect(reused.positionU).toBe(1);
    });
  });

  describe("enclosures", () => {
    it("places an occupant in an enclosure slot and lists slots ordered by position", async () => {
      const enclosureAssetId = await makeAsset("enclosure", `${PREFIX}enclosure-1`);
      const blade = await makeAsset("unmanaged_device", `${PREFIX}enclosure-1-blade`);

      await placeInEnclosure({ enclosureAssetId, occupantAssetId: blade, positionSlot: 3 });
      const blade2 = await makeAsset("unmanaged_device", `${PREFIX}enclosure-1-blade-2`);
      await placeInEnclosure({ enclosureAssetId, occupantAssetId: blade2, positionSlot: 1 });

      const list = await listEnclosureSlots(enclosureAssetId);
      expect(list.map((s) => s.positionSlot)).toEqual([1, 3]);
    });

    it("rejects placing a second occupant in an already-occupied slot", async () => {
      const enclosureAssetId = await makeAsset("enclosure", `${PREFIX}enclosure-dup`);
      const first = await makeAsset("unmanaged_device", `${PREFIX}enclosure-dup-first`);
      const second = await makeAsset("unmanaged_device", `${PREFIX}enclosure-dup-second`);

      await placeInEnclosure({ enclosureAssetId, occupantAssetId: first, positionSlot: 2 });
      await expect(placeInEnclosure({ enclosureAssetId, occupantAssetId: second, positionSlot: 2 })).rejects.toThrow();
    });

    it("removeFromEnclosure frees the slot for reuse", async () => {
      const enclosureAssetId = await makeAsset("enclosure", `${PREFIX}enclosure-remove`);
      const occupant = await makeAsset("unmanaged_device", `${PREFIX}enclosure-remove-occupant`);

      const slot = await placeInEnclosure({ enclosureAssetId, occupantAssetId: occupant, positionSlot: 1 });
      await removeFromEnclosure(slot.id);
      expect(await listEnclosureSlots(enclosureAssetId)).toEqual([]);

      const reusedOccupant = await makeAsset("unmanaged_device", `${PREFIX}enclosure-remove-occupant-2`);
      const reused = await placeInEnclosure({ enclosureAssetId, occupantAssetId: reusedOccupant, positionSlot: 1 });
      expect(reused.positionSlot).toBe(1);
    });
  });

  describe("cluster membership", () => {
    it("adds, lists, and removes cluster members", async () => {
      const clusterAssetId = await makeAsset("cluster", `${PREFIX}cluster-1`);
      const member1 = await makeAsset("unmanaged_device", `${PREFIX}cluster-1-member-1`);
      const member2 = await makeAsset("unmanaged_device", `${PREFIX}cluster-1-member-2`);

      await addClusterMember(clusterAssetId, member1);
      await addClusterMember(clusterAssetId, member2);

      const members = await listClusterMembers(clusterAssetId);
      expect(members.map((m) => m.memberAssetId).sort()).toEqual([member1, member2].sort());

      await removeClusterMember(clusterAssetId, member1);
      const afterRemoval = await listClusterMembers(clusterAssetId);
      expect(afterRemoval.map((m) => m.memberAssetId)).toEqual([member2]);
    });
  });

  describe("cables", () => {
    it("creates a cable and lists it for both endpoints, and in the global list", async () => {
      const endpointA = await makeAsset("unmanaged_device", `${PREFIX}cable-endpoint-a`);
      const endpointB = await makeAsset("unmanaged_device", `${PREFIX}cable-endpoint-b`);

      const cable = await createCable({ name: `${PREFIX}cable-1`, endpointAAssetId: endpointA, endpointBAssetId: endpointB });

      const forA = await listCablesForAsset(endpointA);
      expect(forA.some((c) => c.id === cable.id)).toBe(true);

      const forB = await listCablesForAsset(endpointB);
      expect(forB.some((c) => c.id === cable.id)).toBe(true);

      const unrelated = await makeAsset("unmanaged_device", `${PREFIX}cable-unrelated`);
      const forUnrelated = await listCablesForAsset(unrelated);
      expect(forUnrelated.some((c) => c.id === cable.id)).toBe(false);

      const all = await listCables();
      expect(all.some((c) => c.id === cable.id)).toBe(true);
    });
  });
});

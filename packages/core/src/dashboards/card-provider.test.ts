import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { assetDefinitions, assets, db, tickets, type Entity } from "@itsm/db";
import { createTestEntity, deleteTestEntities } from "../__vitest_tools__/fixtures";
import { AVAILABLE_CARD_KEYS, CARD_PROVIDERS, resolveCardData, type CardKey } from "./card-provider";

describe("card-provider", () => {
  it("AVAILABLE_CARD_KEYS and CARD_PROVIDERS stay in sync (every key has a provider, and vice versa)", () => {
    const providerKeys = Object.keys(CARD_PROVIDERS).sort();
    const availableKeys = [...AVAILABLE_CARD_KEYS].sort();
    expect(providerKeys).toEqual(availableKeys);
  });

  it("resolveCardData returns null for an unknown/untrusted cardKey instead of throwing", async () => {
    const result = await resolveCardData("__vitest_tools__not_a_real_card", crypto.randomUUID());
    expect(result).toBeNull();
  });

  describe("with real entity-scoped data", () => {
    let entity: Entity;
    let assetDefinitionId: string;
    const entityIds: string[] = [];
    const assetIds: string[] = [];
    const ticketIds: string[] = [];

    beforeAll(async () => {
      entity = await createTestEntity();
      entityIds.push(entity.id);

      const [existingDefinition] = await db.select().from(assetDefinitions).limit(1);
      if (!existingDefinition) throw new Error("Expected at least one seeded asset definition");
      assetDefinitionId = existingDefinition.id;

      const [asset] = await db
        .insert(assets)
        .values({ entityId: entity.id, assetDefinitionId, name: "__vitest_tools__ card provider asset" })
        .returning();
      assetIds.push(asset!.id);

      const [ticket] = await db
        .insert(tickets)
        .values({ entityId: entity.id, title: "__vitest_tools__ card provider ticket", content: "content", status: "new" })
        .returning();
      ticketIds.push(ticket!.id);
    });

    afterAll(async () => {
      for (const id of ticketIds) await db.delete(tickets).where(eq(tickets.id, id));
      for (const id of assetIds) await db.delete(assets).where(eq(assets.id, id));
      await deleteTestEntities(entityIds);
    });

    it("resolveCardData('assets_by_type') delegates to getAssetCountsByType, scoped to entity+subtree", async () => {
      const data = (await resolveCardData("assets_by_type", entity.id)) as Array<{ assetDefinitionId: string; count: number }>;
      expect(data.some((row) => row.assetDefinitionId === assetDefinitionId)).toBe(true);
    });

    it("resolveCardData('tickets_by_status') delegates to getTicketCountsByStatus", async () => {
      const data = (await resolveCardData("tickets_by_status", entity.id)) as Array<{ status: string; count: number }>;
      const newRow = data.find((row) => row.status === "new");
      expect(newRow?.count).toBeGreaterThanOrEqual(1);
    });

    it("resolveCardData('sla_compliance_rate') delegates to getSlaComplianceRate with the fixed 30-day window", async () => {
      const data = (await resolveCardData("sla_compliance_rate", entity.id)) as { total: number; complianceRate: number };
      expect(data.total).toBe(0);
      expect(data.complianceRate).toBe(1);
    });

    it("every declared card key resolves to non-null data for a real entity", async () => {
      for (const key of AVAILABLE_CARD_KEYS satisfies CardKey[]) {
        const data = await resolveCardData(key, entity.id);
        expect(data).not.toBeNull();
      }
    });
  });
});

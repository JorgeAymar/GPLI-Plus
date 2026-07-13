import "dotenv/config";
import { assetDefinitions, assetFieldDefinitions, db } from "@itsm/db";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { MODULE } from "../auth/modules";
import {
  createAssetDefinition,
  createAssetFieldDefinition,
  deleteAssetFieldDefinition,
  getAssetDefinition,
  getAssetDefinitionByKey,
  listAssetDefinitions,
  listAssetFieldDefinitions,
  moduleKeyForAssetDefinition,
  updateAssetDefinition,
} from "./asset-definition-service";

// Distinctive + run-scoped prefix so repeated runs never collide on the unique `key` column,
// even if a previous run's afterAll didn't get to run (e.g. the process was killed).
const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PREFIX = `__vitest_assets__${RUN}_`;

describe("asset-definition-service", () => {
  const createdDefinitionIds: string[] = [];

  afterAll(async () => {
    // asset_field_definitions.assetDefinitionId cascades on delete of asset_definitions,
    // but delete explicitly first anyway so the FK order stays obvious and self-documenting.
    for (const id of createdDefinitionIds) {
      await db.delete(assetFieldDefinitions).where(eq(assetFieldDefinitions.assetDefinitionId, id));
    }
    for (const id of createdDefinitionIds) {
      await db.delete(assetDefinitions).where(eq(assetDefinitions.id, id));
    }
  });

  it("creates a custom asset definition with defaults applied", async () => {
    const def = await createAssetDefinition({ key: `${PREFIX}widget`, name: "Widget de prueba" });
    createdDefinitionIds.push(def.id);

    expect(def.id).toBeTruthy();
    expect(def.key).toBe(`${PREFIX}widget`);
    expect(def.name).toBe("Widget de prueba");
    expect(def.isSystem).toBe(false);
    expect(def.hasExtensionTable).toBe(false);
    expect(def.isActive).toBe(true);
  });

  it("round-trips get / getByKey / list", async () => {
    const def = await createAssetDefinition({ key: `${PREFIX}gadget`, name: "Gadget de prueba", icon: "cpu" });
    createdDefinitionIds.push(def.id);

    const byId = await getAssetDefinition(def.id);
    expect(byId?.id).toBe(def.id);

    const byKey = await getAssetDefinitionByKey(`${PREFIX}gadget`);
    expect(byKey?.id).toBe(def.id);

    const all = await listAssetDefinitions();
    expect(all.some((d) => d.id === def.id)).toBe(true);
  });

  it("returns undefined for a definition that does not exist", async () => {
    expect(await getAssetDefinition("00000000-0000-0000-0000-000000000000")).toBeUndefined();
    expect(await getAssetDefinitionByKey(`${PREFIX}does_not_exist`)).toBeUndefined();
  });

  it("updates a definition", async () => {
    const def = await createAssetDefinition({ key: `${PREFIX}updatable`, name: "Original" });
    createdDefinitionIds.push(def.id);

    const updated = await updateAssetDefinition(def.id, { name: "Renombrado", isActive: false });
    expect(updated.name).toBe("Renombrado");
    expect(updated.isActive).toBe(false);
  });

  it("throws when updating a definition that does not exist", async () => {
    await expect(updateAssetDefinition("00000000-0000-0000-0000-000000000000", { name: "x" })).rejects.toThrow();
  });

  it("creates, lists, and deletes field definitions for a definition, honoring sortOrder", async () => {
    const def = await createAssetDefinition({ key: `${PREFIX}with_fields`, name: "Con campos" });
    createdDefinitionIds.push(def.id);

    const second = await createAssetFieldDefinition({
      assetDefinitionId: def.id,
      key: "second_field",
      label: "Segundo campo",
      fieldType: "text",
      sortOrder: 2,
    });
    const first = await createAssetFieldDefinition({
      assetDefinitionId: def.id,
      key: "first_field",
      label: "Primer campo",
      fieldType: "number",
      isRequired: true,
      sortOrder: 1,
    });

    const fields = await listAssetFieldDefinitions(def.id);
    expect(fields.map((f) => f.key)).toEqual(["first_field", "second_field"]);
    expect(fields.find((f) => f.key === "first_field")?.isRequired).toBe(true);
    expect(fields.find((f) => f.key === "second_field")?.isRequired).toBe(false);

    await deleteAssetFieldDefinition(second.id);
    const remaining = await listAssetFieldDefinitions(def.id);
    expect(remaining.map((f) => f.key)).toEqual(["first_field"]);

    // cleanup the still-existing field row (definition cleanup in afterAll would also cascade this)
    await deleteAssetFieldDefinition(first.id);
  });

  it("moduleKeyForAssetDefinition maps known system types to their dedicated module, and everything else to ASSETS_GENERIC", () => {
    expect(moduleKeyForAssetDefinition({ key: "computer", isSystem: true })).toBe(MODULE.ASSETS_COMPUTER);
    expect(moduleKeyForAssetDefinition({ key: "network_equipment", isSystem: true })).toBe(MODULE.ASSETS_NETWORK_EQUIPMENT);
    expect(moduleKeyForAssetDefinition({ key: "monitor", isSystem: true })).toBe(MODULE.ASSETS_MONITOR);
    expect(moduleKeyForAssetDefinition({ key: "printer", isSystem: true })).toBe(MODULE.ASSETS_PRINTER);
    expect(moduleKeyForAssetDefinition({ key: "phone", isSystem: true })).toBe(MODULE.ASSETS_PHONE);
    expect(moduleKeyForAssetDefinition({ key: "peripheral", isSystem: true })).toBe(MODULE.ASSETS_PERIPHERAL);
    expect(moduleKeyForAssetDefinition({ key: "datacenter", isSystem: true })).toBe(MODULE.MANAGEMENT_DATACENTER);
    expect(moduleKeyForAssetDefinition({ key: "domain", isSystem: true })).toBe(MODULE.MANAGEMENT_DOMAIN);
    expect(moduleKeyForAssetDefinition({ key: "line", isSystem: true })).toBe(MODULE.MANAGEMENT_LINE);
    expect(moduleKeyForAssetDefinition({ key: "database", isSystem: true })).toBe(MODULE.MANAGEMENT_DATABASE);

    // A system type whose key isn't in the known map still falls back to generic.
    expect(moduleKeyForAssetDefinition({ key: "rack", isSystem: true })).toBe(MODULE.ASSETS_GENERIC);

    // Admin-created custom types (isSystem = false) always fall back to generic,
    // even if their key happens to collide with a known system key.
    expect(moduleKeyForAssetDefinition({ key: `${PREFIX}custom`, isSystem: false })).toBe(MODULE.ASSETS_GENERIC);
    expect(moduleKeyForAssetDefinition({ key: "computer", isSystem: false })).toBe(MODULE.ASSETS_GENERIC);
  });
});

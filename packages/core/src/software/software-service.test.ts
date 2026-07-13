import "dotenv/config";
import {
  assets,
  auditLog,
  computers,
  db,
  entities,
  softwareLicenses,
  softwareVersions,
  software as softwareTable,
  assetSoftwareInstallations,
} from "@itsm/db";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createComputer } from "../assets/computer-service";
import { createEntity } from "../entities/entity-service";
import {
  countSeatsUsed,
  createInstallation,
  createSoftware,
  createSoftwareLicense,
  createSoftwareVersion,
  getSoftware,
  listInstallationsForAsset,
  listInstallationsForVersion,
  listSoftware,
  listSoftwareLicenses,
  listSoftwareVersions,
} from "./software-service";

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PREFIX = `__vitest_assets__${RUN}_`;

describe("software-service", () => {
  let entityId: string;
  let childEntityId: string;
  let computerAssetId: string;
  let secondComputerAssetId: string;

  beforeAll(async () => {
    const root = await createEntity({ name: `${PREFIX}sw-root` });
    entityId = root.id;
    const child = await createEntity({ name: `${PREFIX}sw-child`, parentId: root.id });
    childEntityId = child.id;

    const { asset: computerAsset } = await createComputer({ entityId, name: `${PREFIX}sw-host-1` }, null);
    computerAssetId = computerAsset.id;
    const { asset: computerAsset2 } = await createComputer({ entityId, name: `${PREFIX}sw-host-2` }, null);
    secondComputerAssetId = computerAsset2.id;
  });

  afterAll(async () => {
    // asset_software_installations must go before software_versions/software_licenses (both restrict on delete).
    await db.delete(assetSoftwareInstallations).where(eq(assetSoftwareInstallations.assetId, computerAssetId));
    await db.delete(assetSoftwareInstallations).where(eq(assetSoftwareInstallations.assetId, secondComputerAssetId));

    const ownSoftware = await db
      .select({ id: softwareTable.id })
      .from(softwareTable)
      .where(inArray(softwareTable.entityId, [entityId, childEntityId]));
    for (const { id } of ownSoftware) {
      await db.delete(softwareLicenses).where(eq(softwareLicenses.softwareId, id));
      await db.delete(softwareVersions).where(eq(softwareVersions.softwareId, id));
    }
    await db.delete(softwareTable).where(inArray(softwareTable.entityId, [entityId, childEntityId]));

    await db.delete(auditLog).where(eq(auditLog.entityId, entityId));
    await db.delete(auditLog).where(eq(auditLog.entityId, childEntityId));

    await db.delete(computers).where(eq(computers.assetId, computerAssetId));
    await db.delete(computers).where(eq(computers.assetId, secondComputerAssetId));
    await db.delete(assets).where(eq(assets.entityId, entityId));
    await db.delete(assets).where(eq(assets.entityId, childEntityId));

    await db.delete(entities).where(eq(entities.id, childEntityId));
    await db.delete(entities).where(eq(entities.id, entityId));
  });

  it("creates software and round-trips get/list", async () => {
    const sw = await createSoftware({ entityId, name: `${PREFIX}office-suite` });
    expect(sw.id).toBeTruthy();

    const fetched = await getSoftware(sw.id);
    expect(fetched?.id).toBe(sw.id);

    const listed = await listSoftware(entityId);
    expect(listed.some((s) => s.id === sw.id)).toBe(true);
  });

  it("getSoftware returns undefined for an id that does not exist", async () => {
    expect(await getSoftware("00000000-0000-0000-0000-000000000000")).toBeUndefined();
  });

  it("listSoftware only includes descendant-entity rows when includeSubtree is true", async () => {
    const inChild = await createSoftware({ entityId: childEntityId, name: `${PREFIX}child-only-app` });

    const rootOnly = await listSoftware(entityId);
    expect(rootOnly.some((s) => s.id === inChild.id)).toBe(false);

    const rootSubtree = await listSoftware(entityId, { includeSubtree: true });
    expect(rootSubtree.some((s) => s.id === inChild.id)).toBe(true);
  });

  it("creates and lists software versions ordered by name", async () => {
    const sw = await createSoftware({ entityId, name: `${PREFIX}versioned-app` });
    await createSoftwareVersion({ softwareId: sw.id, name: "2.0" });
    await createSoftwareVersion({ softwareId: sw.id, name: "1.0" });

    const versions = await listSoftwareVersions(sw.id);
    expect(versions.map((v) => v.name)).toEqual(["1.0", "2.0"]);
  });

  it("creates and lists software licenses, excluding soft-deleted rows", async () => {
    const sw = await createSoftware({ entityId, name: `${PREFIX}licensed-app` });
    const license = await createSoftwareLicense({
      entityId,
      softwareId: sw.id,
      name: `${PREFIX}license-a`,
      licenseType: "per_seat",
      seatsTotal: 10,
    });

    const listed = await listSoftwareLicenses(sw.id);
    expect(listed.some((l) => l.id === license.id)).toBe(true);

    await db.update(softwareLicenses).set({ deletedAt: new Date() }).where(eq(softwareLicenses.id, license.id));
    const afterSoftDelete = await listSoftwareLicenses(sw.id);
    expect(afterSoftDelete.some((l) => l.id === license.id)).toBe(false);
  });

  it("creates installations, lists them by asset/version, and counts seats used per license", async () => {
    const sw = await createSoftware({ entityId, name: `${PREFIX}seat-tracked-app` });
    const version = await createSoftwareVersion({ softwareId: sw.id, name: "1.0" });
    const license = await createSoftwareLicense({
      entityId,
      softwareId: sw.id,
      softwareVersionId: version.id,
      name: `${PREFIX}seat-license`,
      licenseType: "per_seat",
      seatsTotal: 5,
    });

    expect(await countSeatsUsed(license.id)).toBe(0);

    const install1 = await createInstallation({ assetId: computerAssetId, softwareVersionId: version.id, softwareLicenseId: license.id });
    const install2 = await createInstallation({
      assetId: secondComputerAssetId,
      softwareVersionId: version.id,
      softwareLicenseId: license.id,
    });

    expect(await countSeatsUsed(license.id)).toBe(2);

    const forAsset = await listInstallationsForAsset(computerAssetId);
    expect(forAsset.map((i) => i.id)).toEqual([install1.id]);

    const forVersion = await listInstallationsForVersion(version.id);
    expect(forVersion.map((i) => i.id).sort()).toEqual([install1.id, install2.id].sort());
  });

  it("rejects a duplicate installation for the same asset+version pair", async () => {
    const sw = await createSoftware({ entityId, name: `${PREFIX}dup-install-app` });
    const version = await createSoftwareVersion({ softwareId: sw.id, name: "1.0" });

    await createInstallation({ assetId: computerAssetId, softwareVersionId: version.id });
    await expect(createInstallation({ assetId: computerAssetId, softwareVersionId: version.id })).rejects.toThrow();
  });
});

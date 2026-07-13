import "dotenv/config";
import {
  assetDefinitions,
  assets,
  certificates,
  db,
  entities,
  type Asset,
  type AssetDefinition,
  type Entity,
} from "@itsm/db";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEntity } from "../entities/entity-service";
import { createCertificate, listCertificates } from "./certificate-service";

const PREFIX = "__vitest_mgmt__certificate-service";
const DAY_MS = 24 * 60 * 60 * 1000;

describe("certificate-service", () => {
  let rootEntity: Entity;
  let childEntity: Entity;
  let assetDefinition: AssetDefinition;
  let asset: Asset;
  const certificateIds: string[] = [];

  beforeAll(async () => {
    rootEntity = await createEntity({ name: `${PREFIX}-root` });
    childEntity = await createEntity({ name: `${PREFIX}-child`, parentId: rootEntity.id });
    const [insertedDefinition] = await db
      .insert(assetDefinitions)
      .values({ key: `${PREFIX}-def`, name: `${PREFIX}-def` })
      .returning();
    if (!insertedDefinition) throw new Error("Failed to insert asset definition");
    assetDefinition = insertedDefinition;

    const [insertedAsset] = await db
      .insert(assets)
      .values({ entityId: rootEntity.id, assetDefinitionId: assetDefinition.id, name: `${PREFIX}-asset` })
      .returning();
    if (!insertedAsset) throw new Error("Failed to insert asset");
    asset = insertedAsset;
  });

  afterAll(async () => {
    // certificates.assignedAssetId has no ON DELETE CASCADE -> delete certificates before the asset.
    if (certificateIds.length) await db.delete(certificates).where(inArray(certificates.id, certificateIds));
    await db.delete(assets).where(eq(assets.id, asset.id));
    await db.delete(assetDefinitions).where(eq(assetDefinitions.id, assetDefinition.id));
    await db.delete(entities).where(eq(entities.id, childEntity.id));
    await db.delete(entities).where(eq(entities.id, rootEntity.id));
  });

  it("applies default certificateType and null optional fields on minimal input", async () => {
    const cert = await createCertificate({ entityId: rootEntity.id, name: `${PREFIX}-minimal` });
    certificateIds.push(cert.id);

    expect(cert.certificateType).toBe("ssl");
    expect(cert.issuer).toBeNull();
    expect(cert.serialNumber).toBeNull();
    expect(cert.validFrom).toBeNull();
    expect(cert.validUntil).toBeNull();
    expect(cert.assignedAssetId).toBeNull();
    expect(cert.deletedAt).toBeNull();
  });

  it("stores an explicit certificateType, assigns it to an asset, and coerces validity dates", async () => {
    const cert = await createCertificate({
      entityId: rootEntity.id,
      name: `${PREFIX}-assigned`,
      certificateType: "code_signing",
      issuer: "Let's Encrypt",
      serialNumber: "ABC123",
      validFrom: "2026-01-01",
      validUntil: "2027-01-01",
      assignedAssetId: asset.id,
      comment: "renews yearly",
    });
    certificateIds.push(cert.id);

    expect(cert.certificateType).toBe("code_signing");
    expect(cert.issuer).toBe("Let's Encrypt");
    expect(cert.assignedAssetId).toBe(asset.id);
    expect(cert.validFrom).toBeInstanceOf(Date);
    expect(cert.validUntil).toBeInstanceOf(Date);
  });

  it("distinguishes a certificate already expired from one still valid", async () => {
    const now = Date.now();
    const expired = await createCertificate({
      entityId: rootEntity.id,
      name: `${PREFIX}-expired`,
      validFrom: new Date(now - 400 * DAY_MS),
      validUntil: new Date(now - 30 * DAY_MS),
    });
    const stillValid = await createCertificate({
      entityId: rootEntity.id,
      name: `${PREFIX}-valid`,
      validFrom: new Date(now - 30 * DAY_MS),
      validUntil: new Date(now + 300 * DAY_MS),
    });
    certificateIds.push(expired.id, stillValid.id);

    expect(expired.validUntil!.getTime()).toBeLessThan(now);
    expect(stillValid.validUntil!.getTime()).toBeGreaterThan(now);
  });

  it("orders listCertificates by validUntil ascending, soonest-expiring first", async () => {
    const now = Date.now();
    const expiresSoon = await createCertificate({
      entityId: rootEntity.id,
      name: `${PREFIX}-expires-soon`,
      validUntil: new Date(now + 5 * DAY_MS),
    });
    const expiresLater = await createCertificate({
      entityId: rootEntity.id,
      name: `${PREFIX}-expires-later`,
      validUntil: new Date(now + 200 * DAY_MS),
    });
    certificateIds.push(expiresSoon.id, expiresLater.id);

    const list = await listCertificates(rootEntity.id);
    const soonIdx = list.findIndex((c) => c.id === expiresSoon.id);
    const laterIdx = list.findIndex((c) => c.id === expiresLater.id);
    expect(soonIdx).toBeGreaterThanOrEqual(0);
    expect(laterIdx).toBeGreaterThanOrEqual(0);
    expect(soonIdx).toBeLessThan(laterIdx);
  });

  it("scopes listCertificates to the given entity by default, and includes the subtree when asked", async () => {
    const rootCert = await createCertificate({ entityId: rootEntity.id, name: `${PREFIX}-root-cert` });
    const childCert = await createCertificate({ entityId: childEntity.id, name: `${PREFIX}-child-cert` });
    certificateIds.push(rootCert.id, childCert.id);

    const rootOnly = await listCertificates(rootEntity.id);
    expect(rootOnly.map((c) => c.id)).toContain(rootCert.id);
    expect(rootOnly.map((c) => c.id)).not.toContain(childCert.id);

    const withSubtree = await listCertificates(rootEntity.id, { includeSubtree: true });
    expect(withSubtree.map((c) => c.id)).toContain(rootCert.id);
    expect(withSubtree.map((c) => c.id)).toContain(childCert.id);
  });

  it("excludes soft-deleted certificates (deletedAt set) from listCertificates", async () => {
    const cert = await createCertificate({ entityId: rootEntity.id, name: `${PREFIX}-soft-deleted` });
    certificateIds.push(cert.id);

    // certificate-service has no softDelete*/getCertificate export (unlike supplier/contact) -
    // exercise the deletedAt filter in listCertificates directly against the column it reads.
    await db.update(certificates).set({ deletedAt: new Date() }).where(eq(certificates.id, cert.id));

    const list = await listCertificates(rootEntity.id);
    expect(list.map((c) => c.id)).not.toContain(cert.id);
  });
});

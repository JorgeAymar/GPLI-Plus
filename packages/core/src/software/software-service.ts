import {
  assetSoftwareInstallations,
  db,
  software,
  softwareLicenses,
  softwareVersions,
  type AssetSoftwareInstallation,
  type LicenseType,
  type Software,
  type SoftwareLicense,
  type SoftwareVersion,
} from "@itsm/db";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { listSubtree } from "../entities/entity-service";

export async function createSoftware(input: {
  entityId: string;
  name: string;
  manufacturerDropdownItemId?: string | null;
  categoryDropdownItemId?: string | null;
  comment?: string | null;
}): Promise<Software> {
  const [created] = await db
    .insert(software)
    .values({
      entityId: input.entityId,
      name: input.name,
      manufacturerDropdownItemId: input.manufacturerDropdownItemId ?? null,
      categoryDropdownItemId: input.categoryDropdownItemId ?? null,
      comment: input.comment ?? null,
    })
    .returning();
  if (!created) throw new Error("Failed to insert software");
  return created;
}

export async function getSoftware(id: string): Promise<Software | undefined> {
  const [row] = await db.select().from(software).where(eq(software.id, id));
  return row;
}

export async function listSoftware(entityId: string, options?: { includeSubtree?: boolean }): Promise<Software[]> {
  const entityIds = options?.includeSubtree ? (await listSubtree(entityId)).map((e) => e.id) : [entityId];
  return db
    .select()
    .from(software)
    .where(and(inArray(software.entityId, entityIds), isNull(software.deletedAt)))
    .orderBy(software.name);
}

export async function createSoftwareVersion(input: {
  softwareId: string;
  name: string;
  osDropdownItemId?: string | null;
}): Promise<SoftwareVersion> {
  const [created] = await db
    .insert(softwareVersions)
    .values({ softwareId: input.softwareId, name: input.name, osDropdownItemId: input.osDropdownItemId ?? null })
    .returning();
  if (!created) throw new Error("Failed to insert software version");
  return created;
}

export async function listSoftwareVersions(softwareId: string): Promise<SoftwareVersion[]> {
  return db.select().from(softwareVersions).where(eq(softwareVersions.softwareId, softwareId)).orderBy(softwareVersions.name);
}

export async function createSoftwareLicense(input: {
  entityId: string;
  softwareId: string;
  softwareVersionId?: string | null;
  name: string;
  licenseType: LicenseType;
  serialNumber?: string | null;
  seatsTotal?: number | null;
  purchaseDate?: string | Date | null;
  expirationDate?: string | Date | null;
  comment?: string | null;
}): Promise<SoftwareLicense> {
  const [created] = await db
    .insert(softwareLicenses)
    .values({
      entityId: input.entityId,
      softwareId: input.softwareId,
      softwareVersionId: input.softwareVersionId ?? null,
      name: input.name,
      licenseType: input.licenseType,
      serialNumber: input.serialNumber ?? null,
      seatsTotal: input.seatsTotal ?? null,
      purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null,
      expirationDate: input.expirationDate ? new Date(input.expirationDate) : null,
      comment: input.comment ?? null,
    })
    .returning();
  if (!created) throw new Error("Failed to insert software license");
  return created;
}

export async function listSoftwareLicenses(softwareId: string): Promise<SoftwareLicense[]> {
  return db
    .select()
    .from(softwareLicenses)
    .where(and(eq(softwareLicenses.softwareId, softwareId), isNull(softwareLicenses.deletedAt)))
    .orderBy(softwareLicenses.name);
}

export async function createInstallation(input: {
  assetId: string;
  softwareVersionId: string;
  softwareLicenseId?: string | null;
  installDate?: string | Date | null;
}): Promise<AssetSoftwareInstallation> {
  const [created] = await db
    .insert(assetSoftwareInstallations)
    .values({
      assetId: input.assetId,
      softwareVersionId: input.softwareVersionId,
      softwareLicenseId: input.softwareLicenseId ?? null,
      installDate: input.installDate ? new Date(input.installDate) : null,
    })
    .returning();
  if (!created) throw new Error("Failed to insert installation");
  return created;
}

export async function listInstallationsForAsset(assetId: string): Promise<AssetSoftwareInstallation[]> {
  return db.select().from(assetSoftwareInstallations).where(eq(assetSoftwareInstallations.assetId, assetId));
}

export async function listInstallationsForVersion(softwareVersionId: string): Promise<AssetSoftwareInstallation[]> {
  return db.select().from(assetSoftwareInstallations).where(eq(assetSoftwareInstallations.softwareVersionId, softwareVersionId));
}

/** No denormalized counter column - cheap COUNT(*) over installations for this license. */
export async function countSeatsUsed(softwareLicenseId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(assetSoftwareInstallations)
    .where(eq(assetSoftwareInstallations.softwareLicenseId, softwareLicenseId));
  return row?.value ?? 0;
}

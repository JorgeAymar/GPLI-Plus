import { certificates, db, type Certificate, type CertificateType } from "@itsm/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { listSubtree } from "../entities/entity-service";

export async function createCertificate(input: {
  entityId: string;
  name: string;
  certificateType?: CertificateType;
  issuer?: string | null;
  serialNumber?: string | null;
  validFrom?: string | Date | null;
  validUntil?: string | Date | null;
  assignedAssetId?: string | null;
  comment?: string | null;
}): Promise<Certificate> {
  const [created] = await db
    .insert(certificates)
    .values({
      entityId: input.entityId,
      name: input.name,
      certificateType: input.certificateType ?? "ssl",
      issuer: input.issuer ?? null,
      serialNumber: input.serialNumber ?? null,
      validFrom: input.validFrom ? new Date(input.validFrom) : null,
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
      assignedAssetId: input.assignedAssetId ?? null,
      comment: input.comment ?? null,
    })
    .returning();
  if (!created) throw new Error("Failed to insert certificate");
  return created;
}

export async function listCertificates(entityId: string, options?: { includeSubtree?: boolean }): Promise<Certificate[]> {
  const entityIds = options?.includeSubtree ? (await listSubtree(entityId)).map((e) => e.id) : [entityId];
  return db
    .select()
    .from(certificates)
    .where(and(inArray(certificates.entityId, entityIds), isNull(certificates.deletedAt)))
    .orderBy(certificates.validUntil);
}

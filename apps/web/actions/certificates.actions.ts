"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, createCertificate, createCertificateSchema, recordAuditLog, requireRight } from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createCertificateAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.MANAGEMENT_CERTIFICATE, RIGHT.CREATE);
  const parsed = createCertificateSchema.parse(input);
  const certificate = await createCertificate(parsed);
  await recordAuditLog({
    entityId: certificate.entityId,
    actorUserId: context.user.id,
    action: "create",
    objectType: "certificate",
    objectId: certificate.id,
    after: certificate,
  });
  revalidatePath("/management/certificates");
  return certificate;
}

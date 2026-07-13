"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, createCertificate, createCertificateSchema, requireRight } from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createCertificateAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.MANAGEMENT_CERTIFICATE, RIGHT.CREATE);
  const parsed = createCertificateSchema.parse(input);
  const certificate = await createCertificate(parsed);
  revalidatePath("/management/certificates");
  return certificate;
}

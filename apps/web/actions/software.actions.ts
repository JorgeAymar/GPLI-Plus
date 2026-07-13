"use server";

import { requireAuthContext } from "@/lib/session";
import {
  MODULE,
  RIGHT,
  createInstallation,
  createInstallationSchema,
  createSoftware,
  createSoftwareLicense,
  createSoftwareLicenseSchema,
  createSoftwareSchema,
  createSoftwareVersion,
  createSoftwareVersionSchema,
  requireRight,
} from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createSoftwareAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ASSETS_SOFTWARE, RIGHT.CREATE);
  const parsed = createSoftwareSchema.parse(input);
  const result = await createSoftware(parsed);
  revalidatePath("/assets/software");
  return result;
}

export async function createSoftwareVersionAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ASSETS_SOFTWARE, RIGHT.CREATE);
  const parsed = createSoftwareVersionSchema.parse(input);
  const result = await createSoftwareVersion(parsed);
  revalidatePath(`/assets/software/${parsed.softwareId}`);
  return result;
}

export async function createSoftwareLicenseAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ASSETS_SOFTWARE_LICENSE, RIGHT.CREATE);
  const parsed = createSoftwareLicenseSchema.parse(input);
  const result = await createSoftwareLicense(parsed);
  revalidatePath(`/assets/software/${parsed.softwareId}`);
  return result;
}

export async function createInstallationAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ASSETS_SOFTWARE, RIGHT.ASSIGN);
  const parsed = createInstallationSchema.parse(input);
  const result = await createInstallation(parsed);
  revalidatePath("/assets/software");
  return result;
}

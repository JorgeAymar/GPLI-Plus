import { z } from "zod";

export const licenseTypeSchema = z.enum(["per_seat", "per_device", "volume", "subscription", "oem", "freeware"]);

export const createSoftwareSchema = z.object({
  entityId: z.guid(),
  name: z.string().min(1).max(255),
  manufacturerDropdownItemId: z.guid().nullable().optional(),
  categoryDropdownItemId: z.guid().nullable().optional(),
  comment: z.string().max(2000).nullable().optional(),
});
export type CreateSoftwareInput = z.infer<typeof createSoftwareSchema>;

export const createSoftwareVersionSchema = z.object({
  softwareId: z.guid(),
  name: z.string().min(1).max(100),
  osDropdownItemId: z.guid().nullable().optional(),
});
export type CreateSoftwareVersionInput = z.infer<typeof createSoftwareVersionSchema>;

export const createSoftwareLicenseSchema = z.object({
  entityId: z.guid(),
  softwareId: z.guid(),
  softwareVersionId: z.guid().nullable().optional(),
  name: z.string().min(1).max(255),
  licenseType: licenseTypeSchema,
  serialNumber: z.string().max(255).nullable().optional(),
  seatsTotal: z.number().int().min(0).nullable().optional(),
  purchaseDate: z.coerce.date().nullable().optional(),
  expirationDate: z.coerce.date().nullable().optional(),
  comment: z.string().max(2000).nullable().optional(),
});
export type CreateSoftwareLicenseInput = z.infer<typeof createSoftwareLicenseSchema>;

export const createInstallationSchema = z.object({
  assetId: z.guid(),
  softwareVersionId: z.guid(),
  softwareLicenseId: z.guid().nullable().optional(),
  installDate: z.coerce.date().nullable().optional(),
});
export type CreateInstallationInput = z.infer<typeof createInstallationSchema>;

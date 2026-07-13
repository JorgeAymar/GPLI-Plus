import { z } from "zod";

export const createLdapAuthSourceSchema = z.object({
  name: z.string().min(1).max(255),
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535).optional(),
  baseDn: z.string().min(1).max(500),
  bindDn: z.string().min(1).max(500),
  bindPasswordEncrypted: z.string().min(1),
  loginField: z.string().min(1).max(100).optional(),
  syncField: z.string().min(1).max(100),
  groupField: z.string().max(100).nullable().optional(),
  useTls: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export type CreateLdapAuthSourceInput = z.infer<typeof createLdapAuthSourceSchema>;

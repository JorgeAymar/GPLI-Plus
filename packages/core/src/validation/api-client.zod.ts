import { z } from "zod";

export const createApiClientSchema = z.object({
  entityId: z.guid(),
  name: z.string().min(1).max(255),
  scopes: z.array(z.string()).min(1),
});
export type CreateApiClientInput = z.infer<typeof createApiClientSchema>;

export const createPersonalApiClientSchema = z.object({
  name: z.string().min(1).max(255),
});
export type CreatePersonalApiClientInput = z.infer<typeof createPersonalApiClientSchema>;

import { z } from "zod";

export const createApiClientSchema = z.object({
  entityId: z.string().uuid(),
  name: z.string().min(1).max(255),
  scopes: z.array(z.string()).min(1),
});
export type CreateApiClientInput = z.infer<typeof createApiClientSchema>;

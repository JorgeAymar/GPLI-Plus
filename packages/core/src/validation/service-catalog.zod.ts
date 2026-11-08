import { z } from "zod";
import { ticketTypeSchema } from "./ticket.zod";

export const createServiceCatalogItemSchema = z.object({
  entityId: z.guid(),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).nullable().optional(),
  ticketType: ticketTypeSchema.optional(),
  categoryDropdownItemId: z.guid().nullable().optional(),
  sortOrder: z.number().int().optional(),
});
export type CreateServiceCatalogItemInput = z.infer<typeof createServiceCatalogItemSchema>;

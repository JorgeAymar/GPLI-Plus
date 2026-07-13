import { z } from "zod";

export const ticketTypeSchema = z.enum(["incident", "request"]);
export const itilStatusSchema = z.enum(["new", "assigned", "planned", "pending", "solved", "closed"]);

export const createTicketSchema = z.object({
  entityId: z.string().uuid(),
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(20000),
  ticketType: ticketTypeSchema.optional(),
  urgency: z.number().int().min(1).max(5).optional(),
  impact: z.number().int().min(1).max(5).optional(),
  priority: z.number().int().min(1).max(5).optional(),
  categoryDropdownItemId: z.string().uuid().nullable().optional(),
  customFields: z.unknown().optional(),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const updateTicketSchema = createTicketSchema.omit({ entityId: true }).partial();
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

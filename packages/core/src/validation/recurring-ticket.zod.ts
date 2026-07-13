import { z } from "zod";

export const createRecurringTicketTemplateSchema = z.object({
  entityId: z.string().uuid(),
  name: z.string().min(1).max(255),
  titleTemplate: z.string().min(1).max(255),
  contentTemplate: z.string().min(1).max(20000),
  ticketType: z.enum(["incident", "request"]).optional(),
  requesterUserId: z.string().uuid(),
  intervalMinutes: z.number().int().min(1),
});
export type CreateRecurringTicketTemplateInput = z.infer<typeof createRecurringTicketTemplateSchema>;

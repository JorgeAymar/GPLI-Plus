import { z } from "zod";

export const createReminderSchema = z.object({
  entityId: z.guid(),
  title: z.string().min(1).max(255),
  content: z.string().nullable().optional(),
  remindAt: z.coerce.date().nullable().optional(),
});
export type CreateReminderInput = z.infer<typeof createReminderSchema>;

import { z } from "zod";

export const attachDocumentSchema = z.object({
  itemType: z.string().min(1).max(100),
  itemId: z.string().uuid(),
});
export type AttachDocumentInput = z.infer<typeof attachDocumentSchema>;

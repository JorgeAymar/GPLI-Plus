import { z } from "zod";

export const createSlaPolicySchema = z.object({
  entityId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).nullable().optional(),
  ttoMinutes: z.number().int().min(1).nullable().optional(),
  ttrMinutes: z.number().int().min(1).nullable().optional(),
});
export type CreateSlaPolicyInput = z.infer<typeof createSlaPolicySchema>;

export const assignSlaSchema = z.object({
  itilType: z.enum(["ticket", "problem", "change"]),
  itilId: z.string().uuid(),
  slaPolicyId: z.string().uuid(),
  slaType: z.enum(["tto", "ttr"]),
});
export type AssignSlaInput = z.infer<typeof assignSlaSchema>;

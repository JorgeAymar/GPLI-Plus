import { z } from "zod";

export const createDashboardSchema = z.object({
  key: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
});
export type CreateDashboardInput = z.infer<typeof createDashboardSchema>;

export const addDashboardCardSchema = z.object({
  dashboardId: z.string().uuid(),
  cardKey: z.string().min(1),
  positionX: z.number().int().optional(),
  positionY: z.number().int().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  options: z.record(z.string(), z.unknown()).optional(),
});
export type AddDashboardCardInput = z.infer<typeof addDashboardCardSchema>;

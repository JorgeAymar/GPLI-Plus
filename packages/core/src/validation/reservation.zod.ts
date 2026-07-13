import { z } from "zod";

export const createReservationItemSchema = z.object({
  assetId: z.string().uuid(),
  comment: z.string().max(2000).nullable().optional(),
});
export type CreateReservationItemInput = z.infer<typeof createReservationItemSchema>;

export const createReservationSchema = z
  .object({
    reservationItemId: z.string().uuid(),
    beginAt: z.coerce.date(),
    endAt: z.coerce.date(),
    requestedByUserId: z.string().uuid(),
    comment: z.string().max(2000).nullable().optional(),
  })
  .refine((data) => data.endAt > data.beginAt, { message: "endAt debe ser posterior a beginAt", path: ["endAt"] });
export type CreateReservationInput = z.infer<typeof createReservationSchema>;

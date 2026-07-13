import { describe, expect, it } from "vitest";
import { createReservationItemSchema, createReservationSchema } from "./reservation.zod";

describe("reservation.zod", () => {
  describe("createReservationSchema", () => {
    const base = {
      reservationItemId: crypto.randomUUID(),
      beginAt: "2027-01-10T09:00:00Z",
      endAt: "2027-01-10T11:00:00Z",
      requestedByUserId: crypto.randomUUID(),
    };

    it("accepts a valid range where endAt is after beginAt", () => {
      const result = createReservationSchema.safeParse(base);
      expect(result.success).toBe(true);
    });

    it("rejects endAt equal to beginAt (refine requires strictly after)", () => {
      const result = createReservationSchema.safeParse({ ...base, endAt: base.beginAt });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(["endAt"]);
      }
    });

    it("rejects endAt before beginAt", () => {
      const result = createReservationSchema.safeParse({ ...base, beginAt: "2027-01-10T11:00:00Z", endAt: "2027-01-10T09:00:00Z" });
      expect(result.success).toBe(false);
    });

    it("rejects a non-uuid reservationItemId", () => {
      const result = createReservationSchema.safeParse({ ...base, reservationItemId: "not-a-uuid" });
      expect(result.success).toBe(false);
    });

    it("coerces string dates into Date instances", () => {
      const result = createReservationSchema.safeParse(base);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.beginAt).toBeInstanceOf(Date);
        expect(result.data.endAt).toBeInstanceOf(Date);
      }
    });
  });

  describe("createReservationItemSchema", () => {
    it("accepts a bare assetId with no comment", () => {
      const result = createReservationItemSchema.safeParse({ assetId: crypto.randomUUID() });
      expect(result.success).toBe(true);
    });

    it("rejects a missing assetId", () => {
      const result = createReservationItemSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("rejects a comment longer than 2000 characters", () => {
      const result = createReservationItemSchema.safeParse({ assetId: crypto.randomUUID(), comment: "a".repeat(2001) });
      expect(result.success).toBe(false);
    });
  });
});

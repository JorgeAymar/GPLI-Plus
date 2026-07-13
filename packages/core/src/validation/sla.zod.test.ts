import { describe, expect, it } from "vitest";
import { assignSlaSchema, createSlaPolicySchema } from "./sla.zod";

const validUuid = "11111111-1111-1111-1111-111111111111";

describe("sla.zod", () => {
  describe("createSlaPolicySchema", () => {
    it("accepts a minimal valid payload", () => {
      expect(createSlaPolicySchema.safeParse({ entityId: validUuid, name: "Standard" }).success).toBe(true);
    });

    it("accepts explicit null targets (not tracked)", () => {
      expect(
        createSlaPolicySchema.safeParse({ entityId: validUuid, name: "Standard", ttoMinutes: null, ttrMinutes: null }).success,
      ).toBe(true);
    });

    it("rejects a target below 1 minute", () => {
      expect(createSlaPolicySchema.safeParse({ entityId: validUuid, name: "Standard", ttoMinutes: 0 }).success).toBe(false);
    });

    it("rejects a missing name", () => {
      expect(createSlaPolicySchema.safeParse({ entityId: validUuid }).success).toBe(false);
    });
  });

  describe("assignSlaSchema", () => {
    it("accepts a valid assignment payload", () => {
      expect(
        assignSlaSchema.safeParse({ itilType: "ticket", itilId: validUuid, slaPolicyId: validUuid, slaType: "tto" }).success,
      ).toBe(true);
    });

    it("rejects an itilType outside ticket/problem/change", () => {
      expect(
        assignSlaSchema.safeParse({ itilType: "task", itilId: validUuid, slaPolicyId: validUuid, slaType: "tto" }).success,
      ).toBe(false);
    });

    it("rejects an slaType outside tto/ttr", () => {
      expect(
        assignSlaSchema.safeParse({ itilType: "ticket", itilId: validUuid, slaPolicyId: validUuid, slaType: "ttf" }).success,
      ).toBe(false);
    });
  });
});

import { describe, expect, it } from "vitest";
import { createNetworkEquipmentSchema } from "./network-equipment.zod";

const VALID_UUID = "11111111-1111-1111-1111-111111111111";

describe("network-equipment.zod: createNetworkEquipmentSchema", () => {
  it("accepts the minimal valid payload", () => {
    expect(createNetworkEquipmentSchema.safeParse({ entityId: VALID_UUID, name: "Switch-1" }).success).toBe(true);
  });

  it("accepts a fully populated payload", () => {
    const result = createNetworkEquipmentSchema.safeParse({
      entityId: VALID_UUID,
      name: "Switch-1",
      ipAddress: "10.0.0.1",
      macAddress: "AA:BB:CC:DD:EE:FF",
      deviceTypeDropdownItemId: VALID_UUID,
      firmwareVersion: "1.2.3",
      portsCount: 48,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative portsCount or a non-integer portsCount", () => {
    expect(createNetworkEquipmentSchema.safeParse({ entityId: VALID_UUID, name: "Switch-1", portsCount: -1 }).success).toBe(false);
    expect(createNetworkEquipmentSchema.safeParse({ entityId: VALID_UUID, name: "Switch-1", portsCount: 1.5 }).success).toBe(false);
  });

  it("accepts portsCount of 0", () => {
    expect(createNetworkEquipmentSchema.safeParse({ entityId: VALID_UUID, name: "Switch-1", portsCount: 0 }).success).toBe(true);
  });

  it("rejects a firmwareVersion over 100 characters", () => {
    const result = createNetworkEquipmentSchema.safeParse({ entityId: VALID_UUID, name: "Switch-1", firmwareVersion: "x".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("rejects a missing name", () => {
    expect(createNetworkEquipmentSchema.safeParse({ entityId: VALID_UUID }).success).toBe(false);
  });
});

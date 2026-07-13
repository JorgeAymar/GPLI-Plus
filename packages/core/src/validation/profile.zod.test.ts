import { describe, expect, it } from "vitest";
import { assignUserProfileSchema, createProfileSchema } from "./profile.zod";

describe("createProfileSchema", () => {
  it("accepts a minimal valid input", () => {
    const result = createProfileSchema.safeParse({ name: "Tecnico", interface: "central" });
    expect(result.success).toBe(true);
  });

  it("accepts 'simplified' interface", () => {
    const result = createProfileSchema.safeParse({ name: "Autoservicio", interface: "simplified" });
    expect(result.success).toBe(true);
  });

  it("accepts an optional description and isDefault", () => {
    const result = createProfileSchema.safeParse({
      name: "Admin",
      interface: "central",
      description: "Perfil administrador",
      isDefault: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing name", () => {
    const result = createProfileSchema.safeParse({ interface: "central" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty string name", () => {
    const result = createProfileSchema.safeParse({ name: "", interface: "central" });
    expect(result.success).toBe(false);
  });

  it("rejects a name longer than 100 characters", () => {
    const result = createProfileSchema.safeParse({ name: "a".repeat(101), interface: "central" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing interface", () => {
    const result = createProfileSchema.safeParse({ name: "Tecnico" });
    expect(result.success).toBe(false);
  });

  it("rejects an interface value outside the enum", () => {
    const result = createProfileSchema.safeParse({ name: "Tecnico", interface: "admin" });
    expect(result.success).toBe(false);
  });

  it("rejects a description longer than 500 characters", () => {
    const result = createProfileSchema.safeParse({
      name: "Tecnico",
      interface: "central",
      description: "a".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe("assignUserProfileSchema", () => {
  const valid = {
    userId: "550e8400-e29b-41d4-a716-446655440000",
    profileId: "660e8400-e29b-41d4-a716-446655440001",
    entityId: "770e8400-e29b-41d4-a716-446655440002",
  };

  it("accepts a minimal valid input", () => {
    expect(assignUserProfileSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts isRecursive and isDefault flags", () => {
    const result = assignUserProfileSchema.safeParse({ ...valid, isRecursive: false, isDefault: true });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid profileId", () => {
    const result = assignUserProfileSchema.safeParse({ ...valid, profileId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing entityId", () => {
    const { entityId: _entityId, ...withoutEntity } = valid;
    const result = assignUserProfileSchema.safeParse(withoutEntity);
    expect(result.success).toBe(false);
  });
});

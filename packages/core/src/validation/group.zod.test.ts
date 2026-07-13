import { describe, expect, it } from "vitest";
import { addUserToGroupSchema, createGroupSchema } from "./group.zod";

describe("createGroupSchema", () => {
  it("accepts a minimal valid input", () => {
    const result = createGroupSchema.safeParse({
      entityId: "550e8400-e29b-41d4-a716-446655440000",
      name: "Soporte N1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid input with parentId", () => {
    const result = createGroupSchema.safeParse({
      entityId: "550e8400-e29b-41d4-a716-446655440000",
      parentId: "660e8400-e29b-41d4-a716-446655440001",
      name: "Soporte N2",
    });
    expect(result.success).toBe(true);
  });

  it("accepts explicit null parentId", () => {
    const result = createGroupSchema.safeParse({
      entityId: "550e8400-e29b-41d4-a716-446655440000",
      parentId: null,
      name: "Soporte N1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing entityId", () => {
    const result = createGroupSchema.safeParse({ name: "Soporte N1" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid entityId", () => {
    const result = createGroupSchema.safeParse({ entityId: "not-a-uuid", name: "Soporte N1" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty string name", () => {
    const result = createGroupSchema.safeParse({ entityId: "550e8400-e29b-41d4-a716-446655440000", name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a name longer than 255 characters", () => {
    const result = createGroupSchema.safeParse({
      entityId: "550e8400-e29b-41d4-a716-446655440000",
      name: "a".repeat(256),
    });
    expect(result.success).toBe(false);
  });
});

describe("addUserToGroupSchema", () => {
  it("accepts a minimal valid input", () => {
    const result = addUserToGroupSchema.safeParse({
      userId: "550e8400-e29b-41d4-a716-446655440000",
      groupId: "660e8400-e29b-41d4-a716-446655440001",
    });
    expect(result.success).toBe(true);
  });

  it("accepts isManager: true", () => {
    const result = addUserToGroupSchema.safeParse({
      userId: "550e8400-e29b-41d4-a716-446655440000",
      groupId: "660e8400-e29b-41d4-a716-446655440001",
      isManager: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid userId", () => {
    const result = addUserToGroupSchema.safeParse({
      userId: "abc",
      groupId: "660e8400-e29b-41d4-a716-446655440001",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-boolean isManager", () => {
    const result = addUserToGroupSchema.safeParse({
      userId: "550e8400-e29b-41d4-a716-446655440000",
      groupId: "660e8400-e29b-41d4-a716-446655440001",
      isManager: "yes",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing groupId", () => {
    const result = addUserToGroupSchema.safeParse({ userId: "550e8400-e29b-41d4-a716-446655440000" });
    expect(result.success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { createEntitySchema, moveEntitySchema } from "./entity.zod";

describe("createEntitySchema", () => {
  it("accepts a minimal valid input (name only)", () => {
    const result = createEntitySchema.safeParse({ name: "Sucursal Norte" });
    expect(result.success).toBe(true);
  });

  it("accepts a valid input with parentId and comment", () => {
    const result = createEntitySchema.safeParse({
      name: "Sucursal Sur",
      parentId: "550e8400-e29b-41d4-a716-446655440000",
      comment: "Comentario opcional",
    });
    expect(result.success).toBe(true);
  });

  it("accepts explicit null for parentId and comment", () => {
    const result = createEntitySchema.safeParse({ name: "Root", parentId: null, comment: null });
    expect(result.success).toBe(true);
  });

  it("rejects a missing name", () => {
    const result = createEntitySchema.safeParse({ parentId: null });
    expect(result.success).toBe(false);
  });

  it("rejects an empty string name", () => {
    const result = createEntitySchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a name longer than 255 characters", () => {
    const result = createEntitySchema.safeParse({ name: "a".repeat(256) });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid parentId", () => {
    const result = createEntitySchema.safeParse({ name: "X", parentId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects a comment longer than 1000 characters", () => {
    const result = createEntitySchema.safeParse({ name: "X", comment: "a".repeat(1001) });
    expect(result.success).toBe(false);
  });

  it("rejects a non-string name (type error)", () => {
    const result = createEntitySchema.safeParse({ name: 123 });
    expect(result.success).toBe(false);
  });
});

describe("moveEntitySchema", () => {
  it("accepts a valid entityId with a null newParentId (move to root)", () => {
    const result = moveEntitySchema.safeParse({
      entityId: "550e8400-e29b-41d4-a716-446655440000",
      newParentId: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid entityId with a uuid newParentId", () => {
    const result = moveEntitySchema.safeParse({
      entityId: "550e8400-e29b-41d4-a716-446655440000",
      newParentId: "660e8400-e29b-41d4-a716-446655440001",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing entityId", () => {
    const result = moveEntitySchema.safeParse({ newParentId: null });
    expect(result.success).toBe(false);
  });

  it("rejects when newParentId is omitted entirely (required, not optional)", () => {
    const result = moveEntitySchema.safeParse({ entityId: "550e8400-e29b-41d4-a716-446655440000" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid entityId", () => {
    const result = moveEntitySchema.safeParse({ entityId: "abc", newParentId: null });
    expect(result.success).toBe(false);
  });
});

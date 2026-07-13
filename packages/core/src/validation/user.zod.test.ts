import { describe, expect, it } from "vitest";
import { createUserSchema, loginSchema } from "./user.zod";

describe("createUserSchema", () => {
  const valid = {
    email: "tecnico@example.com",
    username: "tecnico.uno",
    password: "supersecret",
    displayName: "Tecnico Uno",
  };

  it("accepts a minimal valid input", () => {
    expect(createUserSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts an optional defaultEntityId", () => {
    const result = createUserSchema.safeParse({
      ...valid,
      defaultEntityId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an explicit null defaultEntityId", () => {
    const result = createUserSchema.safeParse({ ...valid, defaultEntityId: null });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = createUserSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects a username shorter than 3 characters", () => {
    const result = createUserSchema.safeParse({ ...valid, username: "ab" });
    expect(result.success).toBe(false);
  });

  it("rejects a username with disallowed characters (spaces)", () => {
    const result = createUserSchema.safeParse({ ...valid, username: "tecnico uno" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/letters, digits, dots, dashes and underscores/i);
    }
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = createUserSchema.safeParse({ ...valid, password: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing displayName", () => {
    const { displayName: _displayName, ...withoutDisplayName } = valid;
    const result = createUserSchema.safeParse(withoutDisplayName);
    expect(result.success).toBe(false);
  });

  it("rejects an empty string displayName", () => {
    const result = createUserSchema.safeParse({ ...valid, displayName: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid defaultEntityId", () => {
    const result = createUserSchema.safeParse({ ...valid, defaultEntityId: "abc" });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts a valid email/password pair", () => {
    const result = loginSchema.safeParse({ email: "tecnico@example.com", password: "anything" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "anything" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "tecnico@example.com", password: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing password", () => {
    const result = loginSchema.safeParse({ email: "tecnico@example.com" });
    expect(result.success).toBe(false);
  });
});

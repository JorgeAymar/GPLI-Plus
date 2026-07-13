import "dotenv/config";
import { randomUUID } from "node:crypto";
import { db, users } from "@itsm/db";
import { inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createUserSchema, loginSchema } from "../validation/user.zod";
import { createUser, findUserByEmail, listUsers, verifyPassword } from "./user-service";

const PREFIX = "__vitest_platform__";
const createdUserIds: string[] = [];

async function makeUser(overrides: Partial<{ email: string; username: string; password: string; displayName: string }> = {}) {
  const suffix = randomUUID();
  const user = await createUser({
    email: overrides.email ?? `${PREFIX}user_${suffix}@example.com`,
    username: overrides.username ?? `${PREFIX}user_${suffix}`,
    password: overrides.password ?? "correct-horse-battery-staple",
    displayName: overrides.displayName ?? "Vitest User",
  });
  createdUserIds.push(user.id);
  return user;
}

describe("user-service", () => {
  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  });

  it("createUser hashes the password (never stores it in plaintext)", async () => {
    const user = await makeUser({ password: "s3cr3t-pass" });
    expect(user.passwordHash).toBeTruthy();
    expect(user.passwordHash).not.toBe("s3cr3t-pass");
  });

  it("verifyPassword returns true for the correct password and false for a wrong one", async () => {
    const user = await makeUser({ password: "the-correct-password" });
    expect(await verifyPassword(user, "the-correct-password")).toBe(true);
    expect(await verifyPassword(user, "definitely-wrong")).toBe(false);
  });

  it("verifyPassword returns false when passwordHash is null (e.g. SSO-only account)", async () => {
    expect(await verifyPassword({ passwordHash: null }, "anything")).toBe(false);
  });

  it("findUserByEmail finds an existing user and returns undefined for an unknown email", async () => {
    const email = `${PREFIX}findme_${randomUUID()}@example.com`;
    const user = await makeUser({ email });

    const found = await findUserByEmail(email);
    expect(found?.id).toBe(user.id);

    const notFound = await findUserByEmail(`${PREFIX}nobody_${randomUUID()}@example.com`);
    expect(notFound).toBeUndefined();
  });

  it("listUsers includes newly created users", async () => {
    const user = await makeUser();
    const all = await listUsers();
    expect(all.some((u) => u.id === user.id)).toBe(true);
  });

  describe("user zod schemas", () => {
    it("createUserSchema enforces email format, username charset, and minimum password length", () => {
      expect(
        createUserSchema.safeParse({
          email: "valid@example.com",
          username: "valid_user.name-1",
          password: "12345678",
          displayName: "Someone",
        }).success,
      ).toBe(true);

      expect(
        createUserSchema.safeParse({
          email: "not-an-email",
          username: "valid_user",
          password: "12345678",
          displayName: "Someone",
        }).success,
      ).toBe(false);

      expect(
        createUserSchema.safeParse({
          email: "valid@example.com",
          username: "invalid username with spaces",
          password: "12345678",
          displayName: "Someone",
        }).success,
      ).toBe(false);

      expect(
        createUserSchema.safeParse({
          email: "valid@example.com",
          username: "valid_user",
          password: "short",
          displayName: "Someone",
        }).success,
      ).toBe(false);
    });

    it("loginSchema requires an email and a non-empty password", () => {
      expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
      expect(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
      expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
    });
  });
});

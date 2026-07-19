import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, users, type User } from "@itsm/db";
import { SALT_ROUNDS } from "../constants";

export async function createUser(input: {
  email: string;
  username: string;
  password: string;
  displayName: string;
  defaultEntityId?: string | null;
}): Promise<User> {
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const [created] = await db
    .insert(users)
    .values({
      email: input.email,
      username: input.username,
      passwordHash,
      displayName: input.displayName,
      name: input.displayName,
      defaultEntityId: input.defaultEntityId ?? null,
    })
    .returning();
  if (!created) throw new Error("Failed to insert user");
  return created;
}

export async function verifyPassword(user: Pick<User, "passwordHash">, password: string): Promise<boolean> {
  if (!user.passwordHash) return false;
  return bcrypt.compare(password, user.passwordHash);
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user;
}

/**
 * Single indexed lookup by PK - the cheap half of what resolveAuthContext does, for callers
 * (proxy.ts) that only need to know "is this session's userId still a real, active user"
 * and can't afford the full user+entity+profile resolution on every request.
 */
export async function isActiveUserId(userId: string): Promise<boolean> {
  const [user] = await db.select({ isActive: users.isActive }).from(users).where(eq(users.id, userId));
  return user?.isActive ?? false;
}

export async function listUsers(): Promise<User[]> {
  return db.select().from(users).orderBy(users.displayName);
}

/** Called from the Auth.js `authorize()` callback on every successful login (local or LDAP). */
export async function stampLastLogin(userId: string): Promise<void> {
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
}

/** Validate `language` with `updateLanguageSchema` (packages/core/src/validation/user.zod.ts) before calling this - this function trusts its input, matching every other *-service.ts in this package. */
export async function updateUserLanguage(userId: string, language: string): Promise<User> {
  const [updated] = await db.update(users).set({ language }).where(eq(users.id, userId)).returning();
  if (!updated) throw new Error(`User ${userId} not found`);
  return updated;
}

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

export async function listUsers(): Promise<User[]> {
  return db.select().from(users).orderBy(users.displayName);
}

/** Called from the Auth.js `authorize()` callback on every successful login (local or LDAP). */
export async function stampLastLogin(userId: string): Promise<void> {
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
}

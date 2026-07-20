import { createHash, randomBytes } from "node:crypto";
import { db, passwordResetTokens, users, type User } from "@itsm/db";
import { and, eq, gt, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { SALT_ROUNDS } from "../constants";

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Issues a new reset token for `userId` and returns the RAW token - only ever available here, in plaintext, for embedding in the email link. The DB only ever stores its hash. */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const rawToken = randomBytes(TOKEN_BYTES).toString("hex");
  await db.insert(passwordResetTokens).values({
    userId,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });
  return rawToken;
}

/** Looks up a still-valid (unused, unexpired) token by its raw value without exposing whether a *different* reason (expired vs. already used vs. never existed) caused the miss - callers should treat any null the same way. */
async function findValidToken(rawToken: string) {
  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(eq(passwordResetTokens.tokenHash, hashToken(rawToken)), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, new Date())),
    );
  return row;
}

export async function isPasswordResetTokenValid(rawToken: string): Promise<boolean> {
  return Boolean(await findValidToken(rawToken));
}

/** Consumes the token (marks it used, so it can never be replayed) and updates the user's password hash in the same operation. Returns the updated user, or null if the token was invalid/expired/already used. */
export async function consumePasswordResetToken(rawToken: string, newPassword: string): Promise<User | null> {
  const token = await findValidToken(rawToken);
  if (!token) return null;

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const [updated] = await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, token.userId)).returning();
  if (!updated) return null;

  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, token.id));
  return updated;
}

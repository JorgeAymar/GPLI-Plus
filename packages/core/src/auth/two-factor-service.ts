import { createHash, randomInt } from "node:crypto";
import { db, loginTwoFactorCodes } from "@itsm/db";
import { and, eq, isNull } from "drizzle-orm";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

function hashCode(rawCode: string): string {
  return createHash("sha256").update(rawCode).digest("hex");
}

function generateCode(): string {
  return String(randomInt(0, 10000)).padStart(4, "0");
}

/**
 * Issues a fresh 4-digit login code for `userId` and returns it RAW (only
 * ever available here, in plaintext, to be emailed immediately). Any prior
 * unused code for this user is invalidated first, so only the most recently
 * requested code can ever succeed - keeps the attack surface to a single
 * active code instead of accumulating several a guesser could try.
 */
export async function createLoginCode(userId: string): Promise<string> {
  await db
    .update(loginTwoFactorCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(loginTwoFactorCodes.userId, userId), isNull(loginTwoFactorCodes.usedAt)));

  const rawCode = generateCode();
  await db.insert(loginTwoFactorCodes).values({
    userId,
    codeHash: hashCode(rawCode),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });
  return rawCode;
}

/**
 * Checks `rawCode` against the user's current active code. A wrong guess
 * increments `attempts` (not deleted - so retries against the same code
 * stay counted) and, once MAX_ATTEMPTS is reached, the code stops being
 * usable at all even with the right digits, since the low entropy of a
 * 4-digit code means brute force is what actually needs stopping here.
 */
export async function verifyLoginCode(userId: string, rawCode: string): Promise<boolean> {
  const [record] = await db
    .select()
    .from(loginTwoFactorCodes)
    .where(and(eq(loginTwoFactorCodes.userId, userId), isNull(loginTwoFactorCodes.usedAt)));

  if (!record) return false;
  if (record.expiresAt.getTime() < Date.now()) return false;
  if (record.attempts >= MAX_ATTEMPTS) return false;

  if (record.codeHash !== hashCode(rawCode)) {
    await db
      .update(loginTwoFactorCodes)
      .set({ attempts: record.attempts + 1 })
      .where(eq(loginTwoFactorCodes.id, record.id));
    return false;
  }

  await db.update(loginTwoFactorCodes).set({ usedAt: new Date() }).where(eq(loginTwoFactorCodes.id, record.id));
  return true;
}

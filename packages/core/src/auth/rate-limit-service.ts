import { db, loginAttempts } from "@itsm/db";
import { and, eq, gt, sql } from "drizzle-orm";

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;

/**
 * Keyed by the submitted email, not a user id - a brute-force attempt
 * against a nonexistent email must still be counted, otherwise an attacker
 * just probes random addresses to dodge the limiter entirely. Only failed
 * attempts count toward the limit; a successful login doesn't reset the
 * window early (an attacker who eventually guesses right on attempt 4
 * shouldn't get a fresh set of 5 tries against the *next* account they try
 * from the same script run - this key is per-email anyway, so that's a
 * narrow concern, but keeping the logic simple: count only failures, over a
 * fixed rolling window).
 */
export async function isLoginRateLimited(email: string): Promise<boolean> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.email, email), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, new Date(Date.now() - WINDOW_MS))));
  return (row?.count ?? 0) >= MAX_FAILED_ATTEMPTS;
}

export async function recordLoginAttempt(email: string, success: boolean): Promise<void> {
  await db.insert(loginAttempts).values({ email, success });
}

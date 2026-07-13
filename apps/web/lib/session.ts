import { type AuthContext, resolveAuthContext } from "@itsm/core";
import { cache } from "react";
import { auth } from "./auth";

/**
 * Request-memoized auth context (user + active entity + active profile).
 * Hits the DB once per request no matter how many Server Components call it.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const session = await auth();
  if (!session?.userId) return null;

  return resolveAuthContext({
    userId: session.userId,
    activeEntityId: session.activeEntityId,
    activeProfileId: session.activeProfileId,
  });
});

export async function requireAuthContext(): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) {
    throw new Error("No active session");
  }
  return context;
}

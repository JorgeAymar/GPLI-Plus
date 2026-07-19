import { type AuthContext, resolveAuthContext } from "@itsm/core";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getSession } from "./auth";

/**
 * Request-memoized auth context (user + active entity + active profile).
 * Hits the DB once per request no matter how many Server Components call it.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const session = await getSession();
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
    // A syntactically valid session (proxy.ts already checked req.auth.userId) can still
    // fail to resolve here - e.g. the user row was deleted/deactivated after the JWT was
    // issued. Redirect like proxy.ts does instead of crashing the render with a 500.
    redirect("/login");
  }
  return context;
}

import { NextResponse } from "next/server";
import { isActiveUserId } from "@itsm/core";
import { auth } from "@/lib/auth";

// Proxy (formerly "middleware") always runs on the Node.js runtime in
// Next.js 16 - required anyway since lib/auth.ts imports the Drizzle/pg
// adapter at module scope, which is not edge-compatible.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

export default auth(async (req) => {
  const session = req.auth;
  // A syntactically valid JWT (has userId) can still be orphaned - the user row
  // behind it may have been deleted or deactivated after the token was issued.
  // Checking that here (not just !!session) is what keeps this in sync with
  // lib/session.ts; treating a merely-decoded JWT as "logged in" let an orphaned
  // session get bounced forever between "/", "/dashboard" (no context -
  // redirected here) and "/login" (proxy thought it was logged in). Use the
  // cheap single-row lookup, not the full resolveAuthContext (user+entity+
  // profile, several queries) that lib/session.ts already does per request -
  // this runs on every request the matcher below allows through, including
  // every Server Action POST, so it needs to stay a single indexed read.
  const isLoggedIn = session?.userId ? await isActiveUserId(session.userId) : false;
  // Every route under (auth)/ - reachable without a session by design (that's
  // the whole point of a password-recovery flow), same treatment as /login.
  const isPublicAuthRoute =
    req.nextUrl.pathname.startsWith("/login") ||
    req.nextUrl.pathname.startsWith("/forgot-password") ||
    req.nextUrl.pathname.startsWith("/reset-password");

  if (!isLoggedIn && !isPublicAuthRoute) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isPublicAuthRoute) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
});

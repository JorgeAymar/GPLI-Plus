import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Proxy (formerly "middleware") always runs on the Node.js runtime in
// Next.js 16 - required anyway since lib/auth.ts imports the Drizzle/pg
// adapter at module scope, which is not edge-compatible.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginRoute = req.nextUrl.pathname.startsWith("/login");

  if (!isLoggedIn && !isLoginRoute) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isLoginRoute) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
});

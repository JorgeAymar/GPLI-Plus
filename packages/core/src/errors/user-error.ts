/**
 * An error whose message is meant to be shown to the end user (validation failures,
 * permission denials, business-rule conflicts like an overlapping reservation).
 *
 * Why the `digest`: in production builds Next.js/React redact the message of any error
 * thrown from a Server Action or Server Component before it reaches the browser - the
 * client only receives a generic "Minified React error #441" plus `error.digest`. Next
 * keeps a digest that an error already carries instead of replacing it with a hash, so
 * stamping the message into the digest (behind a prefix) is the supported way to let
 * *intentional* messages through. Anything not thrown as a UserError (DB/driver errors,
 * crashes) keeps its hashed digest and stays redacted - no SQL or internals leak.
 *
 * This file must stay dependency-free: client components import it (via
 * apps/web/lib/action-error.ts) to decode the digest.
 */
export const USER_ERROR_DIGEST_PREFIX = "USER_ERROR:";

export class UserError extends Error {
  readonly digest: string;

  constructor(message: string) {
    super(message);
    this.name = "UserError";
    this.digest = `${USER_ERROR_DIGEST_PREFIX}${message}`;
  }
}

/** The user-facing message carried by a UserError's digest, or null if `err` isn't one. */
export function userErrorMessageFromDigest(err: unknown): string | null {
  if (typeof err !== "object" || err === null || !("digest" in err)) return null;
  const digest = (err as { digest: unknown }).digest;
  if (typeof digest !== "string" || !digest.startsWith(USER_ERROR_DIGEST_PREFIX)) return null;
  return digest.slice(USER_ERROR_DIGEST_PREFIX.length);
}

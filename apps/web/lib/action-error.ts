import { userErrorMessageFromDigest } from "@itsm/core/src/errors/user-error";

export const UNEXPECTED_ERROR_MESSAGE = "Ocurrió un error inesperado. Intentá de nuevo.";

/**
 * The message to show for an error caught around a Server Action call.
 *
 * - UserError thrown on the server -> its real message (carried in the digest, so it
 *   survives production redaction - see packages/core/src/errors/user-error.ts).
 * - Any other server error -> it has a (hashed) digest and its message is React's
 *   redacted placeholder in production, so show a generic message instead of
 *   "Minified React error #441".
 * - Errors raised in the browser itself (no digest) -> their own message.
 */
export function actionErrorMessage(err: unknown): string {
  const userMessage = userErrorMessageFromDigest(err);
  if (userMessage !== null) return userMessage;
  if (!(err instanceof Error)) return UNEXPECTED_ERROR_MESSAGE;
  if ("digest" in err && process.env.NODE_ENV === "production") return UNEXPECTED_ERROR_MESSAGE;
  return err.message || UNEXPECTED_ERROR_MESSAGE;
}

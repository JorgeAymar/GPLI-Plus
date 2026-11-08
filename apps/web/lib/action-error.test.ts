import { afterEach, describe, expect, it, vi } from "vitest";
import { UserError } from "@itsm/core/src/errors/user-error";
import { actionErrorMessage, UNEXPECTED_ERROR_MESSAGE } from "./action-error";

/** What the browser receives in production for a server error: React's placeholder message + the digest. */
function redacted(digest: string): Error {
  const err = new Error("Minified React error #441; visit https://react.dev/errors/441");
  return Object.assign(err, { digest });
}

describe("actionErrorMessage", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("recovers a UserError's message from its digest after production redaction", () => {
    vi.stubEnv("NODE_ENV", "production");
    const original = new UserError("Conflicto de horario: el recurso ya está reservado");
    expect(actionErrorMessage(redacted(original.digest))).toBe("Conflicto de horario: el recurso ya está reservado");
  });

  it("shows a generic message - never React's placeholder - for other server errors in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(actionErrorMessage(redacted("2938475610"))).toBe(UNEXPECTED_ERROR_MESSAGE);
  });

  it("keeps the real message of errors raised in the browser (no digest)", () => {
    expect(actionErrorMessage(new Error("Sin conexión"))).toBe("Sin conexión");
  });

  it("falls back to the generic message for non-Error values", () => {
    expect(actionErrorMessage("boom")).toBe(UNEXPECTED_ERROR_MESSAGE);
    expect(actionErrorMessage(undefined)).toBe(UNEXPECTED_ERROR_MESSAGE);
  });
});

import { describe, expect, it } from "vitest";
import { ForbiddenError } from "../auth/permissions";
import { USER_ERROR_DIGEST_PREFIX, UserError, userErrorMessageFromDigest } from "./user-error";

describe("UserError", () => {
  it("is a real Error carrying its message in a prefixed digest", () => {
    const err = new UserError("Ya existe una categoría con esa clave (key).");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Ya existe una categoría con esa clave (key).");
    expect(err.digest).toBe(`${USER_ERROR_DIGEST_PREFIX}Ya existe una categoría con esa clave (key).`);
    expect(userErrorMessageFromDigest(err)).toBe(err.message);
  });

  it("ForbiddenError is a UserError, so permission denials reach the user", () => {
    const err = new ForbiddenError("administration.entity", 2);
    expect(err).toBeInstanceOf(UserError);
    expect(err.name).toBe("ForbiddenError");
    expect(userErrorMessageFromDigest(err)).toBe('Missing permission (mask 2) for module "administration.entity"');
  });

  it("ignores errors whose digest is not a UserError digest", () => {
    expect(userErrorMessageFromDigest(Object.assign(new Error("x"), { digest: "123456" }))).toBeNull();
    expect(userErrorMessageFromDigest(new Error("x"))).toBeNull();
    expect(userErrorMessageFromDigest(null)).toBeNull();
  });
});

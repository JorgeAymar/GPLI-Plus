import { getEffectiveRights } from "../rbac/profile-service";
import type { AuthContext } from "./get-auth-context";

/** Bitmask rights, stored on profile_module_rights.rights. */
export const RIGHT = {
  READ: 1 << 0,
  CREATE: 1 << 1,
  UPDATE: 1 << 2,
  DELETE: 1 << 3,
  PURGE: 1 << 4,
  APPROVE: 1 << 5,
  ASSIGN: 1 << 6,
} as const;

export type RightBit = (typeof RIGHT)[keyof typeof RIGHT];

export function hasRight(rights: number, required: number): boolean {
  return (rights & required) === required;
}

export class ForbiddenError extends Error {
  constructor(moduleKey: string, required: number) {
    super(`Missing permission (mask ${required}) for module "${moduleKey}"`);
    this.name = "ForbiddenError";
  }
}

/** Throws ForbiddenError if the context's active user+entity lacks `required` on `moduleKey`. */
export async function requireRight(context: AuthContext, moduleKey: string, required: number): Promise<void> {
  const rights = await getEffectiveRights(context.user.id, context.activeEntity.id, moduleKey);
  if (!hasRight(rights, required)) {
    throw new ForbiddenError(moduleKey, required);
  }
}

/**
 * Like `requireRight`, but checks `entityId` (e.g. an existing record's own entity) instead
 * of the caller's currently-active entity. `requireRight` alone only proves the caller has
 * `required` *wherever they're currently standing* (`context.activeEntity.id`) - for an
 * update/delete/assign on a specific existing record, that's the wrong entity to check: a
 * caller with UPDATE in their own entity could otherwise write to a record that lives in a
 * different entity they were never assigned to. Use this whenever the acting right needs to
 * cover a specific record, not the caller's current context.
 */
export async function requireRightOnEntity(context: AuthContext, moduleKey: string, required: number, entityId: string): Promise<void> {
  const rights = await getEffectiveRights(context.user.id, entityId, moduleKey);
  if (!hasRight(rights, required)) {
    throw new ForbiddenError(moduleKey, required);
  }
}

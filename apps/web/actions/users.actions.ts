"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, createUser, createUserSchema, recordAuditLog, requireRight } from "@itsm/core";
import type { User } from "@itsm/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * `schema.parse()` throws a `ZodError` whose `.message` getter is a JSON blob
 * (see zod's ZodError#message), not a human-readable string - e.g. the
 * `username` field's regex constraint (createUserSchema) has no client-side
 * `pattern` attribute on user-form.tsx's <input>, so a value with disallowed
 * characters reaches this action and would otherwise surface as unreadable
 * JSON in the form's error paragraph. Use `.safeParse` instead and rethrow a
 * clean message - same pattern already used throughout
 * apps/web/actions/{dropdowns,api-clients,...}.actions.ts.
 */
function parseInput<Schema extends z.ZodTypeAny>(schema: Schema, input: unknown): z.infer<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues.map((issue) => issue.message).join("; "));
  }
  return result.data;
}

export interface CreateUserResult {
  user?: User;
  error?: string;
}

/**
 * Returns `{error}` instead of throwing on a validation/uniqueness failure.
 * Next.js redacts the message of anything a Server Action *throws* across
 * the client/server boundary in production builds (by design - it can't
 * tell a deliberately safe message from an accidental one), replacing it
 * with a generic "an error occurred" string. That silently ate this
 * function's own careful "Ya existe un usuario con este email." message in
 * production even though it worked perfectly in dev. Returning the error as
 * plain data sidesteps that redaction entirely, matching how loginAction/
 * resetPasswordAction already do this in apps/web/actions/auth.actions.ts.
 */
export async function createUserAction(input: {
  email: string;
  username: string;
  password: string;
  displayName: string;
  defaultEntityId?: string | null;
}): Promise<CreateUserResult> {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ADMINISTRATION_USER, RIGHT.CREATE);

  let user: User;
  try {
    const parsed = parseInput(createUserSchema, input);
    user = await createUser(parsed);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo crear el usuario." };
  }

  // NOTE: never persist passwordHash into the audit trail - "Ver cambios" on
  // /administration/audit-log renders `after` as raw JSON to any admin with READ
  // on administration.audit_log, which would otherwise leak password hashes.
  const { passwordHash: _passwordHash, ...safeUser } = user;
  await recordAuditLog({
    entityId: user.defaultEntityId ?? context.activeEntity.id,
    actorUserId: context.user.id,
    action: "create",
    objectType: "user",
    objectId: user.id,
    after: safeUser,
  });
  revalidatePath("/administration/users");
  return { user };
}

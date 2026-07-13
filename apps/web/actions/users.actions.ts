"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, createUser, createUserSchema, recordAuditLog, requireRight } from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createUserAction(input: {
  email: string;
  username: string;
  password: string;
  displayName: string;
  defaultEntityId?: string | null;
}) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ADMINISTRATION_USER, RIGHT.CREATE);
  const parsed = createUserSchema.parse(input);
  const user = await createUser(parsed);
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
  return user;
}

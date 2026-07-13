"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, createUser, createUserSchema, requireRight } from "@itsm/core";
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
  revalidatePath("/administration/users");
  return user;
}

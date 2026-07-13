"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, createLdapAuthSource, createLdapAuthSourceSchema, requireRight } from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createLdapAuthSourceAction(input: {
  name: string;
  host: string;
  port?: number;
  baseDn: string;
  bindDn: string;
  bindPasswordEncrypted: string;
  loginField?: string;
  syncField: string;
  groupField?: string | null;
  useTls?: boolean;
  isActive?: boolean;
}) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ADMINISTRATION_AUTH_SOURCE, RIGHT.CREATE);
  const parsed = createLdapAuthSourceSchema.parse(input);
  const source = await createLdapAuthSource(parsed);
  revalidatePath("/setup/auth-sources");
  return source;
}

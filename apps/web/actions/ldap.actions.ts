"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, createLdapAuthSource, createLdapAuthSourceSchema, requireRight } from "@itsm/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * `schema.parse()` throws a `ZodError` whose `.message` getter is a JSON blob
 * (see zod's ZodError#message), not a human-readable string. Every setup form
 * surfaces server-action errors via `err.message`, so parsing this way turns
 * validation failures into unreadable JSON dumped in the UI. Use `.safeParse`
 * instead and rethrow a clean, semicolon-joined message.
 */
function parseInput<Schema extends z.ZodTypeAny>(schema: Schema, input: unknown): z.infer<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues.map((issue) => issue.message).join("; "));
  }
  return result.data;
}

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
  const parsed = parseInput(createLdapAuthSourceSchema, input);
  const source = await createLdapAuthSource(parsed);
  revalidatePath("/setup/auth-sources");
  return source;
}

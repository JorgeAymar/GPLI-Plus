"use server";

import { unstable_update } from "@/lib/auth";
import { requireAuthContext } from "@/lib/session";
import {
  createPersonalApiClient,
  createPersonalApiClientSchema,
  listMyApiClients,
  revokeMyApiClient,
  updateLanguageSchema,
  updateUserLanguage,
} from "@itsm/core";
import type { ApiClient, User } from "@itsm/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * `schema.parse()` throws a `ZodError` whose `.message` getter is a JSON blob
 * (see zod's ZodError#message), not a human-readable string - same reasoning
 * as the identical helper in apps/web/actions/api-clients.actions.ts. Use
 * `.safeParse` and rethrow a clean, semicolon-joined message so forms can
 * surface `err.message` directly.
 */
function parseInput<Schema extends z.ZodTypeAny>(schema: Schema, input: unknown): z.infer<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues.map((issue) => issue.message).join("; "));
  }
  return result.data;
}

export async function listMyApiClientsAction(): Promise<ApiClient[]> {
  const context = await requireAuthContext();
  return listMyApiClients(context.user.id);
}

/**
 * Returns `rawKey` alongside the created client so the page can show it once
 * (see createPersonalApiClient's doc comment - it is never recoverable after
 * this call). No `requireRight` check: creating your own personal token is
 * self-service, not an RBAC-gated action - any authenticated user manages
 * their own MCP access.
 */
export async function createMyApiClientAction(input: unknown): Promise<{ client: ApiClient; rawKey: string }> {
  const context = await requireAuthContext();
  const parsed = parseInput(createPersonalApiClientSchema, input);
  const result = await createPersonalApiClient({ userId: context.user.id, name: parsed.name });
  revalidatePath("/account");
  return result;
}

export async function revokeMyApiClientAction(id: string): Promise<ApiClient> {
  const context = await requireAuthContext();
  const client = await revokeMyApiClient(id, context.user.id);
  revalidatePath("/account");
  return client;
}

export async function updateMyLanguageAction(input: unknown): Promise<User> {
  const context = await requireAuthContext();
  const parsed = parseInput(updateLanguageSchema, input);
  const user = await updateUserLanguage(context.user.id, parsed.language);
  await unstable_update({ language: parsed.language });
  revalidatePath("/account");
  return user;
}

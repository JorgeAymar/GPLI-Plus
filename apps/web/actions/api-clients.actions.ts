"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, createApiClient, createApiClientSchema, requireRight, revokeApiClient } from "@itsm/core";
import type { ApiClient } from "@itsm/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * `schema.parse()` throws a `ZodError` whose `.message` getter is a JSON blob
 * (see zod's ZodError#message), not a human-readable string. Every setup form
 * surfaces server-action errors via `err.message`, so parsing this way turns
 * validation failures into unreadable JSON dumped in the UI (e.g. submitting
 * the API client form with zero scopes checked). Use `.safeParse` instead and
 * rethrow a clean, semicolon-joined message.
 */
function parseInput<Schema extends z.ZodTypeAny>(schema: Schema, input: unknown): z.infer<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues.map((issue) => issue.message).join("; "));
  }
  return result.data;
}

/**
 * Returns `rawKey` alongside the created client so the page can show it once
 * (see api-client-service.ts::createApiClient - it is never recoverable
 * after this call).
 */
export async function createApiClientAction(input: unknown): Promise<{ client: ApiClient; rawKey: string }> {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ADVANCED_API, RIGHT.CREATE);
  const parsed = parseInput(createApiClientSchema, input);
  const result = await createApiClient(parsed);
  revalidatePath("/setup/api-clients");
  return result;
}

export async function revokeApiClientAction(id: string): Promise<ApiClient> {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ADVANCED_API, RIGHT.DELETE);
  const client = await revokeApiClient(id);
  revalidatePath("/setup/api-clients");
  return client;
}

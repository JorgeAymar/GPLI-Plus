"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, createApiClient, createApiClientSchema, requireRight, revokeApiClient } from "@itsm/core";
import type { ApiClient } from "@itsm/db";
import { revalidatePath } from "next/cache";

/**
 * Returns `rawKey` alongside the created client so the page can show it once
 * (see api-client-service.ts::createApiClient - it is never recoverable
 * after this call).
 */
export async function createApiClientAction(input: unknown): Promise<{ client: ApiClient; rawKey: string }> {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.ADVANCED_API, RIGHT.CREATE);
  const parsed = createApiClientSchema.parse(input);
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

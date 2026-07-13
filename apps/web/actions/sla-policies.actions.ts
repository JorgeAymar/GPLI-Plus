"use server";

import { requireAuthContext } from "@/lib/session";
import { MODULE, RIGHT, createSlaPolicy, createSlaPolicySchema, requireRight } from "@itsm/core";
import { revalidatePath } from "next/cache";

export async function createSlaPolicyAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.SETUP_SLA_POLICY, RIGHT.CREATE);
  const parsed = createSlaPolicySchema.parse(input);
  const policy = await createSlaPolicy(parsed);
  revalidatePath("/setup/sla-policies");
  return policy;
}

"use server";

import { requireAuthContext } from "@/lib/session";
import {
  MODULE,
  RIGHT,
  cancelReservation,
  createReservation,
  createReservationItem,
  createReservationItemSchema,
  createReservationSchema,
  requireRight,
} from "@itsm/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * `schema.parse()` throws a `ZodError` whose `.message` getter is a JSON blob
 * (see zod's ZodError#message), not a human-readable string. Both forms in this
 * module surface server-action errors via `err.message`, so parsing this way
 * turns validation failures (e.g. createReservationSchema's own endAt > beginAt
 * `.refine()`, which the browser has no native way to enforce across two
 * independent datetime-local inputs) into unreadable JSON dumped in the UI. Use
 * `.safeParse` instead and rethrow a clean message - same pattern already used
 * throughout apps/web/actions/{dropdowns,api-clients,...}.actions.ts.
 */
function parseInput<Schema extends z.ZodTypeAny>(schema: Schema, input: unknown): z.infer<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues.map((issue) => issue.message).join("; "));
  }
  return result.data;
}

export async function createReservationItemAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.TOOLS_RESERVATION, RIGHT.CREATE);
  const parsed = parseInput(createReservationItemSchema, input);
  const item = await createReservationItem(parsed);
  revalidatePath("/tools/reservations");
  return item;
}

export async function createReservationAction(input: unknown) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.TOOLS_RESERVATION, RIGHT.CREATE);
  // requestedByUserId always comes from the authenticated session, never from
  // client-submitted form data, so a reservation can't be attributed to another user.
  const parsed = parseInput(createReservationSchema, {
    ...(input as Record<string, unknown>),
    requestedByUserId: context.user.id,
  });
  // createReservation() throws a plain business-rule Error on a schedule conflict.
  // It must NOT be caught/rewrapped here - the client form needs the real message
  // ("Conflicto de horario: ...") instead of a generic failure.
  const reservation = await createReservation(parsed);
  revalidatePath(`/tools/reservations/${parsed.reservationItemId}`);
  return reservation;
}

export async function cancelReservationAction(id: string, reservationItemId: string) {
  const context = await requireAuthContext();
  await requireRight(context, MODULE.TOOLS_RESERVATION, RIGHT.DELETE);
  await cancelReservation(id);
  revalidatePath(`/tools/reservations/${reservationItemId}`);
}

import { db, reminders, type Reminder, type VisibilityGranteeKind } from "@itsm/db";
import { eq, inArray } from "drizzle-orm";
import type { AuthContext } from "../auth/get-auth-context";
import { listSubtree } from "../entities/entity-service";
import { addVisibilityRule, isResourceVisibleTo } from "../visibility/visibility-service";

export async function createReminder(input: {
  ownerUserId: string;
  entityId: string;
  title: string;
  content?: string | null;
  remindAt?: Date | null;
}): Promise<Reminder> {
  const [created] = await db
    .insert(reminders)
    .values({
      ownerUserId: input.ownerUserId,
      entityId: input.entityId,
      title: input.title,
      content: input.content ?? null,
      remindAt: input.remindAt ?? null,
    })
    .returning();
  if (!created) throw new Error("Failed to insert reminder");
  return created;
}

export async function getReminder(id: string): Promise<Reminder | undefined> {
  const [reminder] = await db.select().from(reminders).where(eq(reminders.id, id));
  return reminder;
}

/**
 * Candidates are scoped to the active entity's subtree (same pattern as
 * listKbArticles in kb-service.ts), then narrowed down to only the ones the
 * caller can actually see via isResourceVisibleTo (per-row check, reusing the
 * shared visibility-service instead of a bespoke permission join).
 */
export async function listRemindersVisibleTo(context: AuthContext): Promise<Reminder[]> {
  const entityIds = (await listSubtree(context.activeEntity.id)).map((e) => e.id);

  const candidates = await db
    .select()
    .from(reminders)
    .where(inArray(reminders.entityId, entityIds))
    .orderBy(reminders.remindAt);

  const visible: Reminder[] = [];
  for (const reminder of candidates) {
    if (await isResourceVisibleTo("reminder", reminder.id, reminder.ownerUserId, context)) {
      visible.push(reminder);
    }
  }
  return visible;
}

export async function markReminderDone(id: string): Promise<Reminder> {
  const [updated] = await db
    .update(reminders)
    .set({ isDone: true, updatedAt: new Date() })
    .where(eq(reminders.id, id))
    .returning();
  if (!updated) throw new Error(`Failed to update reminder ${id}`);
  return updated;
}

/** Thin wrapper over the shared visibility-service - reminders have no dedicated "reminder_shares" table, see visibility.ts. */
export async function shareReminder(
  id: string,
  granteeKind: VisibilityGranteeKind,
  granteeId: string,
  isRecursive?: boolean,
) {
  return addVisibilityRule({
    resourceType: "reminder",
    resourceId: id,
    granteeKind,
    granteeId,
    isRecursive,
  });
}

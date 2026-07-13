import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, reminders, resourceVisibilityRules, type Entity, type Profile, type User } from "@itsm/db";
import {
  buildAuthContext,
  createTestEntity,
  createTestProfile,
  createTestUser,
  deleteTestEntities,
  deleteTestProfiles,
  deleteTestUsers,
} from "../__vitest_tools__/fixtures";
import { createReminder, getReminder, listRemindersVisibleTo, markReminderDone, shareReminder } from "./reminder-service";

describe("reminder-service", () => {
  let owner: User;
  let otherUser: User;
  let profile: Profile;
  let entity: Entity;
  let childEntity: Entity;

  const userIds: string[] = [];
  const profileIds: string[] = [];
  const entityIds: string[] = [];
  const reminderIds: string[] = [];

  beforeAll(async () => {
    owner = await createTestUser();
    otherUser = await createTestUser();
    userIds.push(owner.id, otherUser.id);
    profile = await createTestProfile();
    profileIds.push(profile.id);
    entity = await createTestEntity();
    childEntity = await createTestEntity({ parentId: entity.id });
    entityIds.push(entity.id, childEntity.id);
  });

  afterAll(async () => {
    for (const id of reminderIds) {
      await db.delete(resourceVisibilityRules).where(eq(resourceVisibilityRules.resourceId, id));
    }
    for (const id of reminderIds) {
      await db.delete(reminders).where(eq(reminders.id, id));
    }
    await deleteTestProfiles(profileIds);
    await deleteTestUsers(userIds);
    await deleteTestEntities(entityIds);
  });

  async function makeReminder(overrides?: Partial<Parameters<typeof createReminder>[0]>) {
    const reminder = await createReminder({
      ownerUserId: owner.id,
      entityId: entity.id,
      title: `__vitest_tools__ reminder ${crypto.randomUUID().slice(0, 8)}`,
      ...overrides,
    });
    reminderIds.push(reminder.id);
    return reminder;
  }

  it("createReminder + getReminder roundtrip", async () => {
    const reminder = await makeReminder({ content: "do the thing" });
    const fetched = await getReminder(reminder.id);
    expect(fetched?.content).toBe("do the thing");
    expect(fetched?.isDone).toBe(false);
  });

  it("a private reminder is invisible to another user until explicitly shared, then becomes visible", async () => {
    const reminder = await makeReminder();

    const ownerContext = buildAuthContext(owner, entity, profile);
    const otherContext = buildAuthContext(otherUser, entity, profile);

    const ownVisible = await listRemindersVisibleTo(ownerContext);
    expect(ownVisible.map((r) => r.id)).toContain(reminder.id);

    const beforeShare = await listRemindersVisibleTo(otherContext);
    expect(beforeShare.map((r) => r.id)).not.toContain(reminder.id);

    await shareReminder(reminder.id, "user", otherUser.id);

    const afterShare = await listRemindersVisibleTo(otherContext);
    expect(afterShare.map((r) => r.id)).toContain(reminder.id);
  });

  it("listRemindersVisibleTo scopes candidates to the active entity's subtree", async () => {
    const reminderInChild = await makeReminder({ entityId: childEntity.id });

    const otherContext = buildAuthContext(otherUser, entity, profile);
    // Not shared at all yet, but even once shared, it must first pass the entity-subtree candidate filter.
    await shareReminder(reminderInChild.id, "user", otherUser.id);
    const visibleFromParent = await listRemindersVisibleTo(otherContext);
    expect(visibleFromParent.map((r) => r.id)).toContain(reminderInChild.id);

    const unrelatedEntity = await createTestEntity();
    entityIds.push(unrelatedEntity.id);
    const contextElsewhere = buildAuthContext(otherUser, unrelatedEntity, profile);
    const visibleElsewhere = await listRemindersVisibleTo(contextElsewhere);
    expect(visibleElsewhere.map((r) => r.id)).not.toContain(reminderInChild.id);
  });

  it("markReminderDone flips isDone to true", async () => {
    const reminder = await makeReminder();
    const updated = await markReminderDone(reminder.id);
    expect(updated.isDone).toBe(true);
  });
});

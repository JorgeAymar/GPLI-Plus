import { describe, expect, it } from "vitest";
import { createReminderSchema } from "./reminder.zod";

describe("reminder.zod createReminderSchema", () => {
  it("accepts a minimal valid reminder", () => {
    const result = createReminderSchema.safeParse({ entityId: crypto.randomUUID(), title: "Follow up" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing title", () => {
    const result = createReminderSchema.safeParse({ entityId: crypto.randomUUID() });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid entityId", () => {
    const result = createReminderSchema.safeParse({ entityId: "not-a-uuid", title: "Follow up" });
    expect(result.success).toBe(false);
  });

  it("coerces a string remindAt into a Date", () => {
    const result = createReminderSchema.safeParse({
      entityId: crypto.randomUUID(),
      title: "Follow up",
      remindAt: "2027-01-01T00:00:00Z",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.remindAt).toBeInstanceOf(Date);
  });

  it("accepts an explicit null remindAt", () => {
    const result = createReminderSchema.safeParse({ entityId: crypto.randomUUID(), title: "Follow up", remindAt: null });
    expect(result.success).toBe(true);
  });
});

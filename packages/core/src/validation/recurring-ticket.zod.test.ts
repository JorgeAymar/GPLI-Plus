import { describe, expect, it } from "vitest";
import { createRecurringTicketTemplateSchema } from "./recurring-ticket.zod";

const validUuid = "11111111-1111-1111-1111-111111111111";

describe("recurring-ticket.zod", () => {
  it("accepts a minimal valid payload", () => {
    const result = createRecurringTicketTemplateSchema.safeParse({
      entityId: validUuid,
      name: "Weekly backup check",
      titleTemplate: "Revisar backup",
      contentTemplate: "Verificar backup",
      requesterUserId: validUuid,
      intervalMinutes: 60,
    });
    expect(result.success).toBe(true);
  });

  it("rejects intervalMinutes below 1 or non-integer", () => {
    const base = {
      entityId: validUuid,
      name: "n",
      titleTemplate: "t",
      contentTemplate: "c",
      requesterUserId: validUuid,
    };
    expect(createRecurringTicketTemplateSchema.safeParse({ ...base, intervalMinutes: 0 }).success).toBe(false);
    expect(createRecurringTicketTemplateSchema.safeParse({ ...base, intervalMinutes: -5 }).success).toBe(false);
    expect(createRecurringTicketTemplateSchema.safeParse({ ...base, intervalMinutes: 1.5 }).success).toBe(false);
  });

  it("rejects a non-uuid requesterUserId", () => {
    expect(
      createRecurringTicketTemplateSchema.safeParse({
        entityId: validUuid,
        name: "n",
        titleTemplate: "t",
        contentTemplate: "c",
        requesterUserId: "not-a-uuid",
        intervalMinutes: 10,
      }).success,
    ).toBe(false);
  });

  it("defaults ticketType to being optional, restricted to incident/request", () => {
    const base = {
      entityId: validUuid,
      name: "n",
      titleTemplate: "t",
      contentTemplate: "c",
      requesterUserId: validUuid,
      intervalMinutes: 10,
    };
    expect(createRecurringTicketTemplateSchema.safeParse(base).success).toBe(true);
    expect(createRecurringTicketTemplateSchema.safeParse({ ...base, ticketType: "request" }).success).toBe(true);
    expect(createRecurringTicketTemplateSchema.safeParse({ ...base, ticketType: "problem" }).success).toBe(false);
  });
});

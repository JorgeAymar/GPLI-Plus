import { describe, expect, it } from "vitest";
import {
  createProjectCostSchema,
  createProjectSchema,
  createProjectTaskLinkSchema,
  createProjectTaskSchema,
  createProjectTeamMemberSchema,
  updateProjectSchema,
} from "./project.zod";

describe("project.zod", () => {
  describe("createProjectSchema", () => {
    const base = { entityId: crypto.randomUUID(), name: "Migration project" };

    it("accepts a minimal valid project", () => {
      expect(createProjectSchema.safeParse(base).success).toBe(true);
    });

    it("rejects priority outside [1, 5]", () => {
      expect(createProjectSchema.safeParse({ ...base, priority: 0 }).success).toBe(false);
      expect(createProjectSchema.safeParse({ ...base, priority: 6 }).success).toBe(false);
      expect(createProjectSchema.safeParse({ ...base, priority: 5 }).success).toBe(true);
    });

    it("rejects percentDone outside [0, 100]", () => {
      expect(createProjectSchema.safeParse({ ...base, percentDone: -1 }).success).toBe(false);
      expect(createProjectSchema.safeParse({ ...base, percentDone: 101 }).success).toBe(false);
      expect(createProjectSchema.safeParse({ ...base, percentDone: 100 }).success).toBe(true);
    });

    it("rejects an empty name", () => {
      expect(createProjectSchema.safeParse({ ...base, name: "" }).success).toBe(false);
    });
  });

  describe("updateProjectSchema", () => {
    it("omits entityId (immutable via update) and makes every field optional", () => {
      const result = updateProjectSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("still enforces field-level constraints when a field is provided", () => {
      const result = updateProjectSchema.safeParse({ percentDone: 200 });
      expect(result.success).toBe(false);
    });
  });

  describe("createProjectTaskSchema", () => {
    it("rejects a negative plannedDurationMinutes", () => {
      const result = createProjectTaskSchema.safeParse({ projectId: crypto.randomUUID(), name: "Task", plannedDurationMinutes: -1 });
      expect(result.success).toBe(false);
    });
  });

  describe("createProjectTaskLinkSchema", () => {
    it("rejects an invalid linkType", () => {
      const result = createProjectTaskLinkSchema.safeParse({
        sourceTaskId: crypto.randomUUID(),
        targetTaskId: crypto.randomUUID(),
        linkType: "bogus",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createProjectTeamMemberSchema", () => {
    it("rejects an invalid memberKind", () => {
      const result = createProjectTeamMemberSchema.safeParse({
        projectId: crypto.randomUUID(),
        memberKind: "robot",
        memberId: crypto.randomUUID(),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createProjectCostSchema", () => {
    it("rejects a negative amountCents", () => {
      const result = createProjectCostSchema.safeParse({ projectId: crypto.randomUUID(), amountCents: -100 });
      expect(result.success).toBe(false);
    });
  });
});

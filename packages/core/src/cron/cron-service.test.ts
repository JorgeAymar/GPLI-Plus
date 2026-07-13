import "dotenv/config";
import { describe, expect, it } from "vitest";
import { listCronSchedules, listRecentJobRuns } from "./cron-service";

/**
 * Read-only: pg-boss (apps/worker) owns pgboss.schedule/pgboss.job. These tests only assert
 * the shape/robustness of the read side - they never insert into pg-boss's own tables.
 */
describe("cron-service", () => {
  it("listCronSchedules returns an array without throwing, even if the worker never registered schedules", async () => {
    const schedules = await listCronSchedules();
    expect(Array.isArray(schedules)).toBe(true);
    for (const schedule of schedules) {
      expect(typeof schedule.name).toBe("string");
      expect(typeof schedule.cron).toBe("string");
      expect(schedule.timezone === null || typeof schedule.timezone === "string").toBe(true);
    }
  });

  it("listRecentJobRuns returns an array (possibly empty) without throwing when the worker never ran a job", async () => {
    const runs = await listRecentJobRuns(50);
    expect(Array.isArray(runs)).toBe(true);
    for (const run of runs) {
      expect(typeof run.name).toBe("string");
      expect(typeof run.state).toBe("string");
      expect(run.createdOn).toBeInstanceOf(Date);
      expect(run.startedOn === null || run.startedOn instanceof Date).toBe(true);
      expect(run.completedOn === null || run.completedOn instanceof Date).toBe(true);
    }
  });

  it("listRecentJobRuns respects the limit", async () => {
    const runs = await listRecentJobRuns(1);
    expect(runs.length).toBeLessThanOrEqual(1);
  });
});

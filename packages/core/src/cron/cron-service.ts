import { sql } from "drizzle-orm";
import { db } from "@itsm/db";

/**
 * Read-only view over pg-boss's own tables (schema `pgboss`, same database as the rest of
 * the app - see apps/worker). pg-boss creates and owns `pgboss.schedule` / `pgboss.job`
 * itself; there is intentionally no Drizzle table definition for them (they live outside
 * the schema Drizzle manages), so we query them with raw SQL via `sql` + `db.execute`.
 *
 * v1 scope: read-only. No "run now" action - inserting a job manually would require
 * apps/web to depend on the `pg-boss` package, which it does not today, and that's out of
 * scope for a read-only monitoring panel.
 */

export interface CronSchedule {
  name: string;
  cron: string;
  timezone: string | null;
}

export interface CronJobRun {
  name: string;
  state: string;
  createdOn: Date;
  startedOn: Date | null;
  completedOn: Date | null;
}

/** Every cron schedule pg-boss currently knows about, one row per queue name. */
export async function listCronSchedules(): Promise<CronSchedule[]> {
  const result = await db.execute<{
    name: string;
    cron: string;
    timezone: string | null;
  }>(sql`select name, cron, timezone from pgboss.schedule order by name`);
  return result.rows.map((r) => ({
    name: r.name,
    cron: r.cron,
    timezone: r.timezone ?? null,
  }));
}

/** Most recent job executions across all queues, newest first. */
export async function listRecentJobRuns(limit: number): Promise<CronJobRun[]> {
  const result = await db.execute<{
    name: string;
    state: string;
    created_on: Date;
    started_on: Date | null;
    completed_on: Date | null;
  }>(sql`select name, state, created_on, started_on, completed_on from pgboss.job order by created_on desc limit ${limit}`);
  return result.rows.map((r) => ({
    name: r.name,
    state: r.state,
    createdOn: r.created_on,
    startedOn: r.started_on ?? null,
    completedOn: r.completed_on ?? null,
  }));
}

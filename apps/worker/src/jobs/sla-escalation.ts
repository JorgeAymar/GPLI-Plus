import { runSlaEscalationSweep } from "@itsm/core";
import type { PgBoss } from "pg-boss";

const QUEUE_NAME = "sla-escalation-sweep";
const CRON = process.env.SLA_ESCALATION_CRON ?? "*/5 * * * *"; // every 5 minutes

/** Registers the recurring SLA-breach sweep: scan overdue itil_sla_assignments, flip isBreached, audit-log each. */
export async function registerSlaEscalationJob(boss: PgBoss): Promise<void> {
  await boss.createQueue(QUEUE_NAME);
  await boss.schedule(QUEUE_NAME, CRON);

  await boss.work(QUEUE_NAME, async () => {
    const breached = await runSlaEscalationSweep();
    if (breached > 0) {
      console.log(`[sla-escalation] ${breached} assignment(s) marked as breached`);
    }
  });
}

import { runRecurringTicketsSweep } from "@itsm/core";
import type { PgBoss } from "pg-boss";

const QUEUE_NAME = "recurring-tickets-sweep";
const CRON = "*/15 * * * *"; // every 15 minutes

/** Registers the recurring sweep that fires due recurring_ticket_templates into real tickets. */
export async function registerRecurringTicketsJob(boss: PgBoss): Promise<void> {
  await boss.createQueue(QUEUE_NAME);
  await boss.schedule(QUEUE_NAME, CRON);

  await boss.work(QUEUE_NAME, async () => {
    const created = await runRecurringTicketsSweep();
    if (created > 0) {
      console.log(`[recurring-tickets] created ${created} ticket(s)`);
    }
  });
}

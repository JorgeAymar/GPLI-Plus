import { runSavedSearchAlertsSweep } from "@itsm/core";
import type { PgBoss } from "pg-boss";

const QUEUE_NAME = "saved-search-alerts-sweep";
const CRON = "*/15 * * * *"; // every 15 minutes

/** Registers the recurring saved-search alert sweep: check each active alert's threshold, queue "saved_search_alert" notifications. */
export async function registerSavedSearchAlertsJob(boss: PgBoss): Promise<void> {
  await boss.createQueue(QUEUE_NAME);
  await boss.schedule(QUEUE_NAME, CRON);

  await boss.work(QUEUE_NAME, async () => {
    const queued = await runSavedSearchAlertsSweep();
    if (queued > 0) {
      console.log(`[saved-search-alerts] ${queued} notification(s) queued`);
    }
  });
}

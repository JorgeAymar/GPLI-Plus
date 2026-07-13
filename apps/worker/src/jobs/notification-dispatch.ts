import { ConsoleTransport, dispatchPendingNotifications } from "@itsm/core";
import type { PgBoss } from "pg-boss";

const QUEUE_NAME = "notification-dispatch";
const CRON = "* * * * *"; // every minute

const transport = new ConsoleTransport();

/** Registers the recurring notification-queue drain. Swap ConsoleTransport for a real one (SMTP/etc) later. */
export async function registerNotificationDispatchJob(boss: PgBoss): Promise<void> {
  await boss.createQueue(QUEUE_NAME);
  await boss.schedule(QUEUE_NAME, CRON);

  await boss.work(QUEUE_NAME, async () => {
    const { sent, failed } = await dispatchPendingNotifications(transport);
    if (sent > 0 || failed > 0) {
      console.log(`[notification-dispatch] sent=${sent} failed=${failed}`);
    }
  });
}

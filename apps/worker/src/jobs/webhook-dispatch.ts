import { dispatchPendingWebhooks } from "@itsm/core";
import type { PgBoss } from "pg-boss";

const QUEUE_NAME = "webhook-dispatch";
const CRON = process.env.WEBHOOK_DISPATCH_CRON ?? "* * * * *"; // every minute

/** Registers the recurring webhook-queue drain - see webhook-service.ts dispatchPendingWebhooks(). */
export async function registerWebhookDispatchJob(boss: PgBoss): Promise<void> {
  await boss.createQueue(QUEUE_NAME);
  await boss.schedule(QUEUE_NAME, CRON);

  await boss.work(QUEUE_NAME, async () => {
    const { sent, failed } = await dispatchPendingWebhooks();
    if (sent > 0 || failed > 0) {
      console.log(`[webhook-dispatch] sent=${sent} failed=${failed}`);
    }
  });
}

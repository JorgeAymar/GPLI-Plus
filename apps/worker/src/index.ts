import "./load-secrets";
import "dotenv/config";
import { PgBoss } from "pg-boss";
import { registerNotificationDispatchJob } from "./jobs/notification-dispatch";
import { registerRecurringTicketsJob } from "./jobs/recurring-tickets";
import { registerRssFeedRefreshJob } from "./jobs/rss-feed-refresh";
import { registerSavedSearchAlertsJob } from "./jobs/saved-search-alerts";
import { registerSlaEscalationJob } from "./jobs/sla-escalation";
import { registerWebhookDispatchJob } from "./jobs/webhook-dispatch";

async function startWithRetry(boss: PgBoss) {
  // Postgres may be restarting (host reboot, stack update): retry with backoff
  // instead of crashing and relying on the Swarm restart loop.
  let delay = 2000;
  for (let attempt = 1; ; attempt++) {
    try {
      await boss.start();
      return;
    } catch (err) {
      console.error(
        `[worker] pg-boss start failed (attempt ${attempt}), retrying in ${delay}ms:`,
        err instanceof Error ? err.message : err,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, 30000);
    }
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const boss = new PgBoss(process.env.DATABASE_URL);
  boss.on("error", (error) => console.error("[pg-boss]", error));

  await startWithRetry(boss);
  console.log("[worker] pg-boss started");

  await registerSlaEscalationJob(boss);
  await registerNotificationDispatchJob(boss);
  await registerRecurringTicketsJob(boss);
  await registerSavedSearchAlertsJob(boss);
  await registerRssFeedRefreshJob(boss);
  await registerWebhookDispatchJob(boss);
  console.log("[worker] jobs registered - running");
}

main().catch((err) => {
  console.error("[worker] fatal error", err);
  process.exit(1);
});

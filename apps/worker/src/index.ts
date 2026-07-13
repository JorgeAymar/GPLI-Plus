import "dotenv/config";
import { PgBoss } from "pg-boss";
import { registerNotificationDispatchJob } from "./jobs/notification-dispatch";
import { registerRecurringTicketsJob } from "./jobs/recurring-tickets";
import { registerRssFeedRefreshJob } from "./jobs/rss-feed-refresh";
import { registerSavedSearchAlertsJob } from "./jobs/saved-search-alerts";
import { registerSlaEscalationJob } from "./jobs/sla-escalation";
import { registerWebhookDispatchJob } from "./jobs/webhook-dispatch";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const boss = new PgBoss(process.env.DATABASE_URL);
  boss.on("error", (error) => console.error("[pg-boss]", error));

  await boss.start();
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

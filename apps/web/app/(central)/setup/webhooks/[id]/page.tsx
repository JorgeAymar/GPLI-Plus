import { getWebhook, listQueuedWebhooksForWebhook } from "@itsm/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

const STATUS_CLASS: Record<string, string> = {
  sent: "text-green-600",
  failed: "text-red-600",
  pending: "opacity-70",
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const webhook = await getWebhook(id);
  return { title: webhook?.name ?? "Webhook" };
}

export default async function WebhookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const webhook = await getWebhook(id);
  if (!webhook) notFound();

  const queued = await listQueuedWebhooksForWebhook(id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{webhook.name}</h1>
        <p className="text-sm opacity-60">
          {webhook.itemType} · {webhook.event} · {webhook.url}
          {webhook.isActive ? "" : " · inactivo"} · reintentos máx. {webhook.maxRetries}
        </p>
      </div>

      <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
        <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">Últimos envíos</h2>
        <ul className="space-y-1">
          {queued.map((q) => (
            <li key={q.id} className="text-sm">
              <span className={STATUS_CLASS[q.status] ?? ""}>{q.status}</span>
              {q.lastStatusCode !== null ? <span className="ml-2 opacity-60">HTTP {q.lastStatusCode}</span> : null}
              <span className="ml-2 opacity-40">{(q.sentAt ?? q.createdAt).toLocaleString()}</span>
              {q.attempt > 0 ? <span className="ml-2 text-xs opacity-40">intento {q.attempt}</span> : null}
              {q.lastError ? <span className="ml-2 text-xs text-red-500">{q.lastError}</span> : null}
            </li>
          ))}
          {queued.length === 0 ? <li className="text-sm opacity-50">Sin envíos todavía.</li> : null}
        </ul>
      </div>
    </div>
  );
}

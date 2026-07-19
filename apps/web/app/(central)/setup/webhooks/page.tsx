import { requireAuthContext } from "@/lib/session";
import { listWebhooks } from "@itsm/core";
import Link from "next/link";
import { WebhookForm } from "./webhook-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Webhooks" };

export default async function WebhooksPage() {
  const context = await requireAuthContext();
  const webhooks = await listWebhooks(context.activeEntity.id, { includeSubtree: true });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Webhooks</h1>
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Existentes</h2>
          <ul className="space-y-1">
            {webhooks.map((w) => (
              <li key={w.id} className="text-sm">
                <Link href={`/setup/webhooks/${w.id}`} className="hover:underline">
                  {w.name}
                </Link>
                <span className="ml-2 text-xs opacity-40">
                  ({w.itemType} · {w.event} · {w.url}
                  {w.isActive ? "" : " · inactivo"})
                </span>
              </li>
            ))}
            {webhooks.length === 0 ? <li className="text-sm opacity-50">Sin webhooks todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nuevo webhook</h2>
          <WebhookForm entityId={context.activeEntity.id} />
        </div>
      </div>
    </div>
  );
}

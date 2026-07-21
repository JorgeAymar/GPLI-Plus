import { listNotificationTemplates } from "@itsm/core";
import { NotificationTemplateForm } from "./notification-template-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Plantillas de notificación" };

export default async function NotificationTemplatesPage() {
  const templates = await listNotificationTemplates();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Plantillas de notificación</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
          <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">Existentes</h2>
          <ul className="space-y-1">
            {templates.map((t) => (
              <li key={t.id} className="text-sm">
                {t.name} <span className="opacity-40">({t.key})</span>
              </li>
            ))}
            {templates.length === 0 ? <li className="text-sm opacity-50">Sin plantillas todavía.</li> : null}
          </ul>
        </div>
        <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
          <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-medium opacity-60 dark:border-white/10">Nueva plantilla</h2>
          <NotificationTemplateForm />
        </div>
      </div>
    </div>
  );
}

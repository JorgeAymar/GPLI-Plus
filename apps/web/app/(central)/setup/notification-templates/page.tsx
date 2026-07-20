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
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Existentes</h2>
          <ul className="space-y-1">
            {templates.map((t) => (
              <li key={t.id} className="text-sm">
                {t.name} <span className="opacity-40">({t.key})</span>
              </li>
            ))}
            {templates.length === 0 ? <li className="text-sm opacity-50">Sin plantillas todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nueva plantilla</h2>
          <NotificationTemplateForm />
        </div>
      </div>
    </div>
  );
}

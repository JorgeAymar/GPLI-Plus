import { requireAuthContext } from "@/lib/session";
import { listRemindersVisibleTo } from "@itsm/core";
import { MarkReminderDoneButton } from "./mark-reminder-done-button";
import { ReminderForm } from "./reminder-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Recordatorios" };

export default async function RemindersPage() {
  const context = await requireAuthContext();
  const reminders = await listRemindersVisibleTo(context);

  const pending = reminders.filter((r) => !r.isDone);
  const done = reminders.filter((r) => r.isDone);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Recordatorios</h1>
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-sm font-medium opacity-70">Pendientes</h2>
            <ul className="space-y-2">
              {pending.map((r) => (
                <li key={r.id} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span>{r.title}</span>
                    <MarkReminderDoneButton id={r.id} />
                  </div>
                  {r.remindAt ? <span className="text-xs opacity-40">{new Date(r.remindAt).toLocaleString()}</span> : null}
                </li>
              ))}
              {pending.length === 0 ? <li className="text-sm opacity-50">Sin recordatorios pendientes.</li> : null}
            </ul>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-medium opacity-70">Hechos</h2>
            <ul className="space-y-1">
              {done.map((r) => (
                <li key={r.id} className="text-sm opacity-50 line-through">
                  {r.title}
                </li>
              ))}
              {done.length === 0 ? <li className="text-sm opacity-50">Sin recordatorios hechos todavía.</li> : null}
            </ul>
          </div>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nuevo recordatorio</h2>
          <ReminderForm entityId={context.activeEntity.id} />
        </div>
      </div>
    </div>
  );
}

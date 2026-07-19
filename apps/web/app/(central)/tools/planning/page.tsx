import { requireAuthContext } from "@/lib/session";
import { getPlanningItems, MODULE, requireRight, RIGHT, type PlanningItem, type PlanningItemType } from "@itsm/core";

const DEFAULT_RANGE_DAYS = 30;
const MS_PER_DAY = 86_400_000;

const ITEM_TYPE_LABELS: Record<PlanningItemType, string> = {
  change: "Cambio",
  project: "Proyecto",
  reservation: "Reserva",
};

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** `to` is inclusive of the whole picked day, regardless of server timezone. */
function endOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

/** Parses a `YYYY-MM-DD` search param, falling back when missing/invalid. */
function parseDateParam(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function formatDateHeading(date: Date): string {
  return date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

interface PlanningPageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Planificación" };

export default async function PlanningPage({ searchParams }: PlanningPageProps) {
  const { from: fromParam, to: toParam } = await searchParams;

  const today = startOfUtcDay(new Date());
  const defaultTo = endOfUtcDay(new Date(today.getTime() + DEFAULT_RANGE_DAYS * MS_PER_DAY));

  const from = startOfUtcDay(parseDateParam(fromParam, today));
  const to = endOfUtcDay(parseDateParam(toParam, defaultTo));

  const context = await requireAuthContext();
  await requireRight(context, MODULE.TOOLS_PLANNING, RIGHT.READ);

  const items = await getPlanningItems(context.activeEntity.id, { from, to, includeSubtree: true });

  // Grouped in JS (Map<dateKey, {date, items}>) instead of a SQL date-trunc groupBy -
  // insertion order matches ascending startAt since getPlanningItems() already sorted it.
  const groups = new Map<string, { date: Date; items: PlanningItem[] }>();
  for (const item of items) {
    const key = item.startAt.toDateString();
    const group = groups.get(key);
    if (group) {
      group.items.push(item);
    } else {
      groups.set(key, { date: item.startAt, items: [item] });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Planificación</h1>

      <form className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="from" className="text-sm opacity-70">
            Desde
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={toDateInputValue(from)}
            className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="to" className="text-sm opacity-70">
            Hasta
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={toDateInputValue(to)}
            className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
          />
        </div>
        <button type="submit" className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15">
          Aplicar
        </button>
      </form>

      <div className="space-y-6">
        {[...groups.values()].map((group) => (
          <div key={group.date.toDateString()}>
            <h2 className="mb-2 text-sm font-medium opacity-70">{formatDateHeading(group.date)}</h2>
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li
                  key={`${item.itemType}-${item.itemId}`}
                  className="flex items-center gap-3 border-t border-black/5 py-2 text-sm dark:border-white/5"
                >
                  <span className="rounded-full border border-black/15 px-2 py-0.5 text-xs opacity-70 dark:border-white/15">
                    {ITEM_TYPE_LABELS[item.itemType]}
                  </span>
                  <span className="flex-1">{item.title}</span>
                  <span className="opacity-60">
                    {formatTime(item.startAt)} - {formatTime(item.endAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {items.length === 0 ? <p className="opacity-50">Sin items planificados en este rango.</p> : null}
      </div>
    </div>
  );
}

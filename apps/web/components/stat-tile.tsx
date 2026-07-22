import Link from "next/link";
import type { ReactNode } from "react";

export type StatTileVariant = "neutral" | "success" | "danger";

// Same semantic color pattern as STATUS_VARIANTS in status-badge.tsx
// (bg-<color>-500/10 + text-<color>-700/dark:text-<color>-400), applied here
// to the tile's border/value color instead of a badge pill.
const VARIANT_CLASSES: Record<StatTileVariant, string> = {
  neutral: "border-black/10 dark:border-white/10",
  success: "border-green-500/30 dark:border-green-400/30",
  danger: "border-red-500/30 dark:border-red-400/30",
};

const VALUE_CLASSES: Record<StatTileVariant, string> = {
  neutral: "",
  success: "text-green-700 dark:text-green-400",
  danger: "text-red-700 dark:text-red-400",
};

/**
 * Single stat card for the Dashboard's summary row: a label, a big number
 * (or any short value), and a link to the full report that backs it under
 * `/tools/reports`. Visual language matches the existing AI-assistant card
 * in app/(central)/dashboard/page.tsx: `rounded-md border border-black/10 p-4
 * dark:border-white/10` outer shell, same CTA link classes. `variant` is an
 * optional semantic accent (e.g. SLA compliance rate) - defaults to neutral.
 */
export function StatTile({
  label,
  value,
  href,
  cta,
  variant = "neutral",
}: {
  label: string;
  value: ReactNode;
  href: string;
  cta: string;
  variant?: StatTileVariant;
}) {
  return (
    <div className={`group rounded-md border p-4 transition-colors hover:border-accent ${VARIANT_CLASSES[variant]}`}>
      <p className={`text-3xl leading-none font-semibold tracking-tight ${VALUE_CLASSES[variant]}`}>{value}</p>
      <h2 className="mt-1 text-[11px] font-bold tracking-wider opacity-60 uppercase">{label}</h2>
      <Link href={href} className="mt-3 inline-block rounded-md bg-accent px-3 py-2 text-sm text-white hover:bg-accent-hover">
        {cta}
      </Link>
    </div>
  );
}

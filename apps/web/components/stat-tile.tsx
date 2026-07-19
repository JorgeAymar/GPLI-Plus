import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Single stat card for the Dashboard's summary row: a label, a big number
 * (or any short value), and a link to the full report that backs it under
 * `/tools/reports`. Visual language matches the existing AI-assistant card
 * in app/(central)/dashboard/page.tsx: `rounded-md border border-black/10 p-4
 * dark:border-white/10` outer shell, same CTA link classes.
 */
export function StatTile({
  label,
  value,
  href,
  cta,
}: {
  label: string;
  value: ReactNode;
  href: string;
  cta: string;
}) {
  return (
    <div className="rounded-md border border-black/10 p-4 dark:border-white/10">
      <h2 className="text-sm font-medium opacity-70">{label}</h2>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
      <Link
        href={href}
        className="mt-3 inline-block rounded-md border border-black/15 px-3 py-2 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
      >
        {cta}
      </Link>
    </div>
  );
}

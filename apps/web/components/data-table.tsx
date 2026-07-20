import type { ReactNode } from "react";

export interface DataTableColumn<T> {
  /** Unique key for the column; also used as the React key for header/cell. */
  key: string;
  label: string;
  /** Optional per-cell renderer. Falls back to `String(row[key])` when omitted. */
  render?: (row: T) => ReactNode;
  /** Extra classes appended to this column's `<td>` only (e.g. "opacity-70", "whitespace-nowrap"). */
  className?: string;
}

/**
 * Generic data table that mirrors the exact markup/classes already used across
 * the app's hand-written tables (see e.g. `app/(central)/assets/page.tsx`):
 * `table.w-full.text-sm`, `th.pb-2`, `tr.border-t.border-black/5.dark:border-white/5`, `td.py-2`.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            {columns.map((col) => (
              <th key={col.key} className="pb-2 text-[11px] font-bold tracking-wider text-black/60 uppercase dark:text-white/60">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-t border-black/5 hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.03]"
            >
              {columns.map((col) => (
                <td key={col.key} className={col.className ? `py-2 ${col.className}` : "py-2"}>
                  {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "-")}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-2 opacity-50">
                {emptyMessage}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

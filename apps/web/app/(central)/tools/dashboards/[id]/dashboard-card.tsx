"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type ChartType = "table" | "bar" | "pie";

interface NormalizedPoint {
  label: string;
  value: number;
}

/**
 * Fixed-order 8-hue categorical palette (dataviz skill's validated reference
 * instance, references/palette.md) - never cycle past 8 slots, never generate
 * hues on the fly. Wired as CSS custom properties (see the <style> block in
 * DashboardCardView) so SVG `fill`/`stroke` can reference them via var(...)
 * and stay light/dark reactive without a JS media-query hook.
 */
const CATEGORICAL_SLOTS = [
  "var(--dash-series-1)",
  "var(--dash-series-2)",
  "var(--dash-series-3)",
  "var(--dash-series-4)",
  "var(--dash-series-5)",
  "var(--dash-series-6)",
  "var(--dash-series-7)",
  "var(--dash-series-8)",
];

const MAX_PIE_SLICES = 8;

/**
 * Each cardKey's report-service shape is different ({name,count}, {status,count},
 * {year,count}, {assetName,count}, or raw Contract rows for contracts_expiring) -
 * this is the one place that normalizes all of them down to the {label,value}[]
 * shape recharts needs. See card-provider.ts for the raw shapes.
 */
function normalizeForChart(cardKey: string, data: unknown): NormalizedPoint[] {
  if (!Array.isArray(data)) return [];
  const rows = data as Record<string, unknown>[];

  switch (cardKey) {
    case "assets_by_type":
    case "assets_by_status":
      return rows.map((r) => ({ label: String(r.name ?? ""), value: Number(r.count ?? 0) }));
    case "tickets_by_status":
      // No `name` field on this report row - only `status`.
      return rows.map((r) => ({ label: String(r.status ?? ""), value: Number(r.count ?? 0) }));
    case "yearly_assets":
      return rows.map((r) => ({ label: String(r.year ?? ""), value: Number(r.count ?? 0) }));
    case "reservations_usage":
      return rows.map((r) => ({ label: String(r.assetName ?? ""), value: Number(r.count ?? 0) }));
    case "contracts_expiring": {
      // Design decision: contracts_expiring returns raw Contract rows (one per
      // contract), not a pre-aggregated count - there's no natural "value" to
      // chart. We chart days-remaining-until-endDate instead, so bar/pie modes
      // still show something meaningful rather than a flat "1 per contract".
      const now = Date.now();
      return rows.map((r) => {
        const endDateValue = r.endDate as string | number | Date | null | undefined;
        const endDate = endDateValue ? new Date(endDateValue) : null;
        const daysLeft = endDate ? Math.max(0, Math.round((endDate.getTime() - now) / 86_400_000)) : 0;
        return { label: String(r.name ?? r.id ?? ""), value: daysLeft };
      });
    }
    default:
      return [];
  }
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Fully generic - renders whatever columns the raw row shape has, so it works unchanged for all 6 cardKeys. */
function TableView({ data }: { data: unknown }) {
  const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  const firstRow = rows[0];
  if (!firstRow) return <p className="text-sm opacity-50">Sin datos.</p>;
  const columns = Object.keys(firstRow);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left opacity-60">
          {columns.map((col) => (
            <th key={col} className="pb-1 pr-3 font-medium">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-t border-black/5 dark:border-white/5">
            {columns.map((col) => (
              <td key={col} className="py-1 pr-3">
                {formatCell(row[col])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * One nominal-category series -> one fixed color (categorical slot 1), never a
 * per-bar rainbow / value-ramp on nominal categories (dataviz skill anti-pattern).
 * Hairline, non-dashed CartesianGrid; Tooltip is the required hover layer.
 */
function BarView({ points }: { points: NormalizedPoint[] }) {
  if (points.length === 0) return <p className="text-sm opacity-50">Sin datos.</p>;
  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <BarChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 24 }}>
          <CartesianGrid stroke="var(--dash-grid)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "var(--dash-muted)", fontSize: 11 }} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fill: "var(--dash-muted)", fontSize: 11 }} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="value" fill="var(--dash-series-1)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Each slice is a distinct category (identity, part-to-whole) - the one case
 * where per-slice categorical color is correct. Slices beyond the 8-hue
 * palette fold into "Otros" (never cycle hues past 8). Legend always present
 * for >=2 series per the skill's accessibility rule.
 */
function PieView({ points }: { points: NormalizedPoint[] }) {
  if (points.length === 0) return <p className="text-sm opacity-50">Sin datos.</p>;

  const limited =
    points.length <= MAX_PIE_SLICES
      ? points
      : [
          ...points.slice(0, MAX_PIE_SLICES - 1),
          { label: "Otros", value: points.slice(MAX_PIE_SLICES - 1).reduce((sum, p) => sum + p.value, 0) },
        ];

  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={limited} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={80} stroke="var(--dash-surface)" strokeWidth={2}>
            {limited.map((entry, index) => (
              <Cell key={entry.label} fill={CATEGORICAL_SLOTS[index % CATEGORICAL_SLOTS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11, color: "var(--dash-secondary)" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DashboardCardView({ cardKey, data, chartType }: { cardKey: string; data: unknown; chartType?: string }) {
  const type: ChartType = chartType === "bar" || chartType === "pie" ? chartType : "table";

  return (
    <div className="dashboard-chart-vars">
      {/*
        CSS custom properties for the chart palette, defined once per card
        instance (self-contained, minor harmless duplication across cards -
        documented v1 simplification) so recharts fill/stroke props can
        reference them via var(...) and stay in sync with light/dark mode
        without a JS media-query hook. Values are the dataviz skill's
        validated reference palette (references/palette.md).
      */}
      <style>{`
        .dashboard-chart-vars {
          --dash-series-1: #2a78d6;
          --dash-series-2: #1baf7a;
          --dash-series-3: #eda100;
          --dash-series-4: #008300;
          --dash-series-5: #4a3aa7;
          --dash-series-6: #e34948;
          --dash-series-7: #e87ba4;
          --dash-series-8: #eb6834;
          --dash-grid: #e1e0d9;
          --dash-muted: #898781;
          --dash-secondary: #52514e;
          --dash-surface: #fcfcfb;
        }
        @media (prefers-color-scheme: dark) {
          .dashboard-chart-vars {
            --dash-series-1: #3987e5;
            --dash-series-2: #199e70;
            --dash-series-3: #c98500;
            --dash-series-4: #008300;
            --dash-series-5: #9085e9;
            --dash-series-6: #e66767;
            --dash-series-7: #d55181;
            --dash-series-8: #d95926;
            --dash-grid: #2c2c2a;
            --dash-muted: #898781;
            --dash-secondary: #c3c2b7;
            --dash-surface: #1a1a19;
          }
        }
      `}</style>
      {type === "table" ? (
        <TableView data={data} />
      ) : type === "bar" ? (
        <BarView points={normalizeForChart(cardKey, data)} />
      ) : (
        <PieView points={normalizeForChart(cardKey, data)} />
      )}
    </div>
  );
}

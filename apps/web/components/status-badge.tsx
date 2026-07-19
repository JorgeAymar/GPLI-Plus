/**
 * Shared status badge for ITIL objects (tickets, problems, changes) which all
 * share the same `itil_status` enum: new | assigned | planned | pending | solved | closed
 * (see packages/db/src/schema/itil-shared.ts).
 *
 * Color pattern follows the existing badge convention used for API token
 * status in app/(central)/account/page.tsx and app/(central)/setup/api-clients/page.tsx
 * (`rounded bg-<color>-500/10 px-1.5 py-0.5 text-xs text-<color>-700 dark:text-<color>-400`).
 */

export const STATUS_LABELS: Record<string, string> = {
  new: "Nuevo",
  assigned: "Asignado",
  planned: "Planificado",
  pending: "Pendiente",
  solved: "Resuelto",
  closed: "Cerrado",
};

type StatusVariant = "neutral" | "warning" | "success";

const STATUS_VARIANTS: Record<string, StatusVariant> = {
  new: "neutral",
  assigned: "warning",
  planned: "warning",
  pending: "warning",
  solved: "success",
  closed: "success",
};

const VARIANT_CLASSES: Record<StatusVariant, string> = {
  neutral: "bg-black/10 text-black/70 dark:bg-white/15 dark:text-white/70",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  success: "bg-green-500/10 text-green-700 dark:text-green-400",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const variant = STATUS_VARIANTS[status] ?? "neutral";
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs whitespace-nowrap ${VARIANT_CLASSES[variant]}${className ? ` ${className}` : ""}`}
    >
      {statusLabel(status)}
    </span>
  );
}

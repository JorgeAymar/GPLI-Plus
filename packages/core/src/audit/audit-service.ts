import { auditLog, db, type AuditLogEntry } from "@itsm/db";
import { and, count, desc, eq, gte, lte, type SQL } from "drizzle-orm";

/** Generic audit trail write, reused by every module instead of per-module audit tables. */
export async function recordAuditLog(input: {
  entityId: string;
  actorUserId: string | null;
  action: string;
  objectType: string;
  objectId: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  await db.insert(auditLog).values({
    entityId: input.entityId,
    actorUserId: input.actorUserId,
    action: input.action,
    objectType: input.objectType,
    objectId: input.objectId,
    before: input.before ?? null,
    after: input.after ?? null,
  });
}

export interface AuditLogFilters {
  objectType?: string;
  actorUserId?: string;
  from?: Date;
  to?: Date;
}

/** All filters are optional (unlike most list* functions, there's no mandatory entity-scoping condition here), so the array can end up empty. */
function buildAuditLogConditions(filters: AuditLogFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.objectType) conditions.push(eq(auditLog.objectType, filters.objectType));
  if (filters.actorUserId) conditions.push(eq(auditLog.actorUserId, filters.actorUserId));
  if (filters.from) conditions.push(gte(auditLog.createdAt, filters.from));
  if (filters.to) conditions.push(lte(auditLog.createdAt, filters.to));
  return conditions;
}

/** Paginated audit_log browse for the Log Viewer, newest first. */
export async function listAuditLog(
  filters: AuditLogFilters,
  pagination: { limit: number; offset: number },
): Promise<AuditLogEntry[]> {
  const conditions = buildAuditLogConditions(filters);
  return db
    .select()
    .from(auditLog)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLog.createdAt))
    .limit(pagination.limit)
    .offset(pagination.offset);
}

/** Same filters as listAuditLog, for computing total page count instead of fetching rows. */
export async function countAuditLog(filters: AuditLogFilters): Promise<number> {
  const conditions = buildAuditLogConditions(filters);
  const [row] = await db
    .select({ value: count() })
    .from(auditLog)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  return row?.value ?? 0;
}

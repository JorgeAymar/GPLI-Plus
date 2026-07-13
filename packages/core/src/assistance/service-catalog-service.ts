import { db, serviceCatalogItems, type ServiceCatalogItem, type TicketType } from "@itsm/db";
import { and, eq, inArray } from "drizzle-orm";
import { listSubtree } from "../entities/entity-service";

export async function createServiceCatalogItem(input: {
  entityId: string;
  name: string;
  description?: string | null;
  ticketType?: TicketType;
  categoryDropdownItemId?: string | null;
  sortOrder?: number;
}): Promise<ServiceCatalogItem> {
  const [created] = await db
    .insert(serviceCatalogItems)
    .values({
      entityId: input.entityId,
      name: input.name,
      description: input.description ?? null,
      ticketType: input.ticketType ?? "request",
      categoryDropdownItemId: input.categoryDropdownItemId ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  if (!created) throw new Error("Failed to insert service catalog item");
  return created;
}

export async function getServiceCatalogItem(id: string): Promise<ServiceCatalogItem | undefined> {
  const [row] = await db.select().from(serviceCatalogItems).where(eq(serviceCatalogItems.id, id));
  return row;
}

/**
 * Items visible from `entityId`, optionally widened to its subtree (see
 * listSubtree - same pattern as listSlaPolicies). `onlyActive` defaults to
 * true because the primary caller is the self-service portal, which must
 * never offer a disabled catalog entry; admin screens that need to manage
 * (and re-enable) disabled items pass `onlyActive: false` explicitly.
 * Ordered by sortOrder then name, matching the "curated catalog" intent -
 * this is a picklist for end users, not an alphabetical admin table.
 */
export async function listServiceCatalogItems(
  entityId: string,
  options?: { includeSubtree?: boolean; onlyActive?: boolean },
): Promise<ServiceCatalogItem[]> {
  const entityIds = options?.includeSubtree ? (await listSubtree(entityId)).map((e) => e.id) : [entityId];
  const onlyActive = options?.onlyActive ?? true;

  return db
    .select()
    .from(serviceCatalogItems)
    .where(
      onlyActive
        ? and(inArray(serviceCatalogItems.entityId, entityIds), eq(serviceCatalogItems.isActive, true))
        : inArray(serviceCatalogItems.entityId, entityIds),
    )
    .orderBy(serviceCatalogItems.sortOrder, serviceCatalogItems.name);
}

export async function updateServiceCatalogItem(
  id: string,
  input: Partial<{
    name: string;
    description: string | null;
    ticketType: TicketType;
    categoryDropdownItemId: string | null;
    isActive: boolean;
    sortOrder: number;
  }>,
): Promise<ServiceCatalogItem> {
  const [updated] = await db.update(serviceCatalogItems).set(input).where(eq(serviceCatalogItems.id, id)).returning();
  if (!updated) throw new Error(`Service catalog item ${id} not found`);
  return updated;
}

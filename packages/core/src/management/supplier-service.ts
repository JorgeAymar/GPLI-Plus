import { db, suppliers, type Supplier } from "@itsm/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { listSubtree } from "../entities/entity-service";

export async function createSupplier(input: {
  entityId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  comment?: string | null;
}): Promise<Supplier> {
  const [created] = await db.insert(suppliers).values(input).returning();
  if (!created) throw new Error("Failed to insert supplier");
  return created;
}

export async function getSupplier(id: string): Promise<Supplier | undefined> {
  const [row] = await db.select().from(suppliers).where(eq(suppliers.id, id));
  return row;
}

export async function listSuppliers(entityId: string, options?: { includeSubtree?: boolean }): Promise<Supplier[]> {
  const entityIds = options?.includeSubtree ? (await listSubtree(entityId)).map((e) => e.id) : [entityId];
  return db
    .select()
    .from(suppliers)
    .where(and(inArray(suppliers.entityId, entityIds), isNull(suppliers.deletedAt)))
    .orderBy(suppliers.name);
}

export async function softDeleteSupplier(id: string): Promise<Supplier> {
  const [updated] = await db.update(suppliers).set({ deletedAt: new Date() }).where(eq(suppliers.id, id)).returning();
  if (!updated) throw new Error(`Supplier ${id} not found`);
  return updated;
}

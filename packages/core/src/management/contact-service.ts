import { contacts, db, type Contact } from "@itsm/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { listSubtree } from "../entities/entity-service";

export async function createContact(input: {
  entityId: string;
  supplierId?: string | null;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  comment?: string | null;
}): Promise<Contact> {
  const [created] = await db.insert(contacts).values(input).returning();
  if (!created) throw new Error("Failed to insert contact");
  return created;
}

export async function getContact(id: string): Promise<Contact | undefined> {
  const [row] = await db.select().from(contacts).where(eq(contacts.id, id));
  return row;
}

export async function listContacts(entityId: string, options?: { includeSubtree?: boolean }): Promise<Contact[]> {
  const entityIds = options?.includeSubtree ? (await listSubtree(entityId)).map((e) => e.id) : [entityId];
  return db
    .select()
    .from(contacts)
    .where(and(inArray(contacts.entityId, entityIds), isNull(contacts.deletedAt)))
    .orderBy(contacts.lastName, contacts.firstName);
}

export async function listContactsForSupplier(supplierId: string): Promise<Contact[]> {
  return db
    .select()
    .from(contacts)
    .where(and(eq(contacts.supplierId, supplierId), isNull(contacts.deletedAt)));
}

export async function softDeleteContact(id: string): Promise<Contact> {
  const [updated] = await db.update(contacts).set({ deletedAt: new Date() }).where(eq(contacts.id, id)).returning();
  if (!updated) throw new Error(`Contact ${id} not found`);
  return updated;
}

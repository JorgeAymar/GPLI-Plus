import "dotenv/config";
import { contacts, db, entities, suppliers, type Entity, type Supplier } from "@itsm/db";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEntity } from "../entities/entity-service";
import { createContact, getContact, listContacts, listContactsForSupplier, softDeleteContact } from "./contact-service";

const PREFIX = "__vitest_mgmt__contact-service";

describe("contact-service", () => {
  let rootEntity: Entity;
  let childEntity: Entity;
  let supplier: Supplier;
  const contactIds: string[] = [];

  beforeAll(async () => {
    rootEntity = await createEntity({ name: `${PREFIX}-root` });
    childEntity = await createEntity({ name: `${PREFIX}-child`, parentId: rootEntity.id });
    const [insertedSupplier] = await db
      .insert(suppliers)
      .values({ entityId: rootEntity.id, name: `${PREFIX}-supplier` })
      .returning();
    if (!insertedSupplier) throw new Error("Failed to insert supplier");
    supplier = insertedSupplier;
  });

  afterAll(async () => {
    // contacts.supplierId has no ON DELETE CASCADE -> delete contacts before the supplier.
    if (contactIds.length) await db.delete(contacts).where(inArray(contacts.id, contactIds));
    if (supplier) await db.delete(suppliers).where(eq(suppliers.id, supplier.id));
    await db.delete(entities).where(eq(entities.id, childEntity.id));
    await db.delete(entities).where(eq(entities.id, rootEntity.id));
  });

  it("creates a contact and retrieves it by id", async () => {
    const contact = await createContact({
      entityId: rootEntity.id,
      supplierId: supplier.id,
      firstName: "Ada",
      lastName: `Lovelace-${PREFIX}`,
      email: "ada@example.com",
    });
    contactIds.push(contact.id);

    expect(contact.firstName).toBe("Ada");
    expect(contact.supplierId).toBe(supplier.id);
    expect(contact.deletedAt).toBeNull();

    const fetched = await getContact(contact.id);
    expect(fetched?.id).toBe(contact.id);
  });

  it("scopes listContacts to the given entity by default, and includes the subtree when asked", async () => {
    const rootContact = await createContact({ entityId: rootEntity.id, firstName: "Root", lastName: `Contact-${PREFIX}` });
    const childContact = await createContact({ entityId: childEntity.id, firstName: "Child", lastName: `Contact-${PREFIX}` });
    contactIds.push(rootContact.id, childContact.id);

    const rootOnly = await listContacts(rootEntity.id);
    expect(rootOnly.map((c) => c.id)).toContain(rootContact.id);
    expect(rootOnly.map((c) => c.id)).not.toContain(childContact.id);

    const withSubtree = await listContacts(rootEntity.id, { includeSubtree: true });
    expect(withSubtree.map((c) => c.id)).toContain(rootContact.id);
    expect(withSubtree.map((c) => c.id)).toContain(childContact.id);
  });

  it("lists contacts scoped to a supplier", async () => {
    const linked = await createContact({
      entityId: rootEntity.id,
      supplierId: supplier.id,
      firstName: "Linked",
      lastName: `Contact-${PREFIX}`,
    });
    const unlinked = await createContact({ entityId: rootEntity.id, firstName: "Unlinked", lastName: `Contact-${PREFIX}` });
    contactIds.push(linked.id, unlinked.id);

    const forSupplier = await listContactsForSupplier(supplier.id);
    expect(forSupplier.map((c) => c.id)).toContain(linked.id);
    expect(forSupplier.map((c) => c.id)).not.toContain(unlinked.id);
  });

  it("soft-deletes a contact and excludes it from listContacts", async () => {
    const contact = await createContact({ entityId: rootEntity.id, firstName: "ToDelete", lastName: `Contact-${PREFIX}` });
    contactIds.push(contact.id);

    const deleted = await softDeleteContact(contact.id);
    expect(deleted.deletedAt).not.toBeNull();

    const list = await listContacts(rootEntity.id);
    expect(list.map((c) => c.id)).not.toContain(contact.id);
  });

  it("throws when soft-deleting a non-existent contact", async () => {
    await expect(softDeleteContact("00000000-0000-0000-0000-000000000000")).rejects.toThrow();
  });
});

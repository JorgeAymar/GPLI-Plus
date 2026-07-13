import "dotenv/config";
import { randomUUID } from "node:crypto";
import { assets, auditLog, db, entities, itilActors, tickets, users } from "@itsm/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createComputer } from "../assets/computer-service";
import { createEntity } from "../entities/entity-service";
import { createTicket } from "../itil/ticket-service";
import { createUser } from "../users/user-service";
import { attachDocumentSchema } from "../validation/document.zod";
import {
  attachDocumentToItem,
  deleteDocument,
  getDocument,
  listDocumentsForItem,
  readDocumentContent,
  removeDocumentAttachment,
  uploadDocument,
} from "./document-service";

const PREFIX = "__vitest_platform__";

describe("document-service", () => {
  let entityId: string;
  let userId: string;
  let ticketId: string;
  let computerAssetId: string;

  beforeAll(async () => {
    const entity = await createEntity({ name: `${PREFIX}documents_${randomUUID()}` });
    entityId = entity.id;

    const user = await createUser({
      email: `${PREFIX}documents_${randomUUID()}@example.com`,
      username: `${PREFIX}documents_${randomUUID()}`,
      password: "correct-horse-battery-staple",
      displayName: "Document Test User",
    });
    userId = user.id;

    const ticket = await createTicket(
      { entityId, title: `${PREFIX} ticket`, content: "Contenido de prueba" },
      userId,
    );
    ticketId = ticket.id;

    const { asset } = await createComputer({ entityId, name: `${PREFIX} computer` }, null);
    computerAssetId = asset.id;
  });

  afterAll(async () => {
    await db.delete(itilActors).where(and(eq(itilActors.itilType, "ticket"), eq(itilActors.itilId, ticketId)));
    await db.delete(auditLog).where(eq(auditLog.entityId, entityId));
    await db.delete(tickets).where(eq(tickets.id, ticketId));
    await db.delete(assets).where(eq(assets.id, computerAssetId));
    await db.delete(users).where(eq(users.id, userId));
    await db.delete(entities).where(eq(entities.id, entityId));
  });

  it("uploadDocument stores metadata + bytes, attaches to a Ticket AND a Computer (real polymorphism), and both listings see it", async () => {
    const content = Buffer.from(`hello from ${PREFIX} document test`);
    const doc = await uploadDocument({
      entityId,
      name: "Vitest doc",
      filename: "vitest-doc.txt",
      mimeType: "text/plain",
      buffer: content,
      uploadedByUserId: userId,
    });

    try {
      expect(doc.sizeBytes).toBe(content.length);
      expect(doc.mimeType).toBe("text/plain");

      await attachDocumentToItem(doc.id, "ticket", ticketId);
      await attachDocumentToItem(doc.id, "computer", computerAssetId);

      const onTicket = await listDocumentsForItem("ticket", ticketId);
      expect(onTicket.some((d) => d.id === doc.id)).toBe(true);

      const onComputer = await listDocumentsForItem("computer", computerAssetId);
      expect(onComputer.some((d) => d.id === doc.id)).toBe(true);

      const read = await readDocumentContent(doc.id);
      expect(read?.buffer.equals(content)).toBe(true);
      expect(read?.filename).toBe("vitest-doc.txt");

      // Detaching from one item type must not affect the other - it's a many-to-many join, not a single owner.
      await removeDocumentAttachment(doc.id, "ticket", ticketId);
      const onTicketAfterRemoval = await listDocumentsForItem("ticket", ticketId);
      expect(onTicketAfterRemoval.some((d) => d.id === doc.id)).toBe(false);

      const onComputerAfterRemoval = await listDocumentsForItem("computer", computerAssetId);
      expect(onComputerAfterRemoval.some((d) => d.id === doc.id)).toBe(true);
    } finally {
      await deleteDocument(doc.id);
    }
  });

  it("deleteDocument removes the row (and cascades document_items) so getDocument returns undefined", async () => {
    const content = Buffer.from("to be deleted");
    const doc = await uploadDocument({
      entityId,
      name: "Doomed doc",
      filename: "doomed.txt",
      mimeType: "text/plain",
      buffer: content,
      uploadedByUserId: userId,
    });
    await attachDocumentToItem(doc.id, "ticket", ticketId);

    await deleteDocument(doc.id);

    expect(await getDocument(doc.id)).toBeUndefined();
    const onTicket = await listDocumentsForItem("ticket", ticketId);
    expect(onTicket.some((d) => d.id === doc.id)).toBe(false);
  });

  it("getDocument/readDocumentContent return undefined for a non-existent id", async () => {
    expect(await getDocument(randomUUID())).toBeUndefined();
    expect(await readDocumentContent(randomUUID())).toBeUndefined();
  });

  describe("document zod schema", () => {
    it("attachDocumentSchema requires a non-empty itemType and a uuid itemId", () => {
      expect(attachDocumentSchema.safeParse({ itemType: "ticket", itemId: randomUUID() }).success).toBe(true);
      expect(attachDocumentSchema.safeParse({ itemType: "", itemId: randomUUID() }).success).toBe(false);
      expect(attachDocumentSchema.safeParse({ itemType: "ticket", itemId: "not-a-uuid" }).success).toBe(false);
    });
  });
});

import { db, assistantConversations, assistantMessages, type AssistantConversation, type AssistantMessage } from "@itsm/db";
import { and, asc, count, desc, eq } from "drizzle-orm";

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: Date;
}

export interface ConversationWithMessages extends AssistantConversation {
  messages: AssistantMessage[];
}

export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  return db
    .select({ id: assistantConversations.id, title: assistantConversations.title, updatedAt: assistantConversations.updatedAt })
    .from(assistantConversations)
    .where(eq(assistantConversations.userId, userId))
    .orderBy(desc(assistantConversations.updatedAt));
}

export async function getConversationWithMessages(id: string, userId: string): Promise<ConversationWithMessages | null> {
  const [conversation] = await db
    .select()
    .from(assistantConversations)
    .where(and(eq(assistantConversations.id, id), eq(assistantConversations.userId, userId)));
  if (!conversation) return null;

  const messages = await db.select().from(assistantMessages).where(eq(assistantMessages.conversationId, id)).orderBy(asc(assistantMessages.createdAt));
  return { ...conversation, messages };
}

export async function deleteConversation(id: string, userId: string): Promise<void> {
  await db.delete(assistantConversations).where(and(eq(assistantConversations.id, id), eq(assistantConversations.userId, userId)));
}

export async function createConversation(userId: string): Promise<string> {
  const [conversation] = await db.insert(assistantConversations).values({ userId }).returning({ id: assistantConversations.id });
  if (!conversation) throw new Error("No se pudo crear la conversación.");
  return conversation.id;
}

/** Also bumps the conversation's updatedAt so the sidebar list re-sorts by most recently active, not just created. */
export async function addMessage(conversationId: string, role: string, content: string, model: string | null): Promise<void> {
  await db.insert(assistantMessages).values({ conversationId, role, content, model });
  await db.update(assistantConversations).set({ updatedAt: new Date() }).where(eq(assistantConversations.id, conversationId));
}

/** Auto-titles a conversation from its first user message once the exchange has exactly 2 messages (user + assistant) - matches until then. */
export async function maybeSetInitialTitle(conversationId: string, firstUserMessage: string): Promise<void> {
  const [row] = await db.select({ value: count() }).from(assistantMessages).where(eq(assistantMessages.conversationId, conversationId));
  if ((row?.value ?? 0) > 2) return;

  const title = firstUserMessage.slice(0, 60) + (firstUserMessage.length > 60 ? "…" : "");
  await db.update(assistantConversations).set({ title, updatedAt: new Date() }).where(eq(assistantConversations.id, conversationId));
}

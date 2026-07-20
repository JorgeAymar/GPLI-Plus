import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const assistantConversations = pgTable(
  "assistant_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Nueva conversación"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("assistant_conversations_user_updated_idx").on(table.userId, table.updatedAt)],
);

export const assistantMessages = pgTable(
  "assistant_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => assistantConversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // "user" | "assistant"
    content: text("content").notNull(),
    model: text("model"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("assistant_messages_conversation_idx").on(table.conversationId)],
);

export type AssistantConversation = typeof assistantConversations.$inferSelect;
export type NewAssistantConversation = typeof assistantConversations.$inferInsert;
export type AssistantMessage = typeof assistantMessages.$inferSelect;
export type NewAssistantMessage = typeof assistantMessages.$inferInsert;

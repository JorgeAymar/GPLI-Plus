CREATE TABLE "assistant_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT 'Nueva conversación' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"model" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_conversation_id_assistant_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."assistant_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_conversations_user_updated_idx" ON "assistant_conversations" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "assistant_messages_conversation_idx" ON "assistant_messages" USING btree ("conversation_id");
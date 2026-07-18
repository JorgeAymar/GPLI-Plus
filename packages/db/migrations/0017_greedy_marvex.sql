ALTER TABLE "api_clients" ALTER COLUMN "entity_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "api_clients" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "api_clients" ADD CONSTRAINT "api_clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_clients_user_idx" ON "api_clients" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "api_clients" ADD CONSTRAINT "api_clients_entity_xor_user" CHECK ((entity_id IS NOT NULL) != (user_id IS NOT NULL));
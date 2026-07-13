CREATE TYPE "public"."inventory_submission_status" AS ENUM('pending', 'processed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."rack_slot_orientation" AS ENUM('front', 'rear');--> statement-breakpoint
CREATE TYPE "public"."queued_webhook_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."webhook_event" AS ENUM('create', 'update', 'delete');--> statement-breakpoint
CREATE TABLE "inventory_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"name" text NOT NULL,
	"asset_id" uuid,
	"last_contact_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_agents_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE "inventory_locked_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	"locked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"status" "inventory_submission_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "cables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"endpoint_a_asset_id" uuid NOT NULL,
	"endpoint_b_asset_id" uuid NOT NULL,
	"cable_type_dropdown_item_id" uuid,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cluster_members" (
	"cluster_asset_id" uuid NOT NULL,
	"member_asset_id" uuid NOT NULL,
	CONSTRAINT "cluster_members_cluster_asset_id_member_asset_id_pk" PRIMARY KEY("cluster_asset_id","member_asset_id")
);
--> statement-breakpoint
CREATE TABLE "enclosure_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enclosure_asset_id" uuid NOT NULL,
	"occupant_asset_id" uuid,
	"position_slot" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rack_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rack_asset_id" uuid NOT NULL,
	"occupant_asset_id" uuid,
	"position_u" integer NOT NULL,
	"unit_height" integer DEFAULT 1 NOT NULL,
	"orientation" "rack_slot_orientation" DEFAULT 'front' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "impact_contexts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"root_asset_id" uuid NOT NULL,
	"max_depth" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "impact_contexts_root_asset_id_unique" UNIQUE("root_asset_id")
);
--> statement-breakpoint
CREATE TABLE "impact_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_asset_id" uuid NOT NULL,
	"impacted_asset_id" uuid NOT NULL,
	"label" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"name" text NOT NULL,
	"api_key_hash" text NOT NULL,
	"api_key_prefix" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "queued_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "queued_webhook_status" DEFAULT 'pending' NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"last_status_code" integer,
	"last_error" text,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"name" text NOT NULL,
	"item_type" text NOT NULL,
	"event" "webhook_event" NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"custom_headers" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ldap_auth_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"host" text NOT NULL,
	"port" integer DEFAULT 389 NOT NULL,
	"base_dn" text NOT NULL,
	"bind_dn" text NOT NULL,
	"bind_password_encrypted" text NOT NULL,
	"login_field" text DEFAULT 'uid' NOT NULL,
	"sync_field" text NOT NULL,
	"group_field" text,
	"use_tls" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_agents" ADD CONSTRAINT "inventory_agents_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_agents" ADD CONSTRAINT "inventory_agents_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_locked_fields" ADD CONSTRAINT "inventory_locked_fields_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_submissions" ADD CONSTRAINT "inventory_submissions_agent_id_inventory_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."inventory_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cables" ADD CONSTRAINT "cables_endpoint_a_asset_id_assets_id_fk" FOREIGN KEY ("endpoint_a_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cables" ADD CONSTRAINT "cables_endpoint_b_asset_id_assets_id_fk" FOREIGN KEY ("endpoint_b_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cables" ADD CONSTRAINT "cables_cable_type_dropdown_item_id_dropdown_items_id_fk" FOREIGN KEY ("cable_type_dropdown_item_id") REFERENCES "public"."dropdown_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cluster_members" ADD CONSTRAINT "cluster_members_cluster_asset_id_assets_id_fk" FOREIGN KEY ("cluster_asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cluster_members" ADD CONSTRAINT "cluster_members_member_asset_id_assets_id_fk" FOREIGN KEY ("member_asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enclosure_slots" ADD CONSTRAINT "enclosure_slots_enclosure_asset_id_assets_id_fk" FOREIGN KEY ("enclosure_asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enclosure_slots" ADD CONSTRAINT "enclosure_slots_occupant_asset_id_assets_id_fk" FOREIGN KEY ("occupant_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rack_slots" ADD CONSTRAINT "rack_slots_rack_asset_id_assets_id_fk" FOREIGN KEY ("rack_asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rack_slots" ADD CONSTRAINT "rack_slots_occupant_asset_id_assets_id_fk" FOREIGN KEY ("occupant_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact_contexts" ADD CONSTRAINT "impact_contexts_root_asset_id_assets_id_fk" FOREIGN KEY ("root_asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact_relations" ADD CONSTRAINT "impact_relations_source_asset_id_assets_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact_relations" ADD CONSTRAINT "impact_relations_impacted_asset_id_assets_id_fk" FOREIGN KEY ("impacted_asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_clients" ADD CONSTRAINT "api_clients_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queued_webhooks" ADD CONSTRAINT "queued_webhooks_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_locked_fields_asset_field_unique" ON "inventory_locked_fields" USING btree ("asset_id","field_name");--> statement-breakpoint
CREATE INDEX "rack_slots_rack_orientation_idx" ON "rack_slots" USING btree ("rack_asset_id","orientation");--> statement-breakpoint
CREATE INDEX "impact_relations_source_impacted_idx" ON "impact_relations" USING btree ("source_asset_id","impacted_asset_id");--> statement-breakpoint
CREATE INDEX "api_clients_entity_idx" ON "api_clients" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "api_clients_prefix_idx" ON "api_clients" USING btree ("api_key_prefix");--> statement-breakpoint
CREATE INDEX "queued_webhooks_webhook_idx" ON "queued_webhooks" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "queued_webhooks_status_next_attempt_idx" ON "queued_webhooks" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "webhooks_entity_idx" ON "webhooks" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "webhooks_item_type_event_idx" ON "webhooks" USING btree ("item_type","event");
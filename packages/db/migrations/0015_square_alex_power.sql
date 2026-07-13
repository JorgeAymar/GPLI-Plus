CREATE TYPE "public"."consumable_status" AS ENUM('new', 'in_use', 'used');--> statement-breakpoint
CREATE TYPE "public"."ticket_field_type" AS ENUM('text', 'textarea', 'number', 'boolean', 'date', 'dropdown');--> statement-breakpoint
CREATE TABLE "consumable_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"name" text NOT NULL,
	"supplier_id" uuid,
	"alert_threshold" integer,
	"comment" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consumables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consumable_item_id" uuid NOT NULL,
	"status" "consumable_status" DEFAULT 'new' NOT NULL,
	"assigned_asset_id" uuid,
	"purchase_date" timestamp,
	"use_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_catalog_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"ticket_type" "ticket_type" DEFAULT 'request' NOT NULL,
	"category_dropdown_item_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"remind_at" timestamp,
	"is_done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_field_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_type" text,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"field_type" "ticket_field_type" NOT NULL,
	"dropdown_category_id" uuid,
	"is_required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "consumable_items" ADD CONSTRAINT "consumable_items_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumable_items" ADD CONSTRAINT "consumable_items_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumables" ADD CONSTRAINT "consumables_consumable_item_id_consumable_items_id_fk" FOREIGN KEY ("consumable_item_id") REFERENCES "public"."consumable_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumables" ADD CONSTRAINT "consumables_assigned_asset_id_assets_id_fk" FOREIGN KEY ("assigned_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_catalog_items" ADD CONSTRAINT "service_catalog_items_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_catalog_items" ADD CONSTRAINT "service_catalog_items_category_dropdown_item_id_dropdown_items_id_fk" FOREIGN KEY ("category_dropdown_item_id") REFERENCES "public"."dropdown_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_field_definitions" ADD CONSTRAINT "ticket_field_definitions_dropdown_category_id_dropdown_categories_id_fk" FOREIGN KEY ("dropdown_category_id") REFERENCES "public"."dropdown_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_field_def_unique_key" ON "ticket_field_definitions" USING btree ("ticket_type","key");
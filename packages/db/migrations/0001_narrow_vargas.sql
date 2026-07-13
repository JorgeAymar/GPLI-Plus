CREATE TYPE "public"."asset_field_type" AS ENUM('text', 'textarea', 'number', 'boolean', 'date', 'dropdown');--> statement-breakpoint
CREATE TABLE "dropdown_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dropdown_categories_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "dropdown_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"comment" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"has_extension_table" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asset_definitions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "asset_field_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_definition_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"field_type" "asset_field_type" NOT NULL,
	"dropdown_category_id" uuid,
	"is_required" boolean DEFAULT false NOT NULL,
	"default_value" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"asset_definition_id" uuid NOT NULL,
	"name" text NOT NULL,
	"serial_number" text,
	"inventory_number" text,
	"status_dropdown_item_id" uuid,
	"manufacturer_dropdown_item_id" uuid,
	"model_dropdown_item_id" uuid,
	"location_dropdown_item_id" uuid,
	"user_id" uuid,
	"group_id" uuid,
	"comment" text,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dropdown_items" ADD CONSTRAINT "dropdown_items_category_id_dropdown_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."dropdown_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dropdown_items" ADD CONSTRAINT "dropdown_items_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dropdown_items" ADD CONSTRAINT "dropdown_items_parent_id_dropdown_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."dropdown_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_field_definitions" ADD CONSTRAINT "asset_field_definitions_asset_definition_id_asset_definitions_id_fk" FOREIGN KEY ("asset_definition_id") REFERENCES "public"."asset_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_field_definitions" ADD CONSTRAINT "asset_field_definitions_dropdown_category_id_dropdown_categories_id_fk" FOREIGN KEY ("dropdown_category_id") REFERENCES "public"."dropdown_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_asset_definition_id_asset_definitions_id_fk" FOREIGN KEY ("asset_definition_id") REFERENCES "public"."asset_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_status_dropdown_item_id_dropdown_items_id_fk" FOREIGN KEY ("status_dropdown_item_id") REFERENCES "public"."dropdown_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_manufacturer_dropdown_item_id_dropdown_items_id_fk" FOREIGN KEY ("manufacturer_dropdown_item_id") REFERENCES "public"."dropdown_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_model_dropdown_item_id_dropdown_items_id_fk" FOREIGN KEY ("model_dropdown_item_id") REFERENCES "public"."dropdown_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_location_dropdown_item_id_dropdown_items_id_fk" FOREIGN KEY ("location_dropdown_item_id") REFERENCES "public"."dropdown_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dropdown_items_category_entity_idx" ON "dropdown_items" USING btree ("category_id","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_field_def_unique_key" ON "asset_field_definitions" USING btree ("asset_definition_id","key");--> statement-breakpoint
CREATE INDEX "assets_entity_idx" ON "assets" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "assets_definition_idx" ON "assets" USING btree ("asset_definition_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_inventory_number_unique" ON "assets" USING btree ("inventory_number") WHERE "assets"."inventory_number" IS NOT NULL;
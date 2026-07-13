CREATE TYPE "public"."asset_component_type" AS ENUM('cpu', 'ram', 'disk', 'gpu', 'psu', 'motherboard', 'nic', 'other');--> statement-breakpoint
CREATE TABLE "computers" (
	"asset_id" uuid PRIMARY KEY NOT NULL,
	"os_dropdown_item_id" uuid,
	"os_version_dropdown_item_id" uuid,
	"domain" text,
	"last_boot_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "network_equipment" (
	"asset_id" uuid PRIMARY KEY NOT NULL,
	"ip_address" text,
	"mac_address" text,
	"device_type_dropdown_item_id" uuid,
	"firmware_version" text,
	"ports_count" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"component_type" "asset_component_type" NOT NULL,
	"name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"capacity_value" integer,
	"capacity_unit" text,
	"serial_number" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "computers" ADD CONSTRAINT "computers_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "computers" ADD CONSTRAINT "computers_os_dropdown_item_id_dropdown_items_id_fk" FOREIGN KEY ("os_dropdown_item_id") REFERENCES "public"."dropdown_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "computers" ADD CONSTRAINT "computers_os_version_dropdown_item_id_dropdown_items_id_fk" FOREIGN KEY ("os_version_dropdown_item_id") REFERENCES "public"."dropdown_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_equipment" ADD CONSTRAINT "network_equipment_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_equipment" ADD CONSTRAINT "network_equipment_device_type_dropdown_item_id_dropdown_items_id_fk" FOREIGN KEY ("device_type_dropdown_item_id") REFERENCES "public"."dropdown_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_components" ADD CONSTRAINT "asset_components_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_components_asset_idx" ON "asset_components" USING btree ("asset_id");
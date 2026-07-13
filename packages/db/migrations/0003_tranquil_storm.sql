CREATE TYPE "public"."license_type" AS ENUM('per_seat', 'per_device', 'volume', 'subscription', 'oem', 'freeware');--> statement-breakpoint
CREATE TABLE "asset_software_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"software_version_id" uuid NOT NULL,
	"software_license_id" uuid,
	"install_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "software" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"name" text NOT NULL,
	"manufacturer_dropdown_item_id" uuid,
	"category_dropdown_item_id" uuid,
	"comment" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "software_licenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"software_id" uuid NOT NULL,
	"software_version_id" uuid,
	"name" text NOT NULL,
	"license_type" "license_type" NOT NULL,
	"serial_number" text,
	"seats_total" integer,
	"purchase_date" timestamp,
	"expiration_date" timestamp,
	"comment" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "software_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"software_id" uuid NOT NULL,
	"name" text NOT NULL,
	"os_dropdown_item_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset_software_installations" ADD CONSTRAINT "asset_software_installations_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_software_installations" ADD CONSTRAINT "asset_software_installations_software_version_id_software_versions_id_fk" FOREIGN KEY ("software_version_id") REFERENCES "public"."software_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_software_installations" ADD CONSTRAINT "asset_software_installations_software_license_id_software_licenses_id_fk" FOREIGN KEY ("software_license_id") REFERENCES "public"."software_licenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "software" ADD CONSTRAINT "software_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "software" ADD CONSTRAINT "software_manufacturer_dropdown_item_id_dropdown_items_id_fk" FOREIGN KEY ("manufacturer_dropdown_item_id") REFERENCES "public"."dropdown_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "software" ADD CONSTRAINT "software_category_dropdown_item_id_dropdown_items_id_fk" FOREIGN KEY ("category_dropdown_item_id") REFERENCES "public"."dropdown_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "software_licenses" ADD CONSTRAINT "software_licenses_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "software_licenses" ADD CONSTRAINT "software_licenses_software_id_software_id_fk" FOREIGN KEY ("software_id") REFERENCES "public"."software"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "software_licenses" ADD CONSTRAINT "software_licenses_software_version_id_software_versions_id_fk" FOREIGN KEY ("software_version_id") REFERENCES "public"."software_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "software_versions" ADD CONSTRAINT "software_versions_software_id_software_id_fk" FOREIGN KEY ("software_id") REFERENCES "public"."software"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "software_versions" ADD CONSTRAINT "software_versions_os_dropdown_item_id_dropdown_items_id_fk" FOREIGN KEY ("os_dropdown_item_id") REFERENCES "public"."dropdown_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "installations_unique" ON "asset_software_installations" USING btree ("asset_id","software_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "software_versions_unique" ON "software_versions" USING btree ("software_id","name");
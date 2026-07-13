CREATE TYPE "public"."certificate_type" AS ENUM('ssl', 'code_signing', 'other');--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"name" text NOT NULL,
	"certificate_type" "certificate_type" DEFAULT 'ssl' NOT NULL,
	"issuer" text,
	"serial_number" text,
	"valid_from" timestamp,
	"valid_until" timestamp,
	"assigned_asset_id" uuid,
	"comment" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_assigned_asset_id_assets_id_fk" FOREIGN KEY ("assigned_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;
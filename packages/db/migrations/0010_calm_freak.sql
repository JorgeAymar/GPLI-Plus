CREATE TYPE "public"."visibility_grantee_kind" AS ENUM('user', 'group', 'profile', 'entity');--> statement-breakpoint
CREATE TABLE "resource_visibility_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"grantee_kind" "visibility_grantee_kind" NOT NULL,
	"grantee_id" uuid NOT NULL,
	"is_recursive" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "resource_visibility_lookup_idx" ON "resource_visibility_rules" USING btree ("resource_type","resource_id");
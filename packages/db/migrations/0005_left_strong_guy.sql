CREATE TYPE "public"."sla_type" AS ENUM('tto', 'ttr');--> statement-breakpoint
CREATE TABLE "itil_sla_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"itil_type" "itil_type" NOT NULL,
	"itil_id" uuid NOT NULL,
	"sla_policy_id" uuid NOT NULL,
	"sla_type" "sla_type" NOT NULL,
	"due_at" timestamp NOT NULL,
	"is_breached" boolean DEFAULT false NOT NULL,
	"breached_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sla_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"tto_minutes" integer,
	"ttr_minutes" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "itil_sla_assignments" ADD CONSTRAINT "itil_sla_assignments_sla_policy_id_sla_policies_id_fk" FOREIGN KEY ("sla_policy_id") REFERENCES "public"."sla_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "itil_sla_assignments_lookup_idx" ON "itil_sla_assignments" USING btree ("itil_type","itil_id");--> statement-breakpoint
CREATE INDEX "itil_sla_assignments_sweep_idx" ON "itil_sla_assignments" USING btree ("is_breached","due_at");
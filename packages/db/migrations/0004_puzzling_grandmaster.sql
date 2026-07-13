CREATE TYPE "public"."itil_actor_kind" AS ENUM('user', 'group', 'supplier');--> statement-breakpoint
CREATE TYPE "public"."itil_actor_role" AS ENUM('requester', 'assignee', 'observer');--> statement-breakpoint
CREATE TYPE "public"."itil_status" AS ENUM('new', 'assigned', 'planned', 'pending', 'solved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."itil_timeline_item_type" AS ENUM('followup', 'task', 'solution', 'internal_note');--> statement-breakpoint
CREATE TYPE "public"."itil_type" AS ENUM('ticket', 'problem', 'change');--> statement-breakpoint
CREATE TYPE "public"."itil_validation_status" AS ENUM('waiting', 'approved', 'refused');--> statement-breakpoint
CREATE TYPE "public"."itil_validator_kind" AS ENUM('user', 'group');--> statement-breakpoint
CREATE TYPE "public"."ticket_type" AS ENUM('incident', 'request');--> statement-breakpoint
CREATE TABLE "itil_actors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"itil_type" "itil_type" NOT NULL,
	"itil_id" uuid NOT NULL,
	"actor_role" "itil_actor_role" NOT NULL,
	"actor_kind" "itil_actor_kind" NOT NULL,
	"actor_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itil_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"itil_type" "itil_type" NOT NULL,
	"itil_id" uuid NOT NULL,
	"cost_type" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"budget_id" uuid,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itil_timeline_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"itil_type" "itil_type" NOT NULL,
	"itil_id" uuid NOT NULL,
	"item_type" "itil_timeline_item_type" NOT NULL,
	"content" text NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"created_by" uuid NOT NULL,
	"time_spent_minutes" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itil_validations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"itil_type" "itil_type" NOT NULL,
	"itil_id" uuid NOT NULL,
	"validator_kind" "itil_validator_kind" NOT NULL,
	"validator_id" uuid NOT NULL,
	"status" "itil_validation_status" DEFAULT 'waiting' NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"responded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"status" "itil_status" DEFAULT 'new' NOT NULL,
	"urgency" integer DEFAULT 3 NOT NULL,
	"impact" integer DEFAULT 3 NOT NULL,
	"priority" integer DEFAULT 3 NOT NULL,
	"category_dropdown_item_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"solved_at" timestamp,
	"closed_at" timestamp,
	"ticket_type" "ticket_type" DEFAULT 'incident' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "problems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"status" "itil_status" DEFAULT 'new' NOT NULL,
	"urgency" integer DEFAULT 3 NOT NULL,
	"impact" integer DEFAULT 3 NOT NULL,
	"priority" integer DEFAULT 3 NOT NULL,
	"category_dropdown_item_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"solved_at" timestamp,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"status" "itil_status" DEFAULT 'new' NOT NULL,
	"urgency" integer DEFAULT 3 NOT NULL,
	"impact" integer DEFAULT 3 NOT NULL,
	"priority" integer DEFAULT 3 NOT NULL,
	"category_dropdown_item_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"solved_at" timestamp,
	"closed_at" timestamp,
	"planned_start_at" timestamp,
	"planned_end_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "itil_timeline_items" ADD CONSTRAINT "itil_timeline_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_category_dropdown_item_id_dropdown_items_id_fk" FOREIGN KEY ("category_dropdown_item_id") REFERENCES "public"."dropdown_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problems" ADD CONSTRAINT "problems_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problems" ADD CONSTRAINT "problems_category_dropdown_item_id_dropdown_items_id_fk" FOREIGN KEY ("category_dropdown_item_id") REFERENCES "public"."dropdown_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changes" ADD CONSTRAINT "changes_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changes" ADD CONSTRAINT "changes_category_dropdown_item_id_dropdown_items_id_fk" FOREIGN KEY ("category_dropdown_item_id") REFERENCES "public"."dropdown_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "itil_actors_lookup_idx" ON "itil_actors" USING btree ("itil_type","itil_id");--> statement-breakpoint
CREATE INDEX "itil_costs_lookup_idx" ON "itil_costs" USING btree ("itil_type","itil_id");--> statement-breakpoint
CREATE INDEX "itil_timeline_lookup_idx" ON "itil_timeline_items" USING btree ("itil_type","itil_id");--> statement-breakpoint
CREATE INDEX "itil_validations_lookup_idx" ON "itil_validations" USING btree ("itil_type","itil_id");
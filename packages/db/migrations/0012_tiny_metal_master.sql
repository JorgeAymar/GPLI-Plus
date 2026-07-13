CREATE TYPE "public"."rule_action_type" AS ENUM('assign', 'append', 'regex_result', 'stop_processing');--> statement-breakpoint
CREATE TYPE "public"."rule_criteria_operator" AS ENUM('is', 'contains', 'regex_match', 'less_than', 'greater_than', 'date_before', 'date_after');--> statement-breakpoint
CREATE TYPE "public"."rule_match_type" AS ENUM('all', 'any');--> statement-breakpoint
CREATE TABLE "dashboard_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dashboard_id" uuid NOT NULL,
	"card_key" text NOT NULL,
	"position_x" integer DEFAULT 0 NOT NULL,
	"position_y" integer DEFAULT 0 NOT NULL,
	"width" integer DEFAULT 4 NOT NULL,
	"height" integer DEFAULT 3 NOT NULL,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dashboards_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "rule_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"action_type" "rule_action_type" NOT NULL,
	"field" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_criteria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"field" text NOT NULL,
	"operator" "rule_criteria_operator" NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"rule_type" text NOT NULL,
	"name" text NOT NULL,
	"ranking" integer DEFAULT 0 NOT NULL,
	"match_type" "rule_match_type" DEFAULT 'all' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"stop_on_match" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dashboard_cards" ADD CONSTRAINT "dashboard_cards_dashboard_id_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_actions" ADD CONSTRAINT "rule_actions_rule_id_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_criteria" ADD CONSTRAINT "rule_criteria_rule_id_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;
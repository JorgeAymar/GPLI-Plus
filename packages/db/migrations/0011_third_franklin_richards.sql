CREATE TYPE "public"."project_task_link_type" AS ENUM('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish');--> statement-breakpoint
CREATE TYPE "public"."project_team_member_kind" AS ENUM('user', 'group', 'supplier', 'contact');--> statement-breakpoint
CREATE TYPE "public"."project_team_member_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TYPE "public"."saved_search_alert_operator" AS ENUM('lt', 'lte', 'eq', 'gt', 'gte', 'neq');--> statement-breakpoint
CREATE TYPE "public"."saved_search_do_count" AS ENUM('no', 'yes', 'auto');--> statement-breakpoint
CREATE TYPE "public"."saved_search_type" AS ENUM('bookmark', 'alert');--> statement-breakpoint
CREATE TABLE "kb_article_categories" (
	"article_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "kb_article_categories_article_id_category_id_pk" PRIMARY KEY("article_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "kb_article_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"parent_comment_id" uuid,
	"author_user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"is_faq" boolean DEFAULT false NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"author_user_id" uuid NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"show_in_service_catalog" boolean DEFAULT false NOT NULL,
	"begin_date" timestamp,
	"end_date" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"comment" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reservation_items_asset_id_unique" UNIQUE("asset_id")
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_item_id" uuid NOT NULL,
	"begin_at" timestamp NOT NULL,
	"end_at" timestamp NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"comment" text,
	"series_group_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"budget_id" uuid,
	"begin_date" timestamp,
	"end_date" timestamp,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_task_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_task_id" uuid NOT NULL,
	"target_task_id" uuid NOT NULL,
	"link_type" "project_task_link_type" DEFAULT 'finish_to_start' NOT NULL,
	"lag_minutes" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"parent_task_id" uuid,
	"name" text NOT NULL,
	"project_task_state_dropdown_item_id" uuid,
	"planned_duration_minutes" integer,
	"effective_duration_minutes" integer,
	"percent_done" integer DEFAULT 0 NOT NULL,
	"auto_percent_done" boolean DEFAULT false NOT NULL,
	"is_milestone" boolean DEFAULT false NOT NULL,
	"plan_start_at" timestamp,
	"plan_end_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"member_kind" "project_team_member_kind" NOT NULL,
	"member_id" uuid NOT NULL,
	"role" "project_team_member_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"parent_project_id" uuid,
	"name" text NOT NULL,
	"code" text,
	"priority" integer DEFAULT 3 NOT NULL,
	"project_state_dropdown_item_id" uuid,
	"project_type_dropdown_item_id" uuid,
	"plan_start_at" timestamp,
	"plan_end_at" timestamp,
	"actual_start_at" timestamp,
	"actual_end_at" timestamp,
	"percent_done" integer DEFAULT 0 NOT NULL,
	"auto_percent_done" boolean DEFAULT false NOT NULL,
	"is_template" boolean DEFAULT false NOT NULL,
	"manager_user_id" uuid,
	"group_id" uuid,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_search_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"saved_search_id" uuid NOT NULL,
	"operator" "saved_search_alert_operator" NOT NULL,
	"threshold_value" integer NOT NULL,
	"frequency_minutes" integer DEFAULT 60 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_checked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"item_type" text NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"is_private" boolean DEFAULT true NOT NULL,
	"entity_id" uuid NOT NULL,
	"is_recursive" boolean DEFAULT false NOT NULL,
	"query_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"type" "saved_search_type" DEFAULT 'bookmark' NOT NULL,
	"do_count" "saved_search_do_count" DEFAULT 'auto' NOT NULL,
	"last_execution_at" timestamp,
	"execution_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rss_feed_cached_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feed_id" uuid NOT NULL,
	"title" text NOT NULL,
	"link" text NOT NULL,
	"published_at" timestamp,
	"description" text,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rss_feeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"url" text NOT NULL,
	"refresh_rate_minutes" integer DEFAULT 1440 NOT NULL,
	"max_items" integer DEFAULT 20 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"have_error" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kb_article_categories" ADD CONSTRAINT "kb_article_categories_article_id_kb_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."kb_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_article_categories" ADD CONSTRAINT "kb_article_categories_category_id_kb_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."kb_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_article_comments" ADD CONSTRAINT "kb_article_comments_article_id_kb_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."kb_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_article_comments" ADD CONSTRAINT "kb_article_comments_parent_comment_id_kb_article_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."kb_article_comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_article_comments" ADD CONSTRAINT "kb_article_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_categories" ADD CONSTRAINT "kb_categories_parent_id_kb_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."kb_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_items" ADD CONSTRAINT "reservation_items_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_reservation_item_id_reservation_items_id_fk" FOREIGN KEY ("reservation_item_id") REFERENCES "public"."reservation_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_costs" ADD CONSTRAINT "project_costs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_costs" ADD CONSTRAINT "project_costs_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_task_links" ADD CONSTRAINT "project_task_links_source_task_id_project_tasks_id_fk" FOREIGN KEY ("source_task_id") REFERENCES "public"."project_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_task_links" ADD CONSTRAINT "project_task_links_target_task_id_project_tasks_id_fk" FOREIGN KEY ("target_task_id") REFERENCES "public"."project_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_parent_task_id_project_tasks_id_fk" FOREIGN KEY ("parent_task_id") REFERENCES "public"."project_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_project_task_state_dropdown_item_id_dropdown_items_id_fk" FOREIGN KEY ("project_task_state_dropdown_item_id") REFERENCES "public"."dropdown_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_team_members" ADD CONSTRAINT "project_team_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_parent_project_id_projects_id_fk" FOREIGN KEY ("parent_project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_project_state_dropdown_item_id_dropdown_items_id_fk" FOREIGN KEY ("project_state_dropdown_item_id") REFERENCES "public"."dropdown_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_project_type_dropdown_item_id_dropdown_items_id_fk" FOREIGN KEY ("project_type_dropdown_item_id") REFERENCES "public"."dropdown_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_search_alerts" ADD CONSTRAINT "saved_search_alerts_saved_search_id_saved_searches_id_fk" FOREIGN KEY ("saved_search_id") REFERENCES "public"."saved_searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rss_feed_cached_items" ADD CONSTRAINT "rss_feed_cached_items_feed_id_rss_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."rss_feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rss_feeds" ADD CONSTRAINT "rss_feeds_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reservations_item_range_idx" ON "reservations" USING btree ("reservation_item_id","begin_at","end_at");--> statement-breakpoint
CREATE INDEX "project_task_links_source_idx" ON "project_task_links" USING btree ("source_task_id");--> statement-breakpoint
CREATE INDEX "project_task_links_target_idx" ON "project_task_links" USING btree ("target_task_id");--> statement-breakpoint
CREATE INDEX "project_team_members_project_idx" ON "project_team_members" USING btree ("project_id");
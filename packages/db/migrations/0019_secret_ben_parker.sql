ALTER TABLE "computers" DROP COLUMN "last_boot_at";--> statement-breakpoint
ALTER TABLE "saved_searches" DROP COLUMN "last_execution_at";--> statement-breakpoint
ALTER TABLE "saved_searches" DROP COLUMN "execution_count";--> statement-breakpoint
ALTER TABLE "rss_feed_cached_items" DROP COLUMN "fetched_at";--> statement-breakpoint
ALTER TABLE "inventory_locked_fields" DROP COLUMN "locked_at";--> statement-breakpoint
ALTER TABLE "impact_contexts" DROP COLUMN "max_depth";
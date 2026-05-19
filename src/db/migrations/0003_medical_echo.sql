DROP INDEX `idx_failures_recall`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_failures_recall_unique` ON `enrichment_failures` (`recall_id`);
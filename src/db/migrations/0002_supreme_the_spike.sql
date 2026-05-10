CREATE TABLE `enrichment_failures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recall_id` integer NOT NULL,
	`error` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_attempt_at` text NOT NULL,
	`resolved` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`recall_id`) REFERENCES `recalls`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_failures_recall` ON `enrichment_failures` (`recall_id`);--> statement-breakpoint
CREATE INDEX `idx_failures_resolved` ON `enrichment_failures` (`resolved`);--> statement-breakpoint
ALTER TABLE `recalls` ADD `enrichment_quality_score` integer;--> statement-breakpoint
ALTER TABLE `recalls` ADD `enrichment_model` text;--> statement-breakpoint
CREATE INDEX `idx_recalls_quality` ON `recalls` (`enrichment_quality_score`);
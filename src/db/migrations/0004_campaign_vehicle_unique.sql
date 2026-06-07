-- Add enrichment quality tracking columns
ALTER TABLE `recalls` ADD COLUMN `enrichment_quality_score` integer;--> statement-breakpoint
ALTER TABLE `recalls` ADD COLUMN `enrichment_model` text;--> statement-breakpoint

-- Add quality index
CREATE INDEX `idx_recalls_quality` ON `recalls` (`enrichment_quality_score`);--> statement-breakpoint

-- Drop old single-column unique constraint on campaign number
DROP INDEX `recalls_nhtsa_campaign_number_unique`;--> statement-breakpoint

-- Add composite unique index so one campaign can span multiple vehicles
CREATE UNIQUE INDEX `idx_recalls_campaign_vy` ON `recalls` (`nhtsa_campaign_number`, `vehicle_year_id`);

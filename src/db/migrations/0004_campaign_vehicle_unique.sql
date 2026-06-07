-- Drop old single-column unique constraint on campaign number
DROP INDEX `recalls_nhtsa_campaign_number_unique`;--> statement-breakpoint

-- Add composite unique index so one campaign can span multiple vehicles
CREATE UNIQUE INDEX `idx_recalls_campaign_vy` ON `recalls` (`nhtsa_campaign_number`, `vehicle_year_id`);

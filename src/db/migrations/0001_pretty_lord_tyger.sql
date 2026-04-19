ALTER TABLE `vehicle_years` ADD `last_ingested_at` text;--> statement-breakpoint
CREATE INDEX `idx_vy_last_ingested` ON `vehicle_years` (`last_ingested_at`);
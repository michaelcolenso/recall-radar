-- Allow one recall campaign to span multiple model/year combinations.
-- Drops the overly restrictive unique constraint on campaign number alone
-- and replaces it with a composite unique index on (campaign, vehicle_year).

DROP INDEX IF EXISTS `recalls_nhtsa_campaign_number_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_recalls_campaign_vy` ON `recalls` (`nhtsa_campaign_number`,`vehicle_year_id`);
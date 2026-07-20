CREATE TABLE `affiliate_clicks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`partner` text NOT NULL,
	`placement` text NOT NULL,
	`page_path` text NOT NULL,
	`vin_prefix` text,
	`referer` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_aff_clicks_partner_created` ON `affiliate_clicks` (`partner`,`created_at`);

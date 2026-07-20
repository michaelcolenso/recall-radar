CREATE TABLE `alert_digest_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`recalls_matched` integer DEFAULT 0,
	`emails_sent` integer DEFAULT 0,
	`status` text DEFAULT 'running' NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `idx_alert_digest_runs_status` ON `alert_digest_runs` (`status`);--> statement-breakpoint
CREATE TABLE `alert_sends` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subscription_id` integer NOT NULL,
	`recall_id` integer NOT NULL,
	`digest_run` text NOT NULL,
	`resend_id` text,
	`status` text DEFAULT 'sent' NOT NULL,
	`sent_at` text,
	FOREIGN KEY (`subscription_id`) REFERENCES `alert_subscriptions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recall_id`) REFERENCES `recalls`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_alert_sends_sub_recall` ON `alert_sends` (`subscription_id`,`recall_id`);--> statement-breakpoint
CREATE INDEX `idx_alert_sends_digest_run` ON `alert_sends` (`digest_run`);--> statement-breakpoint
CREATE TABLE `alert_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`vehicle_year_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`confirm_token` text NOT NULL,
	`unsub_token` text NOT NULL,
	`source` text,
	`ip_hash` text,
	`created_at` text NOT NULL,
	`confirmed_at` text,
	`unsubscribed_at` text,
	`last_sent_at` text,
	FOREIGN KEY (`vehicle_year_id`) REFERENCES `vehicle_years`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alert_subscriptions_confirm_token_unique` ON `alert_subscriptions` (`confirm_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `alert_subscriptions_unsub_token_unique` ON `alert_subscriptions` (`unsub_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_alert_subs_email_vy` ON `alert_subscriptions` (`email`,`vehicle_year_id`);--> statement-breakpoint
CREATE INDEX `idx_alert_subs_status` ON `alert_subscriptions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_alert_subs_vy_status` ON `alert_subscriptions` (`vehicle_year_id`,`status`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window_start` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL
);

CREATE TABLE `ingestion_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_type` text NOT NULL,
	`target_make` text,
	`status` text NOT NULL,
	`records_found` integer DEFAULT 0,
	`records_saved` integer DEFAULT 0,
	`error_message` text,
	`started_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_logs_type_status` ON `ingestion_logs` (`run_type`,`status`);--> statement-breakpoint
CREATE TABLE `makes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`nhtsa_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `makes_name_unique` ON `makes` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `makes_slug_unique` ON `makes` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `makes_nhtsa_id_unique` ON `makes` (`nhtsa_id`);--> statement-breakpoint
CREATE INDEX `idx_makes_slug` ON `makes` (`slug`);--> statement-breakpoint
CREATE TABLE `models` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`make_id` integer NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`make_id`) REFERENCES `makes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_models_make_slug` ON `models` (`make_id`,`slug`);--> statement-breakpoint
CREATE INDEX `idx_models_make_id` ON `models` (`make_id`);--> statement-breakpoint
CREATE INDEX `idx_models_slug` ON `models` (`slug`);--> statement-breakpoint
CREATE TABLE `recalls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vehicle_year_id` integer NOT NULL,
	`nhtsa_campaign_number` text NOT NULL,
	`report_received_date` text,
	`component` text NOT NULL,
	`manufacturer` text,
	`summary_raw` text NOT NULL,
	`consequence_raw` text NOT NULL,
	`remedy_raw` text NOT NULL,
	`summary_enriched` text,
	`consequence_enriched` text,
	`remedy_enriched` text,
	`enriched_at` text,
	`severity_level` text DEFAULT 'UNKNOWN' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`vehicle_year_id`) REFERENCES `vehicle_years`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recalls_nhtsa_campaign_number_unique` ON `recalls` (`nhtsa_campaign_number`);--> statement-breakpoint
CREATE INDEX `idx_recalls_vy_id` ON `recalls` (`vehicle_year_id`);--> statement-breakpoint
CREATE INDEX `idx_recalls_campaign` ON `recalls` (`nhtsa_campaign_number`);--> statement-breakpoint
CREATE INDEX `idx_recalls_component` ON `recalls` (`component`);--> statement-breakpoint
CREATE INDEX `idx_recalls_severity` ON `recalls` (`severity_level`);--> statement-breakpoint
CREATE TABLE `vehicle_years` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`model_id` integer NOT NULL,
	`year` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_vy_model_year` ON `vehicle_years` (`model_id`,`year`);--> statement-breakpoint
CREATE INDEX `idx_vy_model_id` ON `vehicle_years` (`model_id`);--> statement-breakpoint
CREATE INDEX `idx_vy_year` ON `vehicle_years` (`year`);
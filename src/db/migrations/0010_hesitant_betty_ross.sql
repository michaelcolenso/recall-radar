CREATE TABLE `vehicle_lookup_checks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`model_id` integer NOT NULL,
	`year` integer NOT NULL,
	`checked_at` text NOT NULL,
	FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_lookup_model_year` ON `vehicle_lookup_checks` (`model_id`,`year`);
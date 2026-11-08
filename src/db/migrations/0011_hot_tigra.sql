CREATE TABLE `vehicle_year_aliases` (
	`source_id` integer PRIMARY KEY NOT NULL,
	`canonical_id` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `vehicle_years`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`canonical_id`) REFERENCES `vehicle_years`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `conversion_counts` (
	`day` text NOT NULL,
	`event` text NOT NULL,
	`page_type` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `event`, `page_type`)
);

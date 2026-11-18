CREATE TABLE `time_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`duration_ms` integer NOT NULL,
	`date` integer NOT NULL,
	`source_id` text
);
--> statement-breakpoint
CREATE INDEX `time_entries_date_idx` ON `time_entries` (`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `time_entries_source_idx` ON `time_entries` (`source_id`);--> statement-breakpoint
CREATE TABLE `time_tracker_session` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`started_at` integer NOT NULL
);

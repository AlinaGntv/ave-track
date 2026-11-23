CREATE TABLE `lead_outreach_daily` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`touches` integer DEFAULT 0 NOT NULL,
	`replies` integer DEFAULT 0 NOT NULL,
	`tests` integer DEFAULT 0 NOT NULL,
	`works` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lead_outreach_daily_date_unique` ON `lead_outreach_daily` (`date`);
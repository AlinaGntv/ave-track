CREATE TABLE `leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`company` text,
	`contact` text,
	`source` text,
	`stage` text DEFAULT 'new' NOT NULL,
	`qualification` text DEFAULT 'unreviewed' NOT NULL,
	`potential_cents` integer,
	`next_follow_up` text,
	`next_action` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `leads_stage_idx` ON `leads` (`stage`);--> statement-breakpoint
CREATE INDEX `leads_follow_up_idx` ON `leads` (`next_follow_up`);--> statement-breakpoint
CREATE INDEX `leads_created_idx` ON `leads` (`created_at`);
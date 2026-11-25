CREATE TABLE `personal_goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`category` text DEFAULT 'personal' NOT NULL,
	`deadline` text,
	`target_cents` integer,
	`saved_cents` integer DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `personal_goals_deadline_idx` ON `personal_goals` (`deadline`,`completed`);
CREATE TABLE `sport_food_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` integer NOT NULL,
	`date` text NOT NULL,
	`name` text NOT NULL,
	`calories` integer DEFAULT 0 NOT NULL,
	`protein` real DEFAULT 0 NOT NULL,
	`carbs` real DEFAULT 0 NOT NULL,
	`fat` real DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `sport_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sport_food_entries_profile_date_idx` ON `sport_food_entries` (`profile_id`,`date`,`id`);--> statement-breakpoint
CREATE TABLE `sport_nutrition_goals` (
	`profile_id` integer PRIMARY KEY NOT NULL,
	`calories` integer,
	`protein` real,
	`carbs` real,
	`fat` real,
	FOREIGN KEY (`profile_id`) REFERENCES `sport_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);

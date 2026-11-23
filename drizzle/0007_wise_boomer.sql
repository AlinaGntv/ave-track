CREATE TABLE `sport_activity_days` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` integer NOT NULL,
	`date` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `sport_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sport_activity_day_unique` ON `sport_activity_days` (`profile_id`,`date`);--> statement-breakpoint
CREATE TABLE `sport_exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` integer NOT NULL,
	`day_label` text DEFAULT 'A' NOT NULL,
	`title` text NOT NULL,
	`sets` integer DEFAULT 3 NOT NULL,
	`reps` integer DEFAULT 10 NOT NULL,
	`weight_kg` real,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `sport_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sport_exercises_profile_day_idx` ON `sport_exercises` (`profile_id`,`day_label`,`sort_order`);--> statement-breakpoint
CREATE TABLE `sport_measurements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` integer NOT NULL,
	`date` text NOT NULL,
	`weight_kg` real,
	`chest_cm` real,
	`waist_cm` real,
	`hips_cm` real,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `sport_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sport_measurements_profile_date_unique` ON `sport_measurements` (`profile_id`,`date`);--> statement-breakpoint
CREATE TABLE `sport_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`activity` text NOT NULL,
	`height_cm` real,
	`target_weight_kg` real,
	`workout_interval_days` integer DEFAULT 2 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sport_workout_exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workout_id` integer NOT NULL,
	`exercise_id` integer,
	`title` text NOT NULL,
	`target_sets` integer NOT NULL,
	`target_reps` integer NOT NULL,
	`target_weight_kg` real,
	`actual_reps` integer,
	`actual_weight_kg` real,
	`completed` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`workout_id`) REFERENCES `sport_workouts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `sport_exercises`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `sport_workout_exercises_workout_idx` ON `sport_workout_exercises` (`workout_id`);--> statement-breakpoint
CREATE TABLE `sport_workouts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` integer NOT NULL,
	`date` text NOT NULL,
	`day_label` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `sport_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sport_workouts_profile_date_idx` ON `sport_workouts` (`profile_id`,`date`);
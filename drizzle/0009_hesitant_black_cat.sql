ALTER TABLE `sport_exercises` ADD `unit` text DEFAULT 'повторов' NOT NULL;--> statement-breakpoint
ALTER TABLE `sport_workout_exercises` ADD `target_unit` text DEFAULT 'повторов' NOT NULL;
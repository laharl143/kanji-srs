CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `assignments` (
	`user_id` text NOT NULL,
	`subject_id` integer NOT NULL,
	`srs_stage` integer DEFAULT 0 NOT NULL,
	`unlocked_at` integer NOT NULL,
	`started_at` integer,
	`available_at` integer,
	`passed_at` integer,
	`burned_at` integer,
	PRIMARY KEY(`user_id`, `subject_id`)
);
--> statement-breakpoint
CREATE INDEX `assignments_user_available_idx` ON `assignments` (`user_id`,`available_at`);--> statement-breakpoint
CREATE INDEX `assignments_user_stage_idx` ON `assignments` (`user_id`,`srs_stage`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`subject_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`starting_stage` integer NOT NULL,
	`ending_stage` integer NOT NULL,
	`incorrect_meaning_count` integer NOT NULL,
	`incorrect_reading_count` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reviews_user_created_idx` ON `reviews` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` integer PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`characters` text NOT NULL,
	`level` integer NOT NULL,
	`position` integer NOT NULL,
	`meanings` text NOT NULL,
	`readings` text NOT NULL,
	`component_ids` text NOT NULL,
	`meaning_mnemonic` text NOT NULL,
	`reading_mnemonic` text,
	`jlpt` integer,
	`frequency` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subjects_type_characters_uq` ON `subjects` (`type`,`characters`);--> statement-breakpoint
CREATE INDEX `subjects_level_type_position_idx` ON `subjects` (`level`,`type`,`position`);--> statement-breakpoint
CREATE TABLE `user_notes` (
	`user_id` text NOT NULL,
	`subject_id` integer NOT NULL,
	`meaning_note` text,
	`reading_note` text,
	`synonyms` text DEFAULT '[]' NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `subject_id`)
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`current_level` integer DEFAULT 1 NOT NULL,
	`lesson_batch_size` integer DEFAULT 5 NOT NULL,
	`reminder_daily_enabled` integer DEFAULT true NOT NULL,
	`reminder_daily_time` text DEFAULT '08:00' NOT NULL,
	`reminder_due_enabled` integer DEFAULT true NOT NULL,
	`quiet_hours_start` text DEFAULT '22:00' NOT NULL,
	`quiet_hours_end` text DEFAULT '08:00' NOT NULL,
	`created_at` integer NOT NULL
);

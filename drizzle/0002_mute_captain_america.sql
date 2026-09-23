CREATE TABLE `schedule_targets` (
	`id` text PRIMARY KEY NOT NULL,
	`schedule_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `schedule_targets_schedule_idx` ON `schedule_targets` (`schedule_id`);--> statement-breakpoint
CREATE INDEX `schedule_targets_type_idx` ON `schedule_targets` (`target_type`);--> statement-breakpoint
CREATE INDEX `schedule_targets_target_idx` ON `schedule_targets` (`target_id`);--> statement-breakpoint
ALTER TABLE `devices` ADD `pairing_secret_hash` text;--> statement-breakpoint
ALTER TABLE `devices` ADD `device_token_expires_at` text;--> statement-breakpoint
ALTER TABLE `devices` ADD `display_type` text DEFAULT 'TV' NOT NULL;--> statement-breakpoint
ALTER TABLE `devices` ADD `interaction_mode` text DEFAULT 'PASSIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE `devices` ADD `timezone` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `timezone` text DEFAULT 'UTC' NOT NULL;
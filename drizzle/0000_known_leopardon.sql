CREATE TABLE `activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`resource` text NOT NULL,
	`resource_id` text,
	`ip` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `content_assets` (
	`content_id` text NOT NULL,
	`media_asset_id` text NOT NULL,
	`role` text DEFAULT 'primary' NOT NULL,
	PRIMARY KEY(`content_id`, `media_asset_id`),
	FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `contents` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`duration_ms` integer DEFAULT 10000 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`valid_from` text,
	`valid_to` text,
	`tenant_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `contents_type_idx` ON `contents` (`type`);--> statement-breakpoint
CREATE TABLE `device_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text,
	`device_group_id` text,
	`playlist_id` text NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`device_group_id`) REFERENCES `device_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `assignments_device_idx` ON `device_assignments` (`device_id`);--> statement-breakpoint
CREATE INDEX `assignments_playlist_idx` ON `device_assignments` (`playlist_id`);--> statement-breakpoint
CREATE TABLE `device_group_members` (
	`group_id` text NOT NULL,
	`device_id` text NOT NULL,
	PRIMARY KEY(`group_id`, `device_id`),
	FOREIGN KEY (`group_id`) REFERENCES `device_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `device_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`tenant_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`device_code` text,
	`name` text,
	`location` text,
	`description` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`activation_code` text,
	`activation_expires_at` text,
	`device_token_hash` text,
	`current_playlist_id` text,
	`software_version` text,
	`screen_resolution` text,
	`orientation` text DEFAULT 'landscape' NOT NULL,
	`last_seen_at` text,
	`manifest_version` integer DEFAULT 0 NOT NULL,
	`player_state` text,
	`tenant_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `devices_device_code_unique` ON `devices` (`device_code`);--> statement-breakpoint
CREATE INDEX `devices_code_idx` ON `devices` (`device_code`);--> statement-breakpoint
CREATE INDEX `devices_status_idx` ON `devices` (`status`);--> statement-breakpoint
CREATE INDEX `devices_last_seen_idx` ON `devices` (`last_seen_at`);--> statement-breakpoint
CREATE INDEX `devices_playlist_idx` ON `devices` (`current_playlist_id`);--> statement-breakpoint
CREATE INDEX `devices_activation_idx` ON `devices` (`activation_code`);--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`storage_provider` text NOT NULL,
	`storage_key` text NOT NULL,
	`url` text NOT NULL,
	`width` integer,
	`height` integer,
	`duration_ms` integer,
	`checksum` text NOT NULL,
	`tenant_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `playlist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`playlist_id` text NOT NULL,
	`content_id` text NOT NULL,
	`position` integer NOT NULL,
	`duration_override_ms` integer,
	`active` integer DEFAULT true NOT NULL,
	`transition` text DEFAULT 'fade' NOT NULL,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `playlist_items_playlist_idx` ON `playlist_items` (`playlist_id`);--> statement-breakpoint
CREATE INDEX `playlist_items_content_idx` ON `playlist_items` (`content_id`);--> statement-breakpoint
CREATE TABLE `playlists` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`tenant_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`playlist_id` text,
	`content_id` text,
	`start_at` text,
	`end_at` text,
	`days_of_week` text DEFAULT '[]' NOT NULL,
	`start_time` text,
	`end_time` text,
	`priority` text DEFAULT 'NORMAL' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`tenant_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `schedules_playlist_idx` ON `schedules` (`playlist_id`);--> statement-breakpoint
CREATE INDEX `schedules_priority_idx` ON `schedules` (`priority`);--> statement-breakpoint
CREATE TABLE `system_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'ADMIN' NOT NULL,
	`tenant_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_uidx` ON `tenants` (`slug`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_devices` (
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
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_devices`("id", "device_code", "name", "location", "description", "status", "activation_code", "activation_expires_at", "device_token_hash", "current_playlist_id", "software_version", "screen_resolution", "orientation", "last_seen_at", "manifest_version", "player_state", "tenant_id", "created_at", "updated_at") SELECT "id", "device_code", "name", "location", "description", "status", "activation_code", "activation_expires_at", "device_token_hash", "current_playlist_id", "software_version", "screen_resolution", "orientation", "last_seen_at", "manifest_version", "player_state", "tenant_id", "created_at", "updated_at" FROM `devices`;--> statement-breakpoint
DROP TABLE `devices`;--> statement-breakpoint
ALTER TABLE `__new_devices` RENAME TO `devices`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `devices_tenant_code_uidx` ON `devices` (`tenant_id`,`device_code`);--> statement-breakpoint
CREATE INDEX `devices_code_idx` ON `devices` (`device_code`);--> statement-breakpoint
CREATE INDEX `devices_status_idx` ON `devices` (`status`);--> statement-breakpoint
CREATE INDEX `devices_last_seen_idx` ON `devices` (`last_seen_at`);--> statement-breakpoint
CREATE INDEX `devices_playlist_idx` ON `devices` (`current_playlist_id`);--> statement-breakpoint
CREATE INDEX `devices_activation_idx` ON `devices` (`activation_code`);--> statement-breakpoint
CREATE INDEX `devices_tenant_idx` ON `devices` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'ADMIN' NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "email", "name", "password_hash", "role", "tenant_id", "created_at", "updated_at") SELECT "id", "email", "name", "password_hash", "role", "tenant_id", "created_at", "updated_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_tenant_email_uidx` ON `users` (`tenant_id`,`email`);--> statement-breakpoint
CREATE INDEX `users_tenant_idx` ON `users` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `__new_contents` (
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
	`tenant_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_contents`("id", "type", "title", "description", "status", "payload", "duration_ms", "version", "valid_from", "valid_to", "tenant_id", "created_at", "updated_at") SELECT "id", "type", "title", "description", "status", "payload", "duration_ms", "version", "valid_from", "valid_to", "tenant_id", "created_at", "updated_at" FROM `contents`;--> statement-breakpoint
DROP TABLE `contents`;--> statement-breakpoint
ALTER TABLE `__new_contents` RENAME TO `contents`;--> statement-breakpoint
CREATE INDEX `contents_type_idx` ON `contents` (`type`);--> statement-breakpoint
CREATE INDEX `contents_tenant_idx` ON `contents` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `__new_device_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`tenant_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_device_groups`("id", "name", "description", "tenant_id", "created_at", "updated_at") SELECT "id", "name", "description", "tenant_id", "created_at", "updated_at" FROM `device_groups`;--> statement-breakpoint
DROP TABLE `device_groups`;--> statement-breakpoint
ALTER TABLE `__new_device_groups` RENAME TO `device_groups`;--> statement-breakpoint
CREATE INDEX `device_groups_tenant_idx` ON `device_groups` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `__new_media_assets` (
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
	`tenant_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_media_assets`("id", "file_name", "mime_type", "file_size", "storage_provider", "storage_key", "url", "width", "height", "duration_ms", "checksum", "tenant_id", "created_at") SELECT "id", "file_name", "mime_type", "file_size", "storage_provider", "storage_key", "url", "width", "height", "duration_ms", "checksum", "tenant_id", "created_at" FROM `media_assets`;--> statement-breakpoint
DROP TABLE `media_assets`;--> statement-breakpoint
ALTER TABLE `__new_media_assets` RENAME TO `media_assets`;--> statement-breakpoint
CREATE INDEX `media_assets_tenant_idx` ON `media_assets` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `__new_playlists` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_playlists`("id", "name", "description", "version", "status", "tenant_id", "created_at", "updated_at") SELECT "id", "name", "description", "version", "status", "tenant_id", "created_at", "updated_at" FROM `playlists`;--> statement-breakpoint
DROP TABLE `playlists`;--> statement-breakpoint
ALTER TABLE `__new_playlists` RENAME TO `playlists`;--> statement-breakpoint
CREATE INDEX `playlists_tenant_idx` ON `playlists` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `__new_schedules` (
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
	`tenant_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_schedules`("id", "name", "playlist_id", "content_id", "start_at", "end_at", "days_of_week", "start_time", "end_time", "priority", "active", "tenant_id", "created_at", "updated_at") SELECT "id", "name", "playlist_id", "content_id", "start_at", "end_at", "days_of_week", "start_time", "end_time", "priority", "active", "tenant_id", "created_at", "updated_at" FROM `schedules`;--> statement-breakpoint
DROP TABLE `schedules`;--> statement-breakpoint
ALTER TABLE `__new_schedules` RENAME TO `schedules`;--> statement-breakpoint
CREATE INDEX `schedules_playlist_idx` ON `schedules` (`playlist_id`);--> statement-breakpoint
CREATE INDEX `schedules_priority_idx` ON `schedules` (`priority`);--> statement-breakpoint
CREATE INDEX `schedules_tenant_idx` ON `schedules` (`tenant_id`);--> statement-breakpoint
ALTER TABLE `activity_logs` ADD `tenant_id` text REFERENCES tenants(id);--> statement-breakpoint
CREATE INDEX `activity_logs_tenant_idx` ON `activity_logs` (`tenant_id`);
-- RUNTIME-PLAYBACK-09 — Durable device command inbox.
-- Additive only. No Production application in this phase.

CREATE TABLE IF NOT EXISTS `device_command_inbox` (
	`id` text PRIMARY KEY NOT NULL,
	`command_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`device_id` text NOT NULL,
	`session_id` text,
	`binding` text DEFAULT 'SESSION_BOUND' NOT NULL,
	`type` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`issued_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`status` text DEFAULT 'QUEUED' NOT NULL,
	`result_status` text,
	`result_reason` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`available_at` integer NOT NULL,
	`claimed_at` integer,
	`lease_until` integer,
	`correlation_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `device_command_inbox_command_id_uidx` ON `device_command_inbox` (`command_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `device_command_inbox_tenant_device_status_idx` ON `device_command_inbox` (`tenant_id`, `device_id`, `status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `device_command_inbox_device_status_available_idx` ON `device_command_inbox` (`device_id`, `status`, `available_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `device_command_inbox_expires_idx` ON `device_command_inbox` (`expires_at`);

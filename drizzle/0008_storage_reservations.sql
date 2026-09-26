-- PLATFORM-IDENTITY-10I — Storage reservation foundation + checksum integrity.
-- Additive only. No enforcement. No upload behavior change.
-- Journal: drizzle/meta/_journal.json historically ends at 0002 while
-- 0003–0007 SQL files exist (ensureSchema is the runtime path). This file
-- continues as 0008 and is journaled. Do not rewrite historical migrations.

CREATE TABLE IF NOT EXISTS `storage_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`operation_id` text NOT NULL,
	`expected_bytes` integer NOT NULL,
	`status` text DEFAULT 'RESERVED' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`expires_at` text,
	`committed_at` text,
	`released_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `storage_reservations_tenant_operation_uidx` ON `storage_reservations` (`tenant_id`, `operation_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `storage_reservations_tenant_idx` ON `storage_reservations` (`tenant_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `storage_reservations_tenant_status_idx` ON `storage_reservations` (`tenant_id`, `status`);
--> statement-breakpoint
-- Closes schema.ts vs SQL gap for tenant+checksum uniqueness (PI-10H audit).
CREATE UNIQUE INDEX IF NOT EXISTS `media_assets_tenant_checksum_uidx` ON `media_assets` (`tenant_id`, `checksum`);

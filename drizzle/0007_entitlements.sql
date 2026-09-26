-- PLATFORM-IDENTITY-10B — Entitlements foundation (additive only).
-- Journal note: drizzle/meta/_journal.json currently ends at 0002 while
-- 0003–0006 SQL files exist (ensureSchema is the runtime path). This file
-- continues numbering as 0007. Do not rewrite historical migrations.
-- No enforcement. No billing. No RBAC/JWT changes.

CREATE TABLE IF NOT EXISTS `entitlement_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`value_type` text NOT NULL,
	`enforcement_type` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `entitlement_definitions_key_uidx` ON `entitlement_definitions` (`key`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `entitlement_definitions_active_idx` ON `entitlement_definitions` (`active`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `plans_key_uidx` ON `plans` (`key`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `plans_active_idx` ON `plans` (`active`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `plan_entitlements` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`entitlement_definition_id` text NOT NULL,
	`value` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`entitlement_definition_id`) REFERENCES `entitlement_definitions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `plan_entitlements_plan_def_uidx` ON `plan_entitlements` (`plan_id`, `entitlement_definition_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `plan_entitlements_plan_idx` ON `plan_entitlements` (`plan_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `plan_entitlements_def_idx` ON `plan_entitlements` (`entitlement_definition_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tenant_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`starts_at` text DEFAULT (datetime('now')) NOT NULL,
	`ends_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tenant_plans_tenant_idx` ON `tenant_plans` (`tenant_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tenant_plans_plan_idx` ON `tenant_plans` (`plan_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tenant_plans_status_idx` ON `tenant_plans` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tenant_plans_tenant_status_idx` ON `tenant_plans` (`tenant_id`, `status`);

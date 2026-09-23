CREATE TABLE IF NOT EXISTS `memberships` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `tenant_id` text NOT NULL,
  `role` text NOT NULL,
  `status` text DEFAULT 'ACTIVE' NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `memberships_user_tenant_uidx` ON `memberships` (`user_id`,`tenant_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `memberships_user_idx` ON `memberships` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `memberships_tenant_idx` ON `memberships` (`tenant_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_identities` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `provider` text NOT NULL,
  `provider_account_id` text NOT NULL,
  `email` text NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `user_identities_provider_account_uidx` ON `user_identities` (`provider`,`provider_account_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `user_identities_user_idx` ON `user_identities` (`user_id`);
--> statement-breakpoint
INSERT OR IGNORE INTO `memberships` (`id`, `user_id`, `tenant_id`, `role`, `status`, `created_at`, `updated_at`)
SELECT `id` || ':home', `id`, `tenant_id`, `role`, 'ACTIVE', `created_at`, `updated_at` FROM `users`;

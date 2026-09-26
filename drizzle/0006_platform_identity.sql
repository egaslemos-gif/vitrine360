CREATE TABLE IF NOT EXISTS `platform_assignments` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `role` text NOT NULL,
  `status` text DEFAULT 'ACTIVE' NOT NULL,
  `created_by_user_id` text,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `platform_assignments_user_role_uidx` ON `platform_assignments` (`user_id`,`role`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `platform_assignments_user_idx` ON `platform_assignments` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `platform_assignments_status_idx` ON `platform_assignments` (`status`);

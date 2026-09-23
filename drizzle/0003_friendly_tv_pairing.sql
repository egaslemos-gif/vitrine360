ALTER TABLE `devices` ADD `pairing_client_id` text;
--> statement-breakpoint
CREATE INDEX `devices_pairing_client_idx` ON `devices` (`pairing_client_id`);

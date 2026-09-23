# Database Schema (Drizzle + SQLite / Turso)

IDs: text UUIDs (`crypto.randomUUID()`). Timestamps: integer Unix ms or ISO text (prefer ISO text for readability).

## Core tables (summary)

### users
`id`, `email` (unique), `name`, `password_hash`, `role`, `tenant_id?`, `created_at`, `updated_at`

### devices
`id`, `device_code` (unique, e.g. TV-HALL-001), `name`, `location`, `description`,  
`status` (PENDING|ACTIVE|OFFLINE|DISABLED), `activation_code?`, `activation_expires_at?`,  
`device_token_hash?`, `current_playlist_id?`, `software_version?`, `screen_resolution?`,  
`orientation` (default landscape), `last_seen_at?`, `manifest_version` (int, default 0),  
`player_state?` (JSON), `tenant_id?`, `created_at`, `updated_at`

Indexes: `device_code`, `status`, `last_seen_at`, `current_playlist_id`

### device_groups
`id`, `name`, `description`, `tenant_id?`, `created_at`, `updated_at`

### device_group_members
`group_id`, `device_id` (PK composite)

### media_assets
`id`, `file_name`, `mime_type`, `file_size`, `storage_provider`, `storage_key`, `url`,  
`width?`, `height?`, `duration_ms?`, `checksum`, `tenant_id?`, `created_at`

### contents
`id`, `type`, `title`, `description?`, `status` (ACTIVE|INACTIVE), `payload` (JSON),  
`duration_ms`, `version` (int), `valid_from?`, `valid_to?`, `tenant_id?`, `created_at`, `updated_at`

### content_assets
`content_id`, `media_asset_id`, `role` (primary|thumbnail|…)

### playlists
`id`, `name`, `description?`, `version` (int), `status`, `tenant_id?`, `created_at`, `updated_at`

### playlist_items
`id`, `playlist_id`, `content_id`, `position`, `duration_override_ms?`, `active` (bool),  
`transition` (fade|slide-left|zoom|cut)

Indexes: `playlist_id`, `content_id`

### device_assignments
`id`, `device_id?`, `device_group_id?`, `playlist_id`, `priority`, `created_at`  
Constraint: exactly one of device_id / device_group_id

### schedules
`id`, `name`, `playlist_id?`, `content_id?`, `start_at?`, `end_at?`,  
`days_of_week` (JSON array 0–6), `start_time?`, `end_time?`,  
`priority` (NORMAL|HIGH|EMERGENCY), `active`, `tenant_id?`, `created_at`, `updated_at`

Indexes for schedule queries

### activity_logs
`id`, `user_id?`, `action`, `resource`, `resource_id?`, `ip?`, `metadata` (JSON), `created_at`

### system_settings
`key` (PK), `value` (JSON), `updated_at`

## Migrations

Versioned SQL via Drizzle Kit under `drizzle/`. Never hand-edit production without migration.

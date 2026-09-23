import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const tenants = sqliteTable(
  "tenants",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("tenants_slug_uidx").on(t.slug)],
);

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("ADMIN"),
    /**
     * LEGACY / TRANSITIONAL. Original home tenant kept so existing rows and
     * seeds stay valid. Authorization uses memberships, not this column.
     */
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    uniqueIndex("users_tenant_email_uidx").on(t.tenantId, t.email),
    index("users_tenant_idx").on(t.tenantId),
  ],
);

/** Source of truth for which workspace a user may enter, and with which role. */
export const memberships = sqliteTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    uniqueIndex("memberships_user_tenant_uidx").on(t.userId, t.tenantId),
    index("memberships_user_idx").on(t.userId),
    index("memberships_tenant_idx").on(t.tenantId),
  ],
);

/** External login identities. Provider `google` stores the Google subject. */
export const userIdentities = sqliteTable(
  "user_identities",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    email: text("email").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    uniqueIndex("user_identities_provider_account_uidx").on(
      t.provider,
      t.providerAccountId,
    ),
    index("user_identities_user_idx").on(t.userId),
  ],
);

export const devices = sqliteTable(
  "devices",
  {
    id: text("id").primaryKey(),
    deviceCode: text("device_code"),
    name: text("name"),
    location: text("location"),
    description: text("description"),
    status: text("status").notNull().default("PENDING"),
    activationCode: text("activation_code"),
    activationExpiresAt: text("activation_expires_at"),
    pairingClientId: text("pairing_client_id"),
    pairingSecretHash: text("pairing_secret_hash"),
    deviceTokenHash: text("device_token_hash"),
    deviceTokenExpiresAt: text("device_token_expires_at"),
    currentPlaylistId: text("current_playlist_id"),
    softwareVersion: text("software_version"),
    screenResolution: text("screen_resolution"),
    orientation: text("orientation").notNull().default("landscape"),
    /** TV | TOUCH_DISPLAY | LED | KIOSK — MVP default TV */
    displayType: text("display_type").notNull().default("TV"),
    /** PASSIVE | TOUCH | QR | HYBRID — MVP implements PASSIVE only */
    interactionMode: text("interaction_mode").notNull().default("PASSIVE"),
    timezone: text("timezone"),
    lastSeenAt: text("last_seen_at"),
    manifestVersion: integer("manifest_version").notNull().default(0),
    /**
     * Last effective playback fingerprint published via Sync
     * (`source|playlistId|scheduleId|emergencyContentId|priority`).
     * Used so wall-clock schedule transitions refresh without a manual bump.
     */
    effectivePlaybackKey: text("effective_playback_key"),
    playerState: text("player_state"),
    tenantId: text("tenant_id").references(() => tenants.id, {
      onDelete: "cascade",
    }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    uniqueIndex("devices_tenant_code_uidx").on(t.tenantId, t.deviceCode),
    index("devices_code_idx").on(t.deviceCode),
    index("devices_status_idx").on(t.status),
    index("devices_last_seen_idx").on(t.lastSeenAt),
    index("devices_playlist_idx").on(t.currentPlaylistId),
    index("devices_activation_idx").on(t.activationCode),
    index("devices_pairing_client_idx").on(t.pairingClientId),
    index("devices_tenant_idx").on(t.tenantId),
  ],
);

export const deviceGroups = sqliteTable(
  "device_groups",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("device_groups_tenant_idx").on(t.tenantId)],
);

export const deviceGroupMembers = sqliteTable(
  "device_group_members",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => deviceGroups.id, { onDelete: "cascade" }),
    deviceId: text("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.deviceId] })],
);

export const mediaAssets = sqliteTable(
  "media_assets",
  {
    id: text("id").primaryKey(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: integer("file_size").notNull(),
    storageProvider: text("storage_provider").notNull(),
    storageKey: text("storage_key").notNull(),
    url: text("url").notNull(),
    width: integer("width"),
    height: integer("height"),
    durationMs: integer("duration_ms"),
    checksum: text("checksum").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    index("media_assets_tenant_idx").on(t.tenantId),
    uniqueIndex("media_assets_tenant_checksum_uidx").on(t.tenantId, t.checksum),
  ],
);

export const contents = sqliteTable(
  "contents",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("ACTIVE"),
    payload: text("payload").notNull().default("{}"),
    durationMs: integer("duration_ms").notNull().default(10000),
    version: integer("version").notNull().default(1),
    validFrom: text("valid_from"),
    validTo: text("valid_to"),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    index("contents_type_idx").on(t.type),
    index("contents_tenant_idx").on(t.tenantId),
  ],
);

export const contentAssets = sqliteTable(
  "content_assets",
  {
    contentId: text("content_id")
      .notNull()
      .references(() => contents.id, { onDelete: "cascade" }),
    mediaAssetId: text("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("primary"),
  },
  (t) => [primaryKey({ columns: [t.contentId, t.mediaAssetId] })],
);

export const playlists = sqliteTable(
  "playlists",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    version: integer("version").notNull().default(1),
    status: text("status").notNull().default("ACTIVE"),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("playlists_tenant_idx").on(t.tenantId)],
);

export const playlistItems = sqliteTable(
  "playlist_items",
  {
    id: text("id").primaryKey(),
    playlistId: text("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    contentId: text("content_id")
      .notNull()
      .references(() => contents.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    durationOverrideMs: integer("duration_override_ms"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    transition: text("transition").notNull().default("fade"),
    fitMode: text("fit_mode").notNull().default("black"),
  },
  (t) => [
    index("playlist_items_playlist_idx").on(t.playlistId),
    index("playlist_items_content_idx").on(t.contentId),
  ],
);

/** @deprecated Use scheduleTargets + schedules for distribution */
export const deviceAssignments = sqliteTable(
  "device_assignments",
  {
    id: text("id").primaryKey(),
    deviceId: text("device_id").references(() => devices.id, {
      onDelete: "cascade",
    }),
    deviceGroupId: text("device_group_id").references(() => deviceGroups.id, {
      onDelete: "cascade",
    }),
    playlistId: text("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    priority: integer("priority").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    index("assignments_device_idx").on(t.deviceId),
    index("assignments_playlist_idx").on(t.playlistId),
  ],
);

export const schedules = sqliteTable(
  "schedules",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    playlistId: text("playlist_id").references(() => playlists.id, {
      onDelete: "cascade",
    }),
    contentId: text("content_id").references(() => contents.id, {
      onDelete: "cascade",
    }),
    startAt: text("start_at"),
    endAt: text("end_at"),
    daysOfWeek: text("days_of_week").notNull().default("[]"),
    startTime: text("start_time"),
    endTime: text("end_time"),
    priority: text("priority").notNull().default("NORMAL"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    index("schedules_playlist_idx").on(t.playlistId),
    index("schedules_priority_idx").on(t.priority),
    index("schedules_tenant_idx").on(t.tenantId),
  ],
);

export const scheduleTargets = sqliteTable(
  "schedule_targets",
  {
    id: text("id").primaryKey(),
    scheduleId: text("schedule_id")
      .notNull()
      .references(() => schedules.id, { onDelete: "cascade" }),
    /** 'ALL' | 'GROUP' | 'DEVICE' */
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    index("schedule_targets_schedule_idx").on(t.scheduleId),
    index("schedule_targets_type_idx").on(t.targetType),
    index("schedule_targets_target_idx").on(t.targetId),
  ],
);

export const activityLogs = sqliteTable(
  "activity_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    tenantId: text("tenant_id").references(() => tenants.id, {
      onDelete: "cascade",
    }),
    action: text("action").notNull(),
    resource: text("resource").notNull(),
    resourceId: text("resource_id"),
    ip: text("ip"),
    metadata: text("metadata").notNull().default("{}"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("activity_logs_tenant_idx").on(t.tenantId)],
);

export const systemSettings = sqliteTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type Tenant = typeof tenants.$inferSelect;
export type User = typeof users.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type UserIdentity = typeof userIdentities.$inferSelect;
export type Device = typeof devices.$inferSelect;
export type Content = typeof contents.$inferSelect;
export type Playlist = typeof playlists.$inferSelect;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type Schedule = typeof schedules.$inferSelect;
export type ScheduleTarget = typeof scheduleTargets.$inferSelect;

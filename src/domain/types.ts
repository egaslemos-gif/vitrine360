/** Domain enums and shared types — no infrastructure imports */

export const USER_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "EDITOR",
  "OPERATOR",
  "VIEWER",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PERMISSIONS = [
  "manage_users",
  "manage_devices",
  "manage_contents",
  "manage_playlists",
  "manage_schedules",
  "view_logs",
  "view_dashboard",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  SUPER_ADMIN: PERMISSIONS,
  ADMIN: PERMISSIONS,
  EDITOR: [
    "manage_contents",
    "manage_playlists",
    "manage_schedules",
    "view_dashboard",
    "view_logs",
  ],
  OPERATOR: [
    "manage_devices",
    "manage_playlists",
    "manage_schedules",
    "view_dashboard",
    "view_logs",
  ],
  VIEWER: ["view_dashboard", "view_logs"],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export const DEVICE_STATUSES = [
  "PENDING",
  "ACTIVE",
  "OFFLINE",
  "DISABLED",
] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

export const CONTENT_TYPES = [
  "IMAGE",
  "VIDEO",
  "AUDIO",
  "TEXT",
  "NOTICE",
  "EVENT",
  "NEWS",
  "QR_CODE",
  "CLOCK",
  "EXPERIENCE",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const SCHEDULE_PRIORITIES = ["NORMAL", "HIGH", "EMERGENCY"] as const;
export type SchedulePriority = (typeof SCHEDULE_PRIORITIES)[number];

/** Canonical PlaylistItem.transition tokens (UI + React CSS + Legacy CSS). */
export const TRANSITIONS = ["fade", "slide-left", "zoom", "cut"] as const;
export type Transition = (typeof TRANSITIONS)[number];

export function isTransition(value: unknown): value is Transition {
  return (
    typeof value === "string" &&
    (TRANSITIONS as readonly string[]).includes(value)
  );
}

/** Read-time coerce for unknown / legacy strings (e.g. deprecated `slide`). */
export function parseTransition(
  value: unknown,
  fallback: Transition = "fade",
): Transition {
  if (isTransition(value)) return value;
  return fallback;
}

/** Write-time validation — rejects unknown tokens including deprecated `slide`. */
export function assertTransition(value: unknown): Transition {
  if (isTransition(value)) return value;
  throw new Error(
    "Transição inválida. Utilize: fade, slide-left, zoom ou cut.",
  );
}

export const PRESENCE = ["ONLINE", "AWAY", "OFFLINE"] as const;
export type Presence = (typeof PRESENCE)[number];

export const DEVICE_PRESENCE_ONLINE_WINDOW_MS = 3 * 60 * 1000; // 3 minutes
export const DEVICE_PRESENCE_AWAY_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/** Hardware/display class — future Interactive Runtime may use non-TV types */
export const DISPLAY_TYPES = [
  "TV",
  "TOUCH_DISPLAY",
  "LED",
  "KIOSK",
  "VIDEO_WALL",
  "TABLET",
  "OTHER"
] as const;
export type DisplayType = (typeof DISPLAY_TYPES)[number];

/**
 * How the Player Runtime interacts with viewers.
 * MVP implements PASSIVE only (autoplay signage).
 */
export const INTERACTION_MODES = [
  "PASSIVE",
  "TOUCH",
  "QR",
  "HYBRID",
] as const;
export type InteractionMode = (typeof INTERACTION_MODES)[number];

/** Runtime flavour shipped by /player today */
export const PLAYER_RUNTIME = "PASSIVE" as const;
export type PlayerRuntimeKind = "PASSIVE" | "INTERACTIVE";

export function derivePresence(
  lastSeenAt: string | null | undefined,
  onlineWindowMs: number,
  awayWindowMs: number,
  now = Date.now(),
): Presence {
  if (!lastSeenAt) return "OFFLINE";
  const last = Date.parse(lastSeenAt);
  if (Number.isNaN(last)) return "OFFLINE";
  const elapsed = Math.max(0, now - last);
  if (elapsed <= onlineWindowMs) return "ONLINE";
  if (elapsed <= awayWindowMs) return "AWAY";
  return "OFFLINE";
}

import { hasPermission, type Permission, type UserRole } from "@/domain/types";

export const ADMIN_NAV: { href: string; label: string; permission: Permission }[] = [
  { href: "/admin", label: "Dashboard", permission: "view_dashboard" },
  { href: "/admin/devices", label: "Devices", permission: "manage_devices" },
  { href: "/admin/device-groups", label: "Device Groups", permission: "manage_devices" },
  { href: "/admin/contents", label: "Contents", permission: "manage_contents" },
  { href: "/admin/media", label: "Media", permission: "manage_contents" },
  { href: "/admin/playlists", label: "Playlists", permission: "manage_playlists" },
  { href: "/admin/schedules", label: "Schedules", permission: "manage_schedules" },
  { href: "/admin/users", label: "Members", permission: "manage_users" },
  { href: "/admin/logs", label: "Activity", permission: "view_logs" },
  { href: "/admin/settings/workspace", label: "Workspace", permission: "manage_users" },
  { href: "/admin/settings", label: "Settings", permission: "view_dashboard" },
];

export function navForRole(role: string) {
  return ADMIN_NAV.filter((item) => hasPermission(role as UserRole, item.permission));
}

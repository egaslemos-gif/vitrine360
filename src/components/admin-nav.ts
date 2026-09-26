import { hasPermission, type Permission, type UserRole } from "@/domain/types";

export type NavSection =
  | "OVERVIEW"
  | "CONTENT"
  | "DEVICES"
  | "PLAYBACK"
  | "SYSTEM";

export const ADMIN_NAV: {
  href: string;
  label: string;
  permission: Permission;
  section: NavSection;
}[] = [
  {
    href: "/admin",
    label: "Dashboard",
    permission: "view_dashboard",
    section: "OVERVIEW",
  },
  {
    href: "/admin/media",
    label: "Media",
    permission: "manage_contents",
    section: "CONTENT",
  },
  {
    href: "/admin/contents",
    label: "Conteúdos",
    permission: "manage_contents",
    section: "CONTENT",
  },
  {
    href: "/admin/playlists",
    label: "Playlists",
    permission: "manage_playlists",
    section: "CONTENT",
  },
  {
    href: "/admin/devices",
    label: "Ecrãs",
    permission: "manage_devices",
    section: "DEVICES",
  },
  {
    href: "/admin/device-groups",
    label: "Grupos",
    permission: "manage_devices",
    section: "DEVICES",
  },
  {
    href: "/admin/schedules",
    label: "Agendamentos",
    permission: "manage_schedules",
    section: "PLAYBACK",
  },
  {
    href: "/admin/logs",
    label: "Actividade",
    permission: "view_logs",
    section: "SYSTEM",
  },
  {
    href: "/admin/users",
    label: "Membros",
    permission: "manage_users",
    section: "SYSTEM",
  },
  {
    href: "/admin/settings",
    label: "Definições",
    permission: "view_dashboard",
    section: "SYSTEM",
  },
];

export const NAV_SECTION_ORDER: NavSection[] = [
  "OVERVIEW",
  "CONTENT",
  "DEVICES",
  "PLAYBACK",
  "SYSTEM",
];

export const NAV_SECTION_LABELS: Record<NavSection, string> = {
  OVERVIEW: "Overview",
  CONTENT: "Content",
  DEVICES: "Devices",
  PLAYBACK: "Playback",
  SYSTEM: "System",
};

export function navForRole(role: string) {
  return ADMIN_NAV.filter((item) =>
    hasPermission(role as UserRole, item.permission),
  );
}

export function navGroupedForRole(role: string) {
  const items = navForRole(role);
  return NAV_SECTION_ORDER.map((section) => ({
    section,
    label: NAV_SECTION_LABELS[section],
    items: items.filter((i) => i.section === section),
  })).filter((g) => g.items.length > 0);
}

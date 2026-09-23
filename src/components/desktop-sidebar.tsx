"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  MonitorPlay,
  MonitorSpeaker,
  Image as ImageIcon,
  FolderOpen,
  ListVideo,
  CalendarClock,
  Users,
  Activity,
  Settings,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { navGroupedForRole } from "@/components/admin-nav";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";

const ICONS: Record<string, LucideIcon> = {
  "/admin": LayoutDashboard,
  "/admin/devices": MonitorPlay,
  "/admin/device-groups": MonitorSpeaker,
  "/admin/contents": ImageIcon,
  "/admin/media": FolderOpen,
  "/admin/playlists": ListVideo,
  "/admin/schedules": CalendarClock,
  "/admin/users": Users,
  "/admin/logs": Activity,
  "/admin/settings/workspace": Settings,
  "/admin/settings": Settings,
  "/admin/profile": UserRound,
};

function firstName(full: string) {
  return full.trim().split(/\s+/)[0] || full;
}

export function DesktopSidebar({
  userName,
  userEmail,
  userRole,
  tenantName,
  logoutNode,
  activeTenantId,
  workspaces,
}: {
  userName: string;
  userEmail: string;
  userRole: string;
  tenantName: string;
  logoutNode: React.ReactNode;
  activeTenantId: string;
  workspaces: { tenantId: string; name: string; role: string }[];
}) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const profileActive = pathname === "/admin/profile";

  return (
    <aside
      className={`relative hidden h-full min-h-0 shrink-0 flex-col pb-1 transition-all duration-300 ease-in-out md:flex ${
        isCollapsed ? "w-20 items-center" : "w-56"
      }`}
    >
      <div
        className={`flex w-full shrink-0 items-center ${isCollapsed ? "justify-center" : "justify-between"} px-2 pt-1`}
      >
        {!isCollapsed && (
          <div>
            <p
              className="text-2xl font-bold tracking-tight text-[var(--color-primary)]"
              style={{ fontFamily: "var(--font-fraunces), serif" }}
            >
              Vitrine360
            </p>
            <p className="mt-1 text-xs font-medium text-[var(--color-muted-foreground)]">
              Digital Signage Console
            </p>
          </div>
        )}
        {isCollapsed && (
          <p
            className="text-2xl font-bold tracking-tight text-[var(--color-primary)]"
            style={{ fontFamily: "var(--font-fraunces), serif" }}
            title="Vitrine360"
          >
            V
          </p>
        )}
      </div>

      <nav
        className="admin-sidebar-nav mt-4 flex min-h-0 w-full flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-2"
        aria-label="Navegação principal"
      >
        {navGroupedForRole(userRole).map((group) => (
          <div key={group.section} className="mb-2">
            {!isCollapsed ? (
              <p className="ui-sidebar-section" aria-hidden>
                {group.label}
              </p>
            ) : (
              <div
                className="mx-auto mb-1 mt-2 h-px w-6 bg-[var(--color-border)]"
                aria-hidden
              />
            )}
            {group.items.map((item) => {
              const Icon = ICONS[item.href] ?? LayoutDashboard;
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={isCollapsed ? item.label : undefined}
                  aria-current={isActive ? "page" : undefined}
                  className={`group flex shrink-0 items-center rounded-md py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] ${
                    isActive
                      ? "bg-white text-[var(--color-primary)] shadow-sm"
                      : "text-[var(--color-text-secondary)] hover:bg-white hover:text-[var(--color-primary)]"
                  } ${isCollapsed ? "justify-center px-0" : "gap-3 px-3"}`}
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 ${isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"}`}
                    aria-hidden
                  />
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div
        className={`w-full shrink-0 mt-4 border-t border-[var(--color-border)] pt-3 ${
          isCollapsed ? "flex flex-col items-center px-0 gap-2" : "px-2 space-y-2"
        }`}
      >
        {!isCollapsed ? (
          <>
            <div className="flex items-start gap-2 rounded-md px-1 py-1">
              <Link
                href="/admin/profile"
                className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1 py-1 transition-colors hover:bg-white ${
                  profileActive ? "bg-white shadow-sm" : ""
                }`}
                title={userEmail}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-sm font-bold">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--color-foreground)]">
                    {firstName(userName)}
                  </p>
                  <p className="truncate text-[11px] text-[var(--color-muted-foreground)]">
                    {userRole.replaceAll("_", " ")}
                  </p>
                </div>
              </Link>
              <div className="shrink-0 pt-1">{logoutNode}</div>
            </div>
            <div className="px-1">
              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                Workspace
              </p>
              <WorkspaceSwitcher
                activeTenantId={activeTenantId}
                workspaces={workspaces}
                fallbackName={tenantName}
              />
            </div>
          </>
        ) : (
          <>
            <Link
              href="/admin/profile"
              title={userName}
              className={`flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold ${
                profileActive ? "ring-2 ring-[var(--color-primary)]/30" : ""
              }`}
            >
              {userName.charAt(0).toUpperCase()}
            </Link>
            <div title="Terminar sessão">{logoutNode}</div>
          </>
        )}
      </div>

      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute top-3 -right-3 z-50 flex h-6 w-6 items-center justify-center rounded-full bg-white border border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-secondary)] shadow-sm transition-colors"
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}

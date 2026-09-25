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
      className={`relative hidden h-full min-h-0 shrink-0 flex-col overflow-hidden rounded-[var(--radius-2xl)] pb-2 transition-all duration-300 ease-in-out md:flex ${
        isCollapsed ? "w-[72px] items-center" : "w-60"
      }`}
      style={{
        background:
          "linear-gradient(180deg, var(--color-sidebar) 0%, color-mix(in oklab, var(--color-sidebar) 90%, var(--color-primary-soft)) 100%)",
        border: "1px solid var(--color-border-subtle)",
        boxShadow: "var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.6)",
      }}
    >
      {/* Logo */}
      <div
        className={`flex w-full shrink-0 items-center ${isCollapsed ? "justify-center" : "justify-between"} px-3 pt-4 pb-2`}
      >
        {!isCollapsed && (
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] shadow-md">
              <span className="text-sm font-bold text-white" style={{ fontFamily: "var(--font-fraunces), serif" }}>V</span>
            </div>
            <p
              className="text-lg font-bold tracking-tight text-[var(--color-primary)]"
              style={{ fontFamily: "var(--font-fraunces), serif" }}
            >
              Vitrine360
            </p>
          </div>
        )}
        {isCollapsed && (
          <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] shadow-md">
            <span
              className="text-sm font-bold text-white"
              style={{ fontFamily: "var(--font-fraunces), serif" }}
              title="Vitrine360"
            >
              V
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav
        className="admin-sidebar-nav mt-3 flex min-h-0 w-full flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-2"
        aria-label="Navegação principal"
      >
        {navGroupedForRole(userRole).map((group) => (
          <div key={group.section} className="mb-1">
            {!isCollapsed ? (
              <p className="ui-sidebar-section" aria-hidden>
                {group.label}
              </p>
            ) : (
              <div
                className="mx-auto mb-1 mt-3 h-px w-6 bg-[var(--color-border)]"
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
                  className={`group relative flex shrink-0 items-center rounded-[var(--radius-md)] py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] ${
                    isActive
                      ? "bg-[var(--color-primary)] text-white shadow-md"
                      : "text-[var(--color-text-secondary)] hover:bg-white/60 hover:text-[var(--color-text-primary)] hover:shadow-sm"
                  } ${isCollapsed ? "justify-center px-0" : "gap-3 px-3"}`}
                >
                  <Icon
                    className={`h-[18px] w-[18px] shrink-0 transition-transform duration-200 ${
                      isActive
                        ? "opacity-100"
                        : "opacity-70 group-hover:opacity-100 group-hover:scale-110"
                    }`}
                    aria-hidden
                  />
                  {!isCollapsed && <span>{item.label}</span>}
                  {isActive && !isCollapsed && (
                    <span
                      className="absolute right-1.5 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-white/40"
                      aria-hidden
                    />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User Section */}
      <div
        className={`w-full shrink-0 mt-2 border-t border-[var(--color-border-subtle)] pt-3 ${
          isCollapsed ? "flex flex-col items-center px-0 gap-2" : "px-2 space-y-2"
        }`}
      >
        {!isCollapsed ? (
          <>
            <div className="flex items-start gap-2 rounded-md px-1 py-1">
              <Link
                href="/admin/profile"
                className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-[var(--radius-md)] px-2 py-2 transition-all hover:bg-white/50 ${
                  profileActive ? "bg-white/60 shadow-sm" : ""
                }`}
                title={userEmail}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] text-sm font-bold text-white shadow-sm">
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
              <div className="shrink-0 pt-2">{logoutNode}</div>
            </div>
            <div className="px-1 pb-1">
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
              className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] font-bold text-white shadow-sm transition-all hover:shadow-md ${
                profileActive ? "ring-2 ring-[var(--color-primary)]/30" : ""
              }`}
            >
              {userName.charAt(0).toUpperCase()}
            </Link>
            <div title="Terminar sessão">{logoutNode}</div>
          </>
        )}
      </div>

      {/* Collapse Toggle */}
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-5 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted-foreground)] shadow-md transition-all hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] hover:shadow-lg"
        aria-label={isCollapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
      >
        {isCollapsed ? (
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        )}
      </button>
    </aside>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
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
};

export function MobileNav({
  userName,
  userRole,
  tenantName,
  logoutNode,
  activeTenantId,
  workspaces,
}: {
  userName: string;
  userRole: string;
  tenantName: string;
  logoutNode: React.ReactNode;
  activeTenantId: string;
  workspaces: { tenantId: string; name: string; role: string }[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="z-40 flex h-12 w-full shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 shadow-[var(--shadow-subtle)] md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-primary)] shadow-sm">
            <span className="text-[10px] font-bold text-white" style={{ fontFamily: "var(--font-fraunces), serif" }}>V</span>
          </div>
          <p
            className="text-base font-bold tracking-tight text-[var(--color-primary)]"
            style={{ fontFamily: "var(--font-fraunces), serif" }}
          >
            Vitrine360
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-foreground)] hover:bg-[var(--color-secondary)]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] transform flex-col shadow-2xl transition-transform duration-300 ease-in-out md:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          background: "linear-gradient(180deg, var(--color-surface) 0%, color-mix(in oklab, var(--color-surface) 95%, var(--color-primary-soft)) 100%)",
        }}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-primary)]">
              <span className="text-[10px] font-bold text-white" style={{ fontFamily: "var(--font-fraunces), serif" }}>V</span>
            </div>
            <p
              className="text-base font-bold tracking-tight text-[var(--color-primary)]"
              style={{ fontFamily: "var(--font-fraunces), serif" }}
            >
              Navegação
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-full p-2 hover:bg-[var(--color-secondary)]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navegação móvel">
          {navGroupedForRole(userRole).map((group) => (
            <div key={group.section} className="mb-3">
              <p className="ui-sidebar-section px-2">{group.label}</p>
              <div className="flex flex-col gap-1">
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
                      aria-current={isActive ? "page" : undefined}
                      className={`group flex items-center gap-3.5 rounded-[var(--radius-md)] px-3.5 py-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] ${
                        isActive
                          ? "bg-[var(--color-primary)] text-white shadow-md"
                          : "text-[var(--color-text-secondary)] hover:bg-white/50 hover:text-[var(--color-primary)]"
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 ${isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"}`}
                        aria-hidden
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-3 border-t border-[var(--color-border-subtle)] px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] text-sm font-bold text-white shadow-sm">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{userName}</p>
              <p className="ui-caption">{userRole.replaceAll("_", " ")}</p>
            </div>
          </div>
          <WorkspaceSwitcher
            activeTenantId={activeTenantId}
            workspaces={workspaces}
            fallbackName={tenantName}
          />
          {logoutNode}
        </div>
      </div>
    </>
  );
}

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
  Settings 
} from "lucide-react";
import { navForRole } from "@/components/admin-nav";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/devices", label: "Devices", icon: MonitorPlay },
  { href: "/admin/device-groups", label: "Device Groups", icon: MonitorSpeaker },
  { href: "/admin/contents", label: "Contents", icon: ImageIcon },
  { href: "/admin/media", label: "Media", icon: FolderOpen },
  { href: "/admin/playlists", label: "Playlists", icon: ListVideo },
  { href: "/admin/schedules", label: "Schedules", icon: CalendarClock },
  { href: "/admin/users", label: "Members", icon: Users },
  { href: "/admin/logs", label: "Activity", icon: Activity },
  { href: "/admin/settings/workspace", label: "Workspace", icon: Settings },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

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

  // Close drawer on route change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  // Prevent scrolling when drawer is open
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
      <header className="z-40 flex h-14 w-full shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-white/80 px-4 shadow-sm backdrop-blur-md md:hidden">
        <div className="flex items-center gap-2">
          <p
            className="text-xl font-bold tracking-tight text-[var(--color-primary)]"
            style={{ fontFamily: "var(--font-fraunces), serif" }}
          >
            Vitrine360
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-md text-[var(--color-foreground)] hover:bg-[var(--color-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          aria-label="Open Menu"
        >
          <Menu className="h-6 w-6" />
        </button>
      </header>

      {/* Backdrop */}
      {open && (
        <div 
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div 
        className={`fixed inset-y-0 right-0 z-50 w-72 max-w-[85vw] transform bg-white shadow-2xl transition-transform duration-300 ease-in-out md:hidden flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <p
            className="text-xl font-bold tracking-tight text-[var(--color-primary)]"
            style={{ fontFamily: "var(--font-fraunces), serif" }}
          >
            Navegação
          </p>
          <button
            onClick={() => setOpen(false)}
            className="rounded-full p-2 hover:bg-[var(--color-secondary)]/50 focus:outline-none"
            aria-label="Close Menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6">
          <div className="flex flex-col gap-2">
            {NAV.filter((item) => navForRole(userRole).some((entry) => entry.href === item.href)).map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-4 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    isActive 
                      ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]" 
                      : "text-[var(--color-foreground)] hover:bg-[var(--color-secondary)]/50 hover:text-[var(--color-primary)]"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"}`} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-[var(--color-border)] bg-[var(--color-secondary)]/10 p-6 space-y-3">
          <Link href="/admin/profile" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--color-foreground)]">{userName}</p>
              <p className="truncate text-xs text-[var(--color-muted-foreground)]">
                {userRole.replaceAll("_", " ")}
              </p>
            </div>
          </Link>
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Workspace
            </p>
            <WorkspaceSwitcher
              activeTenantId={activeTenantId}
              workspaces={workspaces}
              fallbackName={tenantName}
            />
          </div>
          <div>{logoutNode}</div>
        </div>
      </div>
    </>
  );
}

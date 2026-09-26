"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutGrid } from "lucide-react";
import { PLATFORM_NAV } from "@/components/platform-nav";
import { cn } from "@/lib/utils";

export function PlatformSidebar({
  userName,
  userEmail,
  logoutNode,
}: {
  userName: string;
  userEmail: string;
  logoutNode: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <aside
      className="hidden w-56 shrink-0 flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] md:flex"
      aria-label="Platform navigation"
    >
      <div className="border-b border-[var(--color-border)] px-4 py-4">
        <p
          className="text-lg font-semibold tracking-tight text-[var(--color-primary)]"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          Vitrine360
        </p>
        <p className="ui-caption mt-0.5 uppercase tracking-wider text-[var(--color-muted-foreground)]">
          Platform Console
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Platform">
        <p className="ui-sidebar-section px-2 py-1">Control Plane</p>
        {PLATFORM_NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                  : "text-[var(--color-foreground)] hover:bg-[var(--color-muted)]",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Building2 className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate">{item.label}</span>
                <span className="block truncate text-[10px] font-normal text-[var(--color-muted-foreground)]">
                  {item.description}
                </span>
              </span>
            </Link>
          );
        })}
        <div className="mt-4 border-t border-[var(--color-border)] pt-3">
          <Link
            href="/admin"
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
            Workspace admin
          </Link>
        </div>
      </nav>

      <div className="border-t border-[var(--color-border)] px-4 py-3">
        <p className="truncate text-sm font-medium">{userName}</p>
        <p className="truncate text-xs text-[var(--color-muted-foreground)]">
          {userEmail}
        </p>
        <div className="mt-2">{logoutNode}</div>
      </div>
    </aside>
  );
}

export function PlatformMobileNav({
  userName,
  logoutNode,
}: {
  userName: string;
  logoutNode: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <header className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 md:hidden">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--color-primary)]">
          Platform
        </p>
        <p className="truncate text-xs text-[var(--color-muted-foreground)]">
          {userName}
        </p>
      </div>
      <nav className="flex items-center gap-2" aria-label="Platform mobile">
        {PLATFORM_NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium",
                active
                  ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)]"
                  : "text-[var(--color-muted-foreground)]",
              )}
            >
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/admin"
          className="rounded-md px-2 py-1 text-xs text-[var(--color-muted-foreground)]"
        >
          Admin
        </Link>
        {logoutNode}
      </nav>
    </header>
  );
}

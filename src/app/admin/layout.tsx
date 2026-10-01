import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { getSession } from "@/lib/auth";
import { MobileNav } from "@/components/mobile-nav";
import { DesktopSidebar } from "@/components/desktop-sidebar";
import { getTenantById } from "@/services/tenants";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)] font-sans">
        {children}
      </div>
    );
  }

  const { listMemberships } = await import("@/services/memberships");
  const [membershipRows, tenant] = await Promise.all([
    listMemberships(session.id),
    getTenantById(session.activeTenantId),
  ]);
  const workspaces = membershipRows
    .filter((row) => row.status === "ACTIVE")
    .map((row) => ({
      tenantId: row.tenantId,
      name: row.tenantName,
      role: row.role,
    }));
  const tenantName = tenant?.name ?? session.activeTenantId.slice(0, 8);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-transparent text-[var(--color-foreground)] font-sans">
      <MobileNav
        userName={session.name}
        userRole={session.role}
        tenantName={tenantName}
        logoutNode={<LogoutButton />}
        activeTenantId={session.activeTenantId}
        workspaces={workspaces}
      />

      <div className="flex min-h-0 flex-1 gap-2 p-2 sm:gap-3 sm:p-3 md:gap-5 md:p-5">
        <DesktopSidebar
          userName={session.name}
          userEmail={session.email}
          userRole={session.role}
          tenantName={tenantName}
          logoutNode={<LogoutButtonIcon />}
          activeTenantId={session.activeTenantId}
          workspaces={workspaces}
        />

        <main className="admin-main-pane flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-xl)] border border-white/80 bg-[var(--color-workspace)] shadow-[var(--shadow-card)] backdrop-blur-xl md:rounded-[var(--radius-2xl)]">
          <div className="admin-main-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
            <div className="ui-content-canvas mx-auto w-full max-w-[1600px] px-3 py-3 sm:px-5 sm:py-5 md:px-8 md:py-6">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

async function logoutAction() {
  "use server";
  const { clearSessionCookie, getSession } = await import("@/lib/auth");
  const { logActivity } = await import("@/services/activity-log");
  const current = await getSession();
  if (current) {
    await logActivity({
      userId: current.id,
      tenantId: current.activeTenantId,
      action: "LOGOUT",
      resource: "user",
      resourceId: current.id,
    });
  }
  await clearSessionCookie();
  redirect("/admin/login");
}

function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="text-[var(--color-primary)] underline-offset-2 hover:underline"
      >
        Terminar sessão
      </button>
    </form>
  );
}

function LogoutButtonIcon() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="rounded-md p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]"
        title="Terminar sessão"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </form>
  );
}

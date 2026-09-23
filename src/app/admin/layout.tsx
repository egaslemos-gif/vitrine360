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
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#e8eef7_0%,_#f7f8fb_45%,_#eef1f6_100%)] text-[var(--color-foreground)] font-sans">
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
    <div className="flex h-dvh flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,_#e8eef7_0%,_#f7f8fb_45%,_#eef1f6_100%)] text-[var(--color-foreground)] font-sans">
      <MobileNav
        userName={session.name}
        userRole={session.role}
        tenantName={tenantName}
        logoutNode={<LogoutButton />}
        activeTenantId={session.activeTenantId}
        workspaces={workspaces}
      />

      <div className="flex min-h-0 flex-1 gap-4 p-3 md:gap-6 md:p-4 md:pl-2 md:pr-4">
        <DesktopSidebar
          userName={session.name}
          userEmail={session.email}
          userRole={session.role}
          tenantName={tenantName}
          logoutNode={<LogoutButtonIcon />}
          activeTenantId={session.activeTenantId}
          workspaces={workspaces}
        />

        <main className="admin-main-pane flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-white/40 shadow-sm ring-1 ring-black/5 backdrop-blur-xl">
          <div className="admin-main-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto max-w-5xl px-4 py-4 md:px-6 md:py-5">
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

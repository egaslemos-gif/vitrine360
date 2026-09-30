import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { getSession } from "@/lib/auth";
import {
  PlatformMobileNav,
  PlatformSidebar,
} from "@/components/platform-shell";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/admin/login");
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[var(--color-background)] text-[var(--color-foreground)] font-sans">
      <PlatformMobileNav
        userName={session.name}
        logoutNode={<LogoutButton />}
      />
      <div className="flex min-h-0 flex-1 gap-2 p-2 sm:gap-3 sm:p-3 md:gap-4 md:p-4">
        <PlatformSidebar
          userName={session.name}
          userEmail={session.email}
          logoutNode={<LogoutButtonIcon />}
        />
        <main className="admin-main-pane flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] sm:rounded-2xl">
          <div className="admin-main-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
            <div className="ui-content-canvas mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-4 sm:py-5 md:px-8 md:py-6">
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
        className="text-xs text-[var(--color-primary)] underline-offset-2 hover:underline"
      >
        Sair
      </button>
    </form>
  );
}

function LogoutButtonIcon() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden />
        Terminar sessão
      </button>
    </form>
  );
}

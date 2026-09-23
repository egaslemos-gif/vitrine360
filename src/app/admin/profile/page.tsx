import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { tenants, userIdentities } from "@/db/schema";
import { listMemberships } from "@/services/memberships";
import { getTenantById } from "@/services/tenants";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const [tenant, memberships, googleIdentity] = await Promise.all([
    getTenantById(session.activeTenantId),
    listMemberships(session.id),
    db
      .select({
        email: userIdentities.email,
        createdAt: userIdentities.createdAt,
      })
      .from(userIdentities)
      .where(
        and(
          eq(userIdentities.userId, session.id),
          eq(userIdentities.provider, "google"),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  const activeMemberships = memberships.filter((row) => row.status === "ACTIVE");
  const workspaces = activeMemberships.map((row) => ({
    tenantId: row.tenantId,
    name: row.tenantName,
    role: row.role,
  }));
  const canRename =
    session.role === "ADMIN" || session.role === "SUPER_ADMIN";

  async function renameWorkspace(formData: FormData) {
    "use server";
    const current = await getSession();
    if (!current) redirect("/admin/login");
    if (current.role !== "ADMIN" && current.role !== "SUPER_ADMIN") {
      redirect("/admin/profile");
    }
    const name = String(formData.get("name") ?? "").trim().slice(0, 120);
    if (!name) redirect("/admin/profile");
    await db
      .update(tenants)
      .set({ name, updatedAt: new Date().toISOString() })
      .where(eq(tenants.id, current.activeTenantId));
    const { logActivity } = await import("@/services/activity-log");
    await logActivity({
      userId: current.id,
      tenantId: current.activeTenantId,
      action: "WORKSPACE_UPDATED",
      resource: "tenant",
      resourceId: current.activeTenantId,
      metadata: { name },
    });
    revalidatePath("/admin/profile");
    revalidatePath("/admin");
  }

  return (
    <div className="space-y-8">
      <header className="admin-page-header pb-4 pt-4">
        <h1
          className="text-3xl font-semibold text-[var(--color-primary)]"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          Perfil
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Conta, workspace activo e acessos
        </p>
      </header>

      <section className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-2xl font-bold text-[var(--color-primary)]">
          {session.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-xl font-semibold text-[var(--color-foreground)]">{session.name}</p>
          <p className="truncate text-sm text-[var(--color-muted-foreground)]">{session.email}</p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--color-border)] bg-white/70 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Papel neste workspace
          </p>
          <p className="mt-1 text-lg font-semibold text-[var(--color-foreground)]">
            {session.role.replaceAll("_", " ")}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-white/70 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Workspace activo
          </p>
          <p className="mt-1 text-lg font-semibold text-[var(--color-foreground)]">
            {tenant?.name ?? "—"}
          </p>
          {tenant?.slug ? (
            <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">/{tenant.slug}</p>
          ) : null}
        </div>
      </section>

      {canRename ? (
        <section className="rounded-lg border border-[var(--color-border)] bg-white/70 p-4">
          <h2 className="text-sm font-semibold text-[var(--color-foreground)]">
            Renomear workspace
          </h2>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            O nome do workspace é independente do teu nome de utilizador.
          </p>
          <form action={renameWorkspace} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              name="name"
              defaultValue={tenant?.name ?? ""}
              maxLength={120}
              required
              className="h-9 flex-1 rounded-md border border-[var(--color-border)] bg-white px-3 text-sm"
            />
            <button
              type="submit"
              className="h-9 rounded-md bg-[var(--color-primary)] px-4 text-sm font-medium text-white"
            >
              Guardar
            </button>
          </form>
        </section>
      ) : null}

      <section className="rounded-lg border border-[var(--color-border)] bg-white/70 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-foreground)]">Workspaces</h2>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {activeMemberships.length} activo
              {activeMemberships.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="w-48 max-w-full">
            <WorkspaceSwitcher
              activeTenantId={session.activeTenantId}
              workspaces={workspaces}
              fallbackName={tenant?.name}
            />
          </div>
        </div>
        <ul className="divide-y divide-[var(--color-border)]">
          {activeMemberships.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-[var(--color-foreground)]">
                  {row.tenantName}
                  {row.tenantId === session.activeTenantId ? (
                    <span className="ml-2 text-[10px] font-medium uppercase text-[var(--color-primary)]">
                      activo
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-[var(--color-muted-foreground)]">/{row.tenantSlug}</p>
              </div>
              <span className="shrink-0 text-xs text-[var(--color-muted-foreground)]">
                {row.role.replaceAll("_", " ")}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-[var(--color-border)] bg-white/70 p-4 space-y-2">
        <h2 className="text-sm font-semibold text-[var(--color-foreground)]">Identidades</h2>
        <div className="flex items-center justify-between gap-3 text-sm">
          <div>
            <p className="font-medium">Email / password</p>
            <p className="text-xs text-[var(--color-muted-foreground)]">{session.email}</p>
          </div>
          <span className="text-xs text-[var(--color-muted-foreground)]">Conta</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <div>
            <p className="font-medium">Google</p>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {googleIdentity
                ? googleIdentity.email
                : "Não ligado — use Continuar com Google e depois a password se o email já existir"}
            </p>
          </div>
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {googleIdentity ? "Ligado" : "—"}
          </span>
        </div>
      </section>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/admin"
          className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 font-medium hover:bg-[var(--color-secondary)]/40"
        >
          Voltar ao dashboard
        </Link>
        <Link
          href="/admin/settings"
          className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 font-medium hover:bg-[var(--color-secondary)]/40"
        >
          Definições
        </Link>
      </div>
    </div>
  );
}

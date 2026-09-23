import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { WorkspaceSettingsForm } from "@/features/workspace/workspace-settings-form";
import { requireAdminPage } from "@/lib/admin-access";
import { getTenantById } from "@/services/tenants";

export default async function WorkspaceSettingsPage() {
  const session = await requireAdminPage("manage_users");
  if (!session) return <AccessDenied />;
  const tenant = await getTenantById(session.activeTenantId);
  if (!tenant) return <AccessDenied title="Workspace não encontrado" />;

  return (
    <div className="space-y-8">
      <header className="admin-page-header pb-4 pt-4">
        <h1
          className="text-3xl font-semibold text-[var(--color-primary)]"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          Workspace
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Nome e timezone do workspace activo · /{tenant.slug}
        </p>
      </header>
      <WorkspaceSettingsForm
        initialName={tenant.name}
        initialTimezone={tenant.timezone}
      />
      <Link
        href="/admin/settings"
        className="text-sm text-[var(--color-primary)] underline-offset-2 hover:underline"
      >
        Definições do sistema
      </Link>
    </div>
  );
}

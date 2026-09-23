import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { WorkspaceSettingsForm } from "@/features/workspace/workspace-settings-form";
import { requireAdminPage } from "@/lib/admin-access";
import { getTenantById } from "@/services/tenants";
import { PageHeader } from "@/components/ui/page-header";

export default async function WorkspaceSettingsPage() {
  const session = await requireAdminPage("manage_users");
  if (!session) return <AccessDenied />;
  const tenant = await getTenantById(session.activeTenantId);
  if (!tenant) return <AccessDenied title="Workspace não encontrado" />;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <PageHeader
        title="Workspace"
        description={`Nome e timezone do workspace activo · /${tenant.slug}`}
      />
      <WorkspaceSettingsForm
        initialName={tenant.name}
        initialTimezone={tenant.timezone}
      />
      <Link
        href="/admin/settings"
        className="inline-block text-sm text-[var(--color-primary)] underline-offset-2 hover:underline"
      >
        Definições do sistema
      </Link>
    </div>
  );
}

import { AccessDenied } from "@/components/access-denied";
import { MembersManager } from "@/features/users/members-manager";
import { requireAdminPage } from "@/lib/admin-access";
import { listWorkspaceMembers } from "@/services/members";
import { PageHeader } from "@/components/ui/page-header";

export default async function MembersPage() {
  const session = await requireAdminPage("manage_users");
  if (!session) return <AccessDenied />;

  const members = await listWorkspaceMembers(session.activeTenantId);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Membros"
        description="Roles e estado no workspace activo."
      />
      <MembersManager
        members={members}
        currentUserId={session.id}
        operatorRole={session.role}
      />
    </div>
  );
}

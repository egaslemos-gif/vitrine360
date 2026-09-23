import { AccessDenied } from "@/components/access-denied";
import { MembersManager } from "@/features/users/members-manager";
import { requireAdminPage } from "@/lib/admin-access";
import { listWorkspaceMembers } from "@/services/members";

export default async function MembersPage() {
  const session = await requireAdminPage("manage_users");
  if (!session) return <AccessDenied />;

  const members = await listWorkspaceMembers(session.activeTenantId);

  return (
    <div className="space-y-8">
      <header className="admin-page-header flex flex-col pb-4 pt-4">
        <h1
          className="text-3xl font-semibold text-[var(--color-primary)]"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          Members
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Membros do workspace activo — roles e estado da membership
        </p>
      </header>
      <MembersManager
        members={members}
        currentUserId={session.id}
        operatorRole={session.role}
      />
    </div>
  );
}

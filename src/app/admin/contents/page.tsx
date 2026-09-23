import { AccessDenied } from "@/components/access-denied";
import { requireAdminPage } from "@/lib/admin-access";
import { listContentsWithUsage } from "@/services/contents";
import { ContentListManager } from "@/features/contents/content-list-manager";

export default async function ContentsPage() {
  const session = await requireAdminPage("manage_contents");
  if (!session) return <AccessDenied />;
  const contents = await listContentsWithUsage(session.tenantId);

  return (
    <div className="space-y-8">
      <header className="admin-page-header flex flex-col pb-4 pt-4">
        <h1
          className="text-3xl font-semibold text-[var(--color-primary)]"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          Contents
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Content Studio — conteúdos lógicos do workspace
        </p>
      </header>

      <ContentListManager contents={contents} />
    </div>
  );
}

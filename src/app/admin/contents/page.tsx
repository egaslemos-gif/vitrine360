import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { requireAdminPage } from "@/lib/admin-access";
import { listContentsWithUsage } from "@/services/contents";
import { ContentListManager } from "@/features/contents/content-list-manager";
import { PageHeader } from "@/components/ui/page-header";

export default async function ContentsPage() {
  const session = await requireAdminPage("manage_contents");
  if (!session) return <AccessDenied />;
  const contents = await listContentsWithUsage(session.tenantId);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Conteúdos"
        description="Conteúdos lógicos do workspace."
        actions={
          <Link
            href="/admin/contents/new"
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] sm:h-9 sm:w-auto"
          >
            + Criar Conteúdo
          </Link>
        }
      />
      <ContentListManager contents={contents} />
    </div>
  );
}

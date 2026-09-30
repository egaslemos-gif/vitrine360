import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { requireAdminPage } from "@/lib/admin-access";
import { listMediaAssetsWithUsage } from "@/services/contents";
import { MediaLibrary } from "@/features/media/media-library";
import { PageHeader } from "@/components/ui/page-header";

export default async function MediaPage() {
  const session = await requireAdminPage("manage_contents");
  if (!session) return <AccessDenied />;
  const assets = await listMediaAssetsWithUsage(session.tenantId);

  return (
    <div className="mx-auto w-full space-y-8">
      <PageHeader
        title="Media"
        description="Biblioteca profissional de ficheiros multimédia."
        actions={
          <Link
            href="/admin/contents/new"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          >
            + Usar em Conteúdo
          </Link>
        }
      />
      <MediaLibrary
        canDelete
        assets={assets.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          mimeType: a.mimeType,
          fileSize: a.fileSize,
          url: a.url,
          checksum: a.checksum,
          createdAt: a.createdAt,
          storageProvider: a.storageProvider,
          usageCount: a.usageCount,
        }))}
      />
    </div>
  );
}

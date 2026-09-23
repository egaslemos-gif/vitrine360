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
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <PageHeader
        title="Media Library"
        description="Gestão centralizada dos recursos multimédia"
        actions={
          <Link
            href="/admin/contents/new"
            className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--color-primary)] px-4 text-sm font-medium text-[var(--color-primary-foreground)] transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          >
            + Adicionar Media
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

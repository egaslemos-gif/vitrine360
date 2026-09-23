import { AccessDenied } from "@/components/access-denied";
import { requireAdminPage } from "@/lib/admin-access";
import { listMediaAssetsWithUsage } from "@/services/contents";
import { MediaLibrary } from "@/features/media/media-library";

export default async function MediaPage() {
  const session = await requireAdminPage("manage_contents");
  if (!session) return <AccessDenied />;
  const assets = await listMediaAssetsWithUsage(session.tenantId);

  return (
    <div className="space-y-8">
      <header className="admin-page-header flex flex-col pb-4 pt-4">
        <h1
          className="text-3xl font-semibold text-[var(--color-primary)]"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          Media Library
        </h1>
      </header>
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

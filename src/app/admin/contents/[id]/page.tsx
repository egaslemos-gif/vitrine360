import { AccessDenied } from "@/components/access-denied";
import { requireAdminPage } from "@/lib/admin-access";
import {
  getContentForPreview,
  getContentWithPrimaryMedia,
  listMediaAssets,
} from "@/services/contents";
import { ContentStudioForm } from "@/features/contents/content-studio-form";
import { PreviewHost } from "@/features/contents/preview-host";
import { notFound } from "next/navigation";

export default async function EditContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdminPage("manage_contents");
  if (!session) return <AccessDenied />;

  const { id } = await params;
  const content = await getContentWithPrimaryMedia(id, session.tenantId);
  if (!content) notFound();

  const preview = await getContentForPreview(id, session.tenantId);
  if (!preview) notFound();

  const mediaAssets = await listMediaAssets(session.tenantId);

  return (
    <div className="space-y-8">
      <header className="admin-page-header pb-4 pt-4">
        <h1
          className="text-3xl font-semibold text-[var(--color-primary)]"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          Content Studio
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {content.type}
          {content.media?.mimeType === "image/gif" ? " · GIF" : ""} · v
          {content.version}
        </p>
      </header>

      <PreviewHost content={preview} />

      <ContentStudioForm
        mode="edit"
        initial={{
          id: content.id,
          type: content.type,
          title: content.title,
          description: content.description,
          durationMs: content.durationMs,
          status: content.status,
          payload: content.payload,
          media: content.media,
          mediaAssetId: content.media?.id ?? null,
        }}
        existingAssets={mediaAssets.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          mimeType: a.mimeType,
          fileSize: a.fileSize,
          url: a.url,
          checksum: a.checksum,
          createdAt: a.createdAt,
          storageProvider: a.storageProvider,
        }))}
      />
    </div>
  );
}

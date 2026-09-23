import { AccessDenied } from "@/components/access-denied";
import { requireAdminPage } from "@/lib/admin-access";
import { listMediaAssets } from "@/services/contents";
import { ContentStudioForm } from "@/features/contents/content-studio-form";
import { ContentCreateChooser } from "@/features/contents/template-picker";
import { Suspense } from "react";

export default async function NewContentPage({
  searchParams,
}: {
  searchParams: Promise<{
    mediaAssetId?: string;
    templateId?: string;
    from?: string;
  }>;
}) {
  const session = await requireAdminPage("manage_contents");
  if (!session) return <AccessDenied />;
  const mediaAssets = await listMediaAssets(session.tenantId);
  const params = await searchParams;
  const hasSeed =
    Boolean(params.mediaAssetId) ||
    Boolean(params.templateId) ||
    params.from === "blank";

  if (!hasSeed) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <Suspense fallback={<p className="text-sm text-muted-foreground">A carregar…</p>}>
          <ContentCreateChooser />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="admin-page-header pb-4 pt-4">
        <h1
          className="text-3xl font-semibold text-[var(--color-primary)]"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          Novo conteúdo
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {params.templateId
            ? "A partir de template — edite e guarde um Content independente"
            : "Content Studio"}
        </p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted-foreground">A carregar…</p>}>
        <ContentStudioForm
          mode="create"
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
      </Suspense>
    </div>
  );
}

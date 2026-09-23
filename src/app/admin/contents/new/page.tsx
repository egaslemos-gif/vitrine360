import { AccessDenied } from "@/components/access-denied";
import { requireAdminPage } from "@/lib/admin-access";
import { listMediaAssets } from "@/services/contents";
import { ContentStudioForm } from "@/features/contents/content-studio-form";
import { Suspense } from "react";

export default async function NewContentPage() {
  const session = await requireAdminPage("manage_contents");
  if (!session) return <AccessDenied />;
  const mediaAssets = await listMediaAssets(session.tenantId);

  return (
    <div className="space-y-8">
      <header className="admin-page-header pb-4 pt-4">
        <h1
          className="text-3xl font-semibold text-[var(--color-primary)]"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          Novo conteúdo
        </h1>
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

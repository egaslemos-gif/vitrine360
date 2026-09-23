"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useIsClient } from "@/lib/use-is-client";
import {
  filterMediaAssets,
  isGifMime,
  isImageMime,
  isVideoMime,
  type MediaSortMode,
  type MediaTypeFilter,
  type MediaUsageFilter,
} from "./media-library-filters";

export type MediaAssetItem = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  url: string;
  checksum: string;
  createdAt: string;
  storageProvider: string;
  usageCount?: number;
};

type DisplayItem = MediaAssetItem & { duplicateCount: number };

function formatSize(bytes: number) {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDate(iso: string) {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function duplicateKey(a: MediaAssetItem) {
  return a.checksum || `name:${a.fileName.toLowerCase()}`;
}

function sortItems(items: DisplayItem[], sort: MediaSortMode): DisplayItem[] {
  const copy = [...items];
  copy.sort((a, b) => {
    if (sort === "name") {
      return a.fileName.localeCompare(b.fileName, "pt", { sensitivity: "base" });
    }
    if (sort === "size") {
      return b.fileSize - a.fileSize || a.fileName.localeCompare(b.fileName);
    }
    const ta = a.createdAt;
    const tb = b.createdAt;
    if (ta !== tb) return tb.localeCompare(ta);
    return a.fileName.localeCompare(b.fileName);
  });
  return copy;
}

function collapseDuplicates(
  items: MediaAssetItem[],
  showDuplicates: boolean,
): DisplayItem[] {
  if (showDuplicates) {
    return items.map((a) => ({ ...a, duplicateCount: 1 }));
  }
  const map = new Map<string, DisplayItem>();
  for (const a of items) {
    const key = duplicateKey(a);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...a, duplicateCount: 1 });
    } else {
      existing.duplicateCount += 1;
      if (a.createdAt > existing.createdAt) {
        Object.assign(existing, a, { duplicateCount: existing.duplicateCount });
      }
    }
  }
  return [...map.values()];
}

function ImagePreview({ url, alt }: { url: string; alt: string }) {
  const [open, setOpen] = useState(false);
  const mounted = useIsClient();

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        className="aspect-video w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => setOpen(true)}
      />
      {mounted && open && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Pré-visualização: ${alt}`}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={alt}
            className="max-h-[90vh] max-w-[90vw] object-contain shadow-2xl rounded-md"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            aria-label="Fechar pré-visualização"
            className="absolute top-4 right-6 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors"
            onClick={() => setOpen(false)}
          >
            ✕
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}

function AssetCard({
  asset,
  canDelete,
  onRequestDelete,
}: {
  asset: DisplayItem;
  canDelete: boolean;
  onRequestDelete: (asset: DisplayItem) => void;
}) {
  const image = isImageMime(asset.mimeType) || isGifMime(asset.mimeType);
  const video = isVideoMime(asset.mimeType);
  const usage = asset.usageCount ?? 0;
  const inUse = usage > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-start justify-between gap-2 truncate text-base">
          <span className="truncate">{asset.fileName}</span>
          <span className="flex shrink-0 items-center gap-1">
            {isGifMime(asset.mimeType) ? (
              <span className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-xs font-normal text-[var(--color-muted-foreground)]">
                GIF
              </span>
            ) : null}
            {asset.duplicateCount > 1 ? (
              <span className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-xs font-normal text-[var(--color-muted-foreground)]">
                ×{asset.duplicateCount}
              </span>
            ) : null}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {image ? (
          <ImagePreview url={asset.url} alt={asset.fileName} />
        ) : video ? (
          <video
            src={asset.url}
            controls
            preload="metadata"
            className="aspect-video w-full object-cover bg-black rounded-md"
            aria-label={`Vídeo ${asset.fileName}`}
          />
        ) : (
          <div className="flex aspect-video items-center justify-center bg-[var(--color-muted)] text-sm rounded-md">
            {asset.mimeType}
          </div>
        )}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {formatSize(asset.fileSize)} · {formatDate(asset.createdAt)}
            </p>
            {asset.usageCount !== undefined && (
              <p className="text-xs font-medium text-[var(--color-primary)] mt-1">
                Usado em {asset.usageCount} conteúdo
                {asset.usageCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
          <Link href={`/admin/contents/new?mediaAssetId=${asset.id}`}>
            <Button variant="outline" size="sm" type="button">
              Usar em Conteúdo
            </Button>
          </Link>
            {canDelete && !inUse ? (
              <Button
                variant="destructive"
                size="sm"
                type="button"
                aria-label={`Eliminar ${asset.fileName}`}
                onClick={() => onRequestDelete(asset)}
              >
                Eliminar
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  items,
  canDelete,
  onRequestDelete,
}: {
  title: string;
  items: DisplayItem[];
  canDelete: boolean;
  onRequestDelete: (asset: DisplayItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium text-[var(--color-primary)]">
        {title}{" "}
        <span className="text-sm font-normal text-[var(--color-muted-foreground)]">
          ({items.length})
        </span>
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((a) => (
          <AssetCard
            key={a.id}
            asset={a}
            canDelete={canDelete}
            onRequestDelete={onRequestDelete}
          />
        ))}
      </div>
    </section>
  );
}

export function MediaLibrary({
  assets,
  canDelete = true,
}: {
  assets: MediaAssetItem[];
  /** True when session has manage_contents (page gate). API remains authority. */
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<MediaTypeFilter>("all");
  const [usageFilter, setUsageFilter] = useState<MediaUsageFilter>("all");
  const [sort, setSort] = useState<MediaSortMode>("recent");
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [showDedupeModal, setShowDedupeModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DisplayItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const mounted = useIsClient();

  const { images, gifs, videos, filteredCount, collapsedCount } = useMemo(() => {
    const filtered = filterMediaAssets(assets, {
      query,
      typeFilter,
      usageFilter,
    });

    const collapsed = collapseDuplicates(filtered, showDuplicates);
    const imageItems = sortItems(
      collapsed.filter((a) => isImageMime(a.mimeType)),
      sort,
    );
    const gifItems = sortItems(
      collapsed.filter((a) => isGifMime(a.mimeType)),
      sort,
    );
    const videoItems = sortItems(
      collapsed.filter((a) => isVideoMime(a.mimeType)),
      sort,
    );

    return {
      images: imageItems,
      gifs: gifItems,
      videos: videoItems,
      filteredCount: filtered.length,
      collapsedCount: collapsed.length,
    };
  }, [assets, query, typeFilter, usageFilter, sort, showDuplicates]);

  const hiddenDupes = filteredCount - collapsedCount;
  const totalDupes = assets.length - collapseDuplicates(assets, false).length;
  const emptyResults =
    images.length === 0 && gifs.length === 0 && videos.length === 0;

  async function handleDeduplicate() {
    setIsDeduplicating(true);
    try {
      const res = await fetch("/api/admin/media/deduplicate", { method: "POST" });
      if (!res.ok) throw new Error("Falha ao desduplicar.");
      setShowDedupeModal(false);
      setShowDuplicates(false);
      router.refresh();
    } catch {
      alert("Não foi possível eliminar os duplicados. Tente novamente.");
    } finally {
      setIsDeduplicating(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/media/${encodeURIComponent(deleteTarget.id)}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setDeleteError(
          data.error ?? "Não foi possível eliminar o ficheiro.",
        );
        return;
      }
      setDeleteTarget(null);
      router.refresh();
    } catch {
      setDeleteError("Não foi possível eliminar o ficheiro. Tente novamente.");
    } finally {
      setIsDeleting(false);
    }
  }

  function closeDeleteModal() {
    if (isDeleting) return;
    setDeleteTarget(null);
    setDeleteError(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[200px] flex-1 space-y-1">
          <Label htmlFor="media-search">Pesquisar</Label>
          <Input
            id="media-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nome do ficheiro…"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="media-type">Tipo</Label>
          <select
            id="media-type"
            className="flex h-9 w-full min-w-[140px] rounded-md border border-[var(--color-border)] bg-white px-2 text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as MediaTypeFilter)}
          >
            <option value="all">Todos</option>
            <option value="image">Imagens</option>
            <option value="video">Vídeos</option>
            <option value="gif">GIF</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="media-usage">Utilização</Label>
          <select
            id="media-usage"
            className="flex h-9 w-full min-w-[140px] rounded-md border border-[var(--color-border)] bg-white px-2 text-sm"
            value={usageFilter}
            onChange={(e) =>
              setUsageFilter(e.target.value as MediaUsageFilter)
            }
          >
            <option value="all">Todos</option>
            <option value="used">Utilizados</option>
            <option value="unused">Não utilizados</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="media-sort">Ordenação</Label>
          <select
            id="media-sort"
            className="flex h-9 w-full min-w-[160px] rounded-md border border-[var(--color-border)] bg-white px-2 text-sm"
            value={sort}
            onChange={(e) => setSort(e.target.value as MediaSortMode)}
          >
            <option value="name">Nome A–Z</option>
            <option value="recent">Mais recentes</option>
            <option value="size">Tamanho</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowDuplicates((v) => !v)}
          >
            {showDuplicates ? "Ocultar duplicados" : "Mostrar duplicados"}
          </Button>
          {totalDupes > 0 && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowDedupeModal(true)}
              disabled={isDeduplicating}
              aria-label={`Remover ${totalDupes} duplicados`}
            >
              Remover {totalDupes} duplicado{totalDupes === 1 ? "" : "s"}
            </Button>
          )}
        </div>
      </div>

      {!showDuplicates && hiddenDupes > 0 ? (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {hiddenDupes} duplicado{hiddenDupes === 1 ? "" : "s"} oculto
          {hiddenDupes === 1 ? "" : "s"} (mesmo checksum/nome).
        </p>
      ) : null}

      {assets.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Sem assets. Faça upload em Contents (IMAGE/VIDEO).
        </p>
      ) : emptyResults ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Nenhum resultado para os filtros actuais.
        </p>
      ) : (
        <div className="space-y-8">
          {typeFilter === "all" || typeFilter === "image" ? (
            <Section
              title="Imagens"
              items={images}
              canDelete={canDelete}
              onRequestDelete={setDeleteTarget}
            />
          ) : null}
          {typeFilter === "all" || typeFilter === "gif" ? (
            <Section
              title="GIFs"
              items={gifs}
              canDelete={canDelete}
              onRequestDelete={setDeleteTarget}
            />
          ) : null}
          {typeFilter === "all" || typeFilter === "video" ? (
            <Section
              title="Vídeos"
              items={videos}
              canDelete={canDelete}
              onRequestDelete={setDeleteTarget}
            />
          ) : null}
        </div>
      )}

      {mounted && showDedupeModal && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dedupe-title"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl text-center relative animate-in fade-in zoom-in-95">
            <h2
              id="dedupe-title"
              className="mb-2 text-xl font-bold text-[var(--color-foreground)]"
            >
              Remover {totalDupes} duplicado{totalDupes === 1 ? "" : "s"}?
            </h2>
            <p className="mb-6 text-sm text-[var(--color-muted-foreground)]">
              Isto irá fundir os conteúdos duplicados (mesmo checksum ou nome),
              eliminando do sistema as cópias excedentes de forma irreversível.
              Os conteúdos da montra que utilizem ficheiros duplicados serão
              atualizados para apontar para a cópia principal sem qualquer
              impacto visual.
            </p>
            <div className="flex justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDedupeModal(false)}
                disabled={isDeduplicating}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeduplicate}
                disabled={isDeduplicating}
              >
                {isDeduplicating ? "A limpar..." : "Sim, remover duplicados"}
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {mounted && deleteTarget && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-media-title"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onKeyDown={(e) => {
            if (e.key === "Escape") closeDeleteModal();
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl relative animate-in fade-in zoom-in-95">
            <h2
              id="delete-media-title"
              className="mb-2 text-xl font-bold text-[var(--color-foreground)]"
            >
              Eliminar ficheiro?
            </h2>
            <dl className="mb-4 space-y-2 text-sm text-left">
              <div>
                <dt className="text-[var(--color-muted-foreground)]">Nome</dt>
                <dd className="font-medium break-all">{deleteTarget.fileName}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted-foreground)]">Estado</dt>
                <dd className="font-medium">
                  {(deleteTarget.usageCount ?? 0) > 0
                    ? `Utilizado em ${deleteTarget.usageCount} conteúdo${(deleteTarget.usageCount ?? 0) !== 1 ? "s" : ""}`
                    : "Não utilizado"}
                </dd>
              </div>
            </dl>
            {(deleteTarget.usageCount ?? 0) > 0 ? (
              <p className="mb-6 text-sm text-[var(--color-muted-foreground)] text-left">
                Este ficheiro está a ser utilizado por {deleteTarget.usageCount}{" "}
                conteúdos. Não pode ser eliminado enquanto estiver associado a
                conteúdos.
              </p>
            ) : (
              <p className="mb-6 text-sm text-[var(--color-muted-foreground)] text-left">
                Esta operação remove o ficheiro da Media Library.
              </p>
            )}
            {deleteError ? (
              <p className="mb-4 text-sm text-[var(--color-destructive)]" role="alert">
                {deleteError}
              </p>
            ) : null}
            <div className="flex justify-end gap-3">
              {(deleteTarget.usageCount ?? 0) > 0 ? (
                <Button type="button" variant="outline" onClick={closeDeleteModal}>
                  Fechar
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeDeleteModal}
                    disabled={isDeleting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDeleteConfirm}
                    disabled={isDeleting}
                    aria-label={`Confirmar eliminação de ${deleteTarget.fileName}`}
                  >
                    {isDeleting ? "A eliminar…" : "Eliminar"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

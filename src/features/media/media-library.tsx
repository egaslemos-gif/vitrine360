"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { TypeBadge } from "@/components/ui/type-badge";
import { PreviewViewport } from "@/components/ui/preview-viewport";
import { ModalOverlay, ModalPanel } from "@/components/ui/modal-shell";
import { useIsClient } from "@/lib/use-is-client";
import { ImageIcon, LayoutGrid, List, Search } from "lucide-react";
import {
  countMediaByType,
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
    month: "2-digit",
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
        className="h-full w-full cursor-pointer object-contain transition-opacity hover:opacity-90"
        onClick={() => setOpen(true)}
      />
      {mounted &&
        open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Pré-visualização: ${alt}`}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={alt}
              className="max-h-[90vh] max-w-[90vw] rounded-md object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              aria-label="Fechar pré-visualização"
              className="absolute top-4 right-6 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/80"
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
    <Card className="overflow-hidden shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-md">
      <div className="relative border-b border-[var(--color-border)]">
        <PreviewViewport aspectRatio="16/9">
          {image ? (
            <ImagePreview url={asset.url} alt={asset.fileName} />
          ) : video ? (
            <video
              src={asset.url}
              controls
              preload="metadata"
              className="h-full w-full object-contain"
              aria-label={`Vídeo ${asset.fileName}`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[var(--color-muted)] text-sm text-[var(--color-muted-foreground)]">
              {asset.mimeType}
            </div>
          )}
        </PreviewViewport>
        <div className="pointer-events-none absolute top-2 right-2 z-10 flex items-center gap-1">
          <TypeBadge mimeType={asset.mimeType} />
          {asset.duplicateCount > 1 ? (
            <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              ×{asset.duplicateCount}
            </span>
          ) : null}
        </div>
      </div>
      <CardHeader className="space-y-1 pb-2 pt-3">
        <CardTitle className="truncate text-sm" title={asset.fileName}>
          {asset.fileName}
        </CardTitle>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {formatSize(asset.fileSize)} · {formatDate(asset.createdAt)}
        </p>
        {asset.usageCount !== undefined ? (
          <p className="text-xs font-medium text-[var(--color-primary)]">
            Usado em {asset.usageCount} conteúdo
            {asset.usageCount !== 1 ? "s" : ""}
          </p>
        ) : null}
      </CardHeader>
      <CardFooter className="justify-between gap-2 border-t border-[var(--color-border)] bg-[var(--color-muted)]/20 py-3">
        <Link href={`/admin/contents/new?mediaAssetId=${asset.id}`}>
          <Button variant="outline" size="sm" type="button">
            Usar em Conteúdo
          </Button>
        </Link>
        {canDelete && !inUse ? (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            aria-label={`Eliminar ${asset.fileName}`}
            className="text-[var(--color-destructive)]"
            onClick={() => onRequestDelete(asset)}
          >
            Eliminar
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}

const TYPE_TABS: { id: MediaTypeFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "image", label: "Imagens" },
  { id: "video", label: "Vídeos" },
  { id: "gif", label: "GIFs" },
  { id: "other", label: "Outros" },
];

export function MediaLibrary({
  assets,
  canDelete = true,
}: {
  assets: MediaAssetItem[];
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<MediaTypeFilter>("all");
  const [usageFilter, setUsageFilter] = useState<MediaUsageFilter>("all");
  const [sort, setSort] = useState<MediaSortMode>("recent");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [showDedupeModal, setShowDedupeModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DisplayItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const mounted = useIsClient();

  const counts = useMemo(() => countMediaByType(assets), [assets]);

  const { displayItems, filteredCount, collapsedCount } = useMemo(() => {
    const filtered = filterMediaAssets(assets, {
      query,
      typeFilter,
      usageFilter,
    });
    const collapsed = collapseDuplicates(filtered, showDuplicates);
    return {
      displayItems: sortItems(collapsed, sort),
      filteredCount: filtered.length,
      collapsedCount: collapsed.length,
    };
  }, [assets, query, typeFilter, usageFilter, sort, showDuplicates]);

  const hiddenDupes = filteredCount - collapsedCount;
  const totalDupes = assets.length - collapseDuplicates(assets, false).length;

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
      const res = await fetch(
        `/api/admin/media/${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setDeleteError(data.error ?? "Não foi possível eliminar o ficheiro.");
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
      <div
        className="flex flex-wrap items-center gap-2"
        role="tablist"
        aria-label="Organizar por tipo de ficheiro"
      >
        {TYPE_TABS.map((tab) => {
          const count = counts[tab.id];
          const active = typeFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTypeFilter(tab.id)}
              className={
                active
                  ? "rounded-lg bg-[var(--color-tab-active)] px-3.5 py-2 text-sm font-semibold text-white shadow-sm"
                  : "rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-2 text-sm font-medium text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      <FilterBar>
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-muted-foreground)]" />
          <Input
            id="media-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Procurar por nome..."
            className="h-9 pl-9"
            aria-label="Pesquisar media"
          />
        </div>
        <select
          id="media-usage"
          aria-label="Filtrar por utilização"
          className="block h-9 min-w-[140px] rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2 text-sm"
          value={usageFilter}
          onChange={(e) =>
            setUsageFilter(e.target.value as MediaUsageFilter)
          }
        >
          <option value="all">Utilização: Todos</option>
          <option value="used">Utilização: Utilizados</option>
          <option value="unused">Utilização: Não utilizados</option>
        </select>
        <select
          id="media-sort"
          aria-label="Ordenar media"
          className="block h-9 min-w-[180px] rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2 text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value as MediaSortMode)}
        >
          <option value="recent">Ordenar por: Mais recente</option>
          <option value="name">Ordenar por: Nome A–Z</option>
          <option value="size">Ordenar por: Tamanho</option>
        </select>
        <div
          className="flex overflow-hidden rounded-md border border-[var(--color-border)]"
          role="group"
          aria-label="Modo de vista"
        >
          <button
            type="button"
            aria-pressed={viewMode === "grid"}
            aria-label="Vista em grelha"
            onClick={() => setViewMode("grid")}
            className={
              viewMode === "grid"
                ? "bg-[var(--color-tab-active)] p-2 text-white"
                : "bg-[var(--color-card)] p-2 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
            }
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-pressed={viewMode === "list"}
            aria-label="Vista em lista"
            onClick={() => setViewMode("list")}
            className={
              viewMode === "list"
                ? "bg-[var(--color-tab-active)] p-2 text-white"
                : "bg-[var(--color-card)] p-2 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
            }
          >
            <List className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowDuplicates((v) => !v)}
          >
            {showDuplicates ? "Ocultar duplicados" : "Mostrar duplicados"}
          </Button>
          {totalDupes > 0 ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setShowDedupeModal(true)}
              disabled={isDeduplicating}
              aria-label={`Remover ${totalDupes} duplicados`}
            >
              Remover {totalDupes} duplicado{totalDupes === 1 ? "" : "s"}
            </Button>
          ) : null}
        </div>
      </FilterBar>

      {!showDuplicates && hiddenDupes > 0 ? (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {hiddenDupes} duplicado{hiddenDupes === 1 ? "" : "s"} oculto
          {hiddenDupes === 1 ? "" : "s"} (mesmo checksum/nome).
        </p>
      ) : null}

      {assets.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="h-8 w-8" aria-hidden />}
          title="Nenhum media registado"
          description="Faça upload em Contents (IMAGE/VIDEO) para começar a biblioteca."
          action={
            <Link href="/admin/contents/new">
              <Button type="button">Adicionar Conteúdo</Button>
            </Link>
          }
        />
      ) : displayItems.length === 0 ? (
        <EmptyState
          title="Nenhum resultado"
          description="Ajuste a pesquisa ou os filtros actuais."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("");
                setTypeFilter("all");
                setUsageFilter("all");
              }}
            >
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <div
          className={
            viewMode === "grid"
              ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              : "flex flex-col gap-3"
          }
        >
          {displayItems.map((a) => (
            <AssetCard
              key={a.id}
              asset={a}
              canDelete={canDelete}
              onRequestDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {mounted &&
        showDedupeModal &&
        createPortal(
          <ModalOverlay
            onClose={() => !isDeduplicating && setShowDedupeModal(false)}
          >
            <ModalPanel
              size="md"
              onClick={(e) => e.stopPropagation()}
              className="text-center"
            >
              <h2
                id="dedupe-title"
                className="mb-2 text-xl font-bold text-[var(--color-foreground)]"
              >
                Remover {totalDupes} duplicado{totalDupes === 1 ? "" : "s"}?
              </h2>
              <p className="mb-6 text-sm text-[var(--color-muted-foreground)]">
                Isto irá fundir os conteúdos duplicados (mesmo checksum ou nome),
                eliminando do sistema as cópias excedentes de forma irreversível.
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
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
            </ModalPanel>
          </ModalOverlay>,
          document.body,
        )}

      {mounted &&
        deleteTarget &&
        createPortal(
          <ModalOverlay
            onClose={() => {
              if (!isDeleting) closeDeleteModal();
            }}
          >
            <ModalPanel
              size="md"
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                id="delete-media-title"
                className="mb-2 text-xl font-bold text-[var(--color-foreground)]"
              >
                Eliminar ficheiro?
              </h2>
              <dl className="mb-4 space-y-2 text-left text-sm">
                <div>
                  <dt className="text-[var(--color-muted-foreground)]">Nome</dt>
                  <dd className="break-all font-medium">{deleteTarget.fileName}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-muted-foreground)]">Tipo</dt>
                  <dd>
                    <TypeBadge mimeType={deleteTarget.mimeType} />
                  </dd>
                </div>
              </dl>
              {(deleteTarget.usageCount ?? 0) > 0 ? (
                <p className="mb-6 text-left text-sm text-[var(--color-muted-foreground)]">
                  Este ficheiro está em uso e não pode ser eliminado.
                </p>
              ) : (
                <p className="mb-6 text-left text-sm text-[var(--color-muted-foreground)]">
                  Esta operação remove o ficheiro da Media Library.
                </p>
              )}
              {deleteError ? (
                <p
                  className="mb-4 text-sm text-[var(--color-destructive)]"
                  role="alert"
                >
                  {deleteError}
                </p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
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
                    >
                      {isDeleting ? "A eliminar…" : "Eliminar"}
                    </Button>
                  </>
                )}
              </div>
            </ModalPanel>
          </ModalOverlay>,
          document.body,
        )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/ui/filter-bar";
import { GridView, ListRow, ListView } from "@/components/ui/data-view";
import { ViewSwitcher, type DataViewMode } from "@/components/ui/view-switcher";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Trash2 } from "lucide-react";
import { ModalOverlay, ModalPanel } from "@/components/ui/modal-shell";
import { useIsClient } from "@/lib/use-is-client";
import { CONTENT_TYPES, CONTENT_STATUSES } from "@/domain/types";
import { isGifMime } from "@/features/contents/gif-support";
import { TypeBadge } from "@/components/ui/type-badge";
import { StatusBadge } from "@/components/ui/status-badge";

type Content = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  durationMs: number;
  status: string;
  version: number;
  updatedAt?: string;
  usageCount?: number;
  inUse?: boolean;
  primaryMimeType?: string | null;
};

function formatDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDuration(ms: number, type: string) {
  if (type === "VIDEO" && ms === 0) return "natural";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`;
}

function contentTypeLabel(c: Content): string {
  if (
    c.type === "IMAGE" &&
    c.primaryMimeType &&
    isGifMime(c.primaryMimeType)
  ) {
    return "GIF";
  }
  return c.type;
}

function groupContentsByType(items: Content[]): { type: string; items: Content[] }[] {
  const buckets = new Map<string, Content[]>();
  for (const c of items) {
    const key = contentTypeLabel(c);
    const list = buckets.get(key);
    if (list) list.push(c);
    else buckets.set(key, [c]);
  }

  const order = [...CONTENT_TYPES, "GIF"];
  const ranked = [...buckets.entries()].sort(([a], [b]) => {
    const ia = order.indexOf(a as (typeof order)[number]);
    const ib = order.indexOf(b as (typeof order)[number]);
    const ra = ia === -1 ? 999 : ia;
    const rb = ib === -1 ? 999 : ib;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });

  return ranked.map(([type, groupItems]) => ({ type, items: groupItems }));
}

function ContentActions({
  content,
  busy,
  onToggleStatus,
  onDuplicate,
  onDelete,
}: {
  content: Content;
  busy: boolean;
  onToggleStatus: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 px-2.5 text-xs"
        onClick={onToggleStatus}
      >
        {content.status === "ACTIVE" ? "Desactivar" : "Activar"}
      </Button>
      <Link href={`/admin/contents/${content.id}`}>
        <Button type="button" size="sm" variant="outline" className="h-8 px-2.5 text-xs">
          Abrir
        </Button>
      </Link>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 w-8 px-0"
        aria-label={`Duplicar ${content.title}`}
        disabled={busy}
        onClick={onDuplicate}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        className="h-8 w-8 px-0"
        disabled={!!content.inUse || busy}
        title={content.inUse ? "Não é possível remover: em uso" : "Eliminar"}
        aria-label={`Eliminar ${content.title}`}
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function ContentListManager({ contents }: { contents: Content[] }) {
  const router = useRouter();
  const mounted = useIsClient();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<DataViewMode>("list");
  const [deleteItem, setDeleteItem] = useState<Content | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contents.filter((c) => {
      if (q && !c.title.toLowerCase().includes(q)) return false;
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      return true;
    });
  }, [contents, query, typeFilter, statusFilter]);

  const groups = useMemo(() => groupContentsByType(filtered), [filtered]);

  async function handleDelete() {
    if (!deleteItem) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/contents/${deleteItem.id}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Falha ao eliminar conteúdo");
      setDeleteItem(null);
      router.refresh();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicate(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/contents/${id}/duplicate`, {
        method: "POST",
      });
      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) throw new Error(json.error || "Falha ao duplicar");
      router.push(`/admin/contents/${json.id}`);
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erro ao duplicar");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(content: Content) {
    const newStatus = content.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await fetch(`/api/admin/contents/${content.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Falha ao alterar estado");
      router.refresh();
    } catch {
      alert("Não foi possível alterar o estado deste conteúdo.");
    }
  }

  return (
    <div className="space-y-4">
      <FilterBar>
        <div className="min-w-0 w-full flex-1 space-y-1 sm:min-w-[12rem]">
          <Label htmlFor="content-search" className="sr-only">
            Pesquisar
          </Label>
          <Input
            id="content-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar título…"
            className="h-10"
            aria-label="Pesquisar conteúdos"
          />
        </div>
        <select
          id="content-type-filter"
          aria-label="Filtrar por tipo"
          className="block h-10 w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm sm:w-auto sm:min-w-[9rem]"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">Tipo: Todos</option>
          {CONTENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          id="content-status-filter"
          aria-label="Filtrar por estado"
          className="block h-10 w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm sm:w-auto sm:min-w-[9rem]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Estado: Todos</option>
          {CONTENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <ViewSwitcher value={viewMode} onChange={setViewMode} className="w-full sm:w-auto" />
        <Link href="/admin/contents/new" className="w-full sm:ml-auto sm:w-auto">
          <Button type="button" className="h-10 w-full sm:w-auto">
            Novo conteúdo
          </Button>
        </Link>
      </FilterBar>

      {filtered.length === 0 ? (
        <p className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-10 text-center text-sm text-[var(--color-muted-foreground)]">
          Nenhum conteúdo para os filtros actuais.
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.type} aria-labelledby={`content-group-${group.type}`}>
              <div className="mb-2 flex items-center gap-2 px-0.5">
                <h2
                  id={`content-group-${group.type}`}
                  className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]"
                >
                  {group.type}
                </h2>
                <span className="rounded-full bg-[var(--color-surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
                  {group.items.length}
                </span>
              </div>

              {viewMode === "grid" ? (
                <GridView columns="default">
                  {group.items.map((c) => (
                    <Card
                      key={c.id}
                      className="ui-media-card border-0 shadow-none ring-1 ring-[var(--color-border)]"
                    >
                      <CardHeader className="space-y-2 px-3 pb-2 pt-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <TypeBadge contentType={contentTypeLabel(c)} />
                          <StatusBadge status={c.status} />
                          {c.inUse ? (
                            <Badge variant="muted" className="text-[10px]">
                              EM USO
                            </Badge>
                          ) : null}
                        </div>
                        <CardTitle className="ui-card-title line-clamp-2" title={c.title}>
                          <Link
                            href={`/admin/contents/${c.id}`}
                            className="hover:underline"
                          >
                            {c.title}
                          </Link>
                        </CardTitle>
                        <p className="ui-caption">
                          {formatDuration(c.durationMs, c.type)} · {formatDate(c.updatedAt)}
                        </p>
                      </CardHeader>
                      <CardFooter className="border-t border-[var(--color-border)] px-3 py-2.5">
                        <ContentActions
                          content={c}
                          busy={busy}
                          onToggleStatus={() => toggleStatus(c)}
                          onDuplicate={() => handleDuplicate(c.id)}
                          onDelete={() => setDeleteItem(c)}
                        />
                      </CardFooter>
                    </Card>
                  ))}
                </GridView>
              ) : (
                <ListView
                  header={
                    <>
                      <span className="min-w-0 flex-1">Título</span>
                      <span className="hidden w-24 shrink-0 sm:block">Tipo</span>
                      <span className="hidden w-20 shrink-0 md:block">Duração</span>
                      <span className="w-24 shrink-0">Estado</span>
                      <span className="hidden w-24 shrink-0 lg:block">Atualizado</span>
                      <span className="w-[9.5rem] shrink-0 text-right sm:w-40">Ações</span>
                    </>
                  }
                >
                  {group.items.map((c) => (
                    <ListRow
                      key={c.id}
                      className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/admin/contents/${c.id}`}
                            className="truncate text-sm font-semibold text-[var(--color-text-primary)] hover:underline"
                          >
                            {c.title}
                          </Link>
                          {c.inUse ? (
                            <Badge variant="muted" className="text-[10px]">
                              EM USO
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)] sm:hidden">
                          {contentTypeLabel(c)} · {c.status} ·{" "}
                          {formatDuration(c.durationMs, c.type)} ·{" "}
                          {formatDate(c.updatedAt)}
                        </p>
                      </div>
                      <div className="hidden w-24 shrink-0 sm:block">
                        <TypeBadge contentType={contentTypeLabel(c)} />
                      </div>
                      <div className="hidden w-20 shrink-0 text-[13px] text-[var(--color-text-secondary)] md:block">
                        {formatDuration(c.durationMs, c.type)}
                      </div>
                      <div className="hidden w-24 shrink-0 sm:block">
                        <StatusBadge status={c.status} />
                      </div>
                      <div className="hidden w-24 shrink-0 text-[13px] text-[var(--color-text-secondary)] lg:block">
                        {formatDate(c.updatedAt)}
                      </div>
                      <ContentActions
                        content={c}
                        busy={busy}
                        onToggleStatus={() => toggleStatus(c)}
                        onDuplicate={() => handleDuplicate(c.id)}
                        onDelete={() => setDeleteItem(c)}
                      />
                    </ListRow>
                  ))}
                </ListView>
              )}
            </section>
          ))}
        </div>
      )}

      {mounted &&
        deleteItem &&
        createPortal(
          <ModalOverlay
            onClose={() => {
              if (!busy) {
                setDeleteItem(null);
                setErrorMsg(null);
              }
            }}
          >
            <ModalPanel
              size="md"
              onClick={(e) => e.stopPropagation()}
              className="text-center"
            >
              <h2 className="mb-2 text-xl font-bold">Remover conteúdo?</h2>
              <p className="mb-6 text-sm text-[var(--color-muted-foreground)]">
                Deseja remover <strong>{deleteItem.title}</strong>? O MediaAsset
                associado não será eliminado.
              </p>
              {errorMsg ? (
                <p
                  className="mb-4 text-sm text-[var(--color-destructive)]"
                  role="alert"
                >
                  {errorMsg}
                </p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDeleteItem(null);
                    setErrorMsg(null);
                  }}
                  disabled={busy}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={busy}
                >
                  {busy ? "A remover…" : "Remover"}
                </Button>
              </div>
            </ModalPanel>
          </ModalOverlay>,
          document.body,
        )}
    </div>
  );
}

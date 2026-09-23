"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Trash2 } from "lucide-react";
import { useIsClient } from "@/lib/use-is-client";
import { CONTENT_TYPES, CONTENT_STATUSES } from "@/domain/types";
import { isGifMime } from "@/features/contents/gif-support";

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

export function ContentListManager({ contents }: { contents: Content[] }) {
  const router = useRouter();
  const mounted = useIsClient();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
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
    <>
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <CardTitle>Biblioteca de conteúdos</CardTitle>
          <Link href="/admin/contents/new">
            <Button type="button">Novo conteúdo</Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <div className="min-w-[180px] flex-1 space-y-1">
              <Label htmlFor="content-search">Pesquisar</Label>
              <Input
                id="content-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Título…"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="content-type-filter">Tipo</Label>
              <select
                id="content-type-filter"
                className="flex h-9 min-w-[140px] rounded-md border border-[var(--color-border)] bg-white px-2 text-sm"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">Todos</option>
                {CONTENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="content-status-filter">Estado</Label>
              <select
                id="content-status-filter"
                className="flex h-9 min-w-[140px] rounded-md border border-[var(--color-border)] bg-white px-2 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Todos</option>
                {CONTENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="divide-y divide-[var(--color-border)]">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/contents/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.title}
                    </Link>
                    {c.type === "IMAGE" &&
                    c.primaryMimeType &&
                    isGifMime(c.primaryMimeType) ? (
                      <Badge variant="muted" className="text-[10px] uppercase">
                        GIF
                      </Badge>
                    ) : null}
                    {c.inUse ? (
                      <Badge variant="muted" className="text-[10px]">
                        EM USO
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {c.type}
                    {c.type === "IMAGE" &&
                    c.primaryMimeType &&
                    isGifMime(c.primaryMimeType)
                      ? " · image/gif"
                      : ""}{" "}
                    ·{" "}
                    {c.type === "VIDEO" && c.durationMs === 0
                      ? "duração natural"
                      : `${c.durationMs}ms`}{" "}
                    · uso {c.usageCount ?? 0} · actualizado{" "}
                    {formatDate(c.updatedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={c.status === "ACTIVE" ? "success" : "muted"}>
                    {c.status}
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => toggleStatus(c)}
                  >
                    {c.status === "ACTIVE" ? "Desactivar" : "Activar"}
                  </Button>
                  <Link href={`/admin/contents/${c.id}`}>
                    <Button type="button" size="sm" variant="outline">
                      Abrir
                    </Button>
                  </Link>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={`Duplicar ${c.title}`}
                    disabled={busy}
                    onClick={() => handleDuplicate(c.id)}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Duplicar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={!!c.inUse || busy}
                    title={
                      c.inUse
                        ? "Não é possível remover: em uso"
                        : "Eliminar"
                    }
                    onClick={() => setDeleteItem(c)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {filtered.length === 0 ? (
              <p className="py-4 text-sm text-[var(--color-muted-foreground)]">
                Nenhum conteúdo para os filtros actuais.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {mounted && deleteItem && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 text-center shadow-xl">
            <h2 className="mb-2 text-xl font-bold">Remover conteúdo?</h2>
            <p className="mb-6 text-sm text-[var(--color-muted-foreground)]">
              Deseja remover <strong>{deleteItem.title}</strong>? O MediaAsset
              associado não será eliminado.
            </p>
            {errorMsg ? (
              <p className="mb-4 text-sm text-[var(--color-destructive)]" role="alert">
                {errorMsg}
              </p>
            ) : null}
            <div className="flex justify-center gap-3">
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
                {busy ? "A remover…" : "Eliminar"}
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

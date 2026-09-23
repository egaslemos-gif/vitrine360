"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createPlaylistAction, duplicatePlaylistAction, deletePlaylistAction } from "@/app/admin/playlists/actions";
import { MoreVertical, Edit, Copy, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ModalOverlay, ModalPanel } from "@/components/ui/modal-shell";

type Playlist = {
  id: string;
  name: string;
  version: number;
  inUse?: boolean;
  createdAt: string;
};

export function PlaylistManager({
  playlists,
}: {
  playlists: Playlist[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [multiDelete, setMultiDelete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null); // holds playlistId to delete
  const [isDeleting, setIsDeleting] = useState(false);

  async function createPlaylist(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.append("name", name);
    await createPlaylistAction(formData);
    setName("");
  }

  async function handleDuplicate(id: string) {
    await duplicatePlaylistAction(id);
  }

  async function handleDelete(id: string) {
    setIsDeleting(true);
    try {
      await deletePlaylistAction(id);
      setShowDeleteModal(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erro ao apagar a playlist");
    } finally {
      setIsDeleting(false);
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const selectable = playlists.filter((p) => !p.inUse);
    if (selectedIds.size === selectable.length && selectable.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectable.map((p) => p.id)));
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    setErrorMsg(null);
    try {
      const ids = Array.from(selectedIds);
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          await deletePlaylistAction(id);
          return id;
        })
      );
      
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        const errorMessages = failed
          .filter((r): r is PromiseRejectedResult => r.status === "rejected")
          .map((r) => (r.reason instanceof Error ? r.reason.message : undefined))
          .filter(Boolean);
        setErrorMsg(`Falha parcial: ${failed.length} itens não puderam ser removidos. ${errorMessages[0] || ""}`);
        const successIds = results
          .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
          .map((r) => r.value);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          successIds.forEach((id) => next.delete(id));
          return next;
        });
      } else {
        setMultiDelete(false);
        setSelectedIds(new Set());
      }
    } catch (err: unknown) {
      if (err instanceof Error) setErrorMsg(err.message);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="shadow-sm border-0">
        <CardHeader className="pb-3 border-b bg-muted/10 flex flex-row justify-between items-center">
          <CardTitle>Gestão de Playlists</CardTitle>
          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setMultiDelete(true)}
            >
              Remover Selecionados ({selectedIds.size})
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <form onSubmit={createPlaylist} className="flex gap-2 mb-6">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome da nova playlist..."
              required
              className="max-w-md"
            />
            <Button type="submit">
              Criar Nova
            </Button>
          </form>

          {playlists.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg border-dashed bg-muted/10">
              <p className="text-muted-foreground">Nenhuma playlist encontrada. Crie a sua primeira playlist acima.</p>
            </div>
          ) : (
            <div className="border rounded-md divide-y">
              <div className="flex items-center gap-4 px-4 py-3 bg-muted/30 font-medium text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={selectedIds.size === playlists.filter((p) => !p.inUse).length && playlists.length > 0}
                  onChange={toggleSelectAll}
                />
                <div className="flex-1">Nome</div>
                <div className="w-24 text-center">Versão</div>
                <div className="w-32 text-center">Estado</div>
                <div className="w-12"></div>
              </div>
              {playlists.map((p) => (
                <div key={p.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/10 transition-colors">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 disabled:opacity-40"
                    checked={selectedIds.has(p.id)}
                    onChange={() => toggleSelection(p.id)}
                    disabled={p.inUse}
                    title={p.inUse ? "Em uso" : undefined}
                  />
                  <div className="flex-1 min-w-0">
                    <Link href={`/admin/playlists/${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                  </div>
                  <div className="w-24 text-center text-sm text-muted-foreground">
                    v{p.version}
                  </div>
                  <div className="w-32 text-center">
                    {p.inUse ? (
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                        Em Uso
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                        Disponível
                      </span>
                    )}
                  </div>
                  <div className="w-12 flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/playlists/${p.id}`} className="flex items-center cursor-pointer">
                            <Edit className="h-4 w-4 mr-2" /> Editar
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(p.id)} className="cursor-pointer">
                          <Copy className="h-4 w-4 mr-2" /> Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setShowDeleteModal(p.id)} 
                          className="cursor-pointer text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Apagar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Eliminação Singular */}
      {showDeleteModal && createPortal(
        <ModalOverlay onClose={() => !isDeleting && setShowDeleteModal(null)}>
          <ModalPanel
            size="md"
            onClick={(e) => e.stopPropagation()}
            className="text-center"
          >
            <h2 className="mb-2 text-xl font-bold">Apagar Playlist?</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Tem a certeza que deseja eliminar esta playlist?
              Apenas poderá apagar esta playlist se ela não estiver atribuída a nenhum dispositivo ou agendamento.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <Button variant="outline" onClick={() => setShowDeleteModal(null)} disabled={isDeleting}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={() => handleDelete(showDeleteModal)} disabled={isDeleting}>
                {isDeleting ? "A apagar..." : "Sim, eliminar"}
              </Button>
            </div>
          </ModalPanel>
        </ModalOverlay>,
        document.body
      )}

      {/* Modal de Eliminação Múltipla */}
      {multiDelete && createPortal(
        <ModalOverlay onClose={() => !isDeleting && setMultiDelete(false)}>
          <ModalPanel
            size="md"
            onClick={(e) => e.stopPropagation()}
            className="text-center"
          >
            <h2 className="mb-2 text-xl font-bold">Remover {selectedIds.size} Playlists?</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Tem a certeza que deseja remover {selectedIds.size} playlists selecionadas? Esta ação não pode ser desfeita.
            </p>

            {errorMsg && (
              <p className="mb-4 text-sm text-destructive font-medium">
                {errorMsg}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <Button variant="outline" onClick={() => setMultiDelete(false)} disabled={isDeleting}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleBulkDelete} disabled={isDeleting}>
                {isDeleting ? "A remover..." : "Sim, remover"}
              </Button>
            </div>
          </ModalPanel>
        </ModalOverlay>,
        document.body
      )}
    </div>
  );
}

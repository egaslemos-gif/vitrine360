"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, X } from "lucide-react";
import { ModalOverlay, ModalPanel } from "@/components/ui/modal-shell";
import { useIsClient } from "@/lib/use-is-client";

type Group = {
  id: string;
  name: string;
  description: string | null;
  memberIds: string[];
};

export function DeviceGroupsManager({
  groups,
  devices,
  playlists,
}: {
  groups: Group[];
  devices: { id: string; label: string }[];
  playlists: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(groups[0]?.id ?? "");
  const [deviceId, setDeviceId] = useState(devices[0]?.id ?? "");
  const [playlistId, setPlaylistId] = useState(playlists[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  
  const mounted = useIsClient();

  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [editDescValue, setEditDescValue] = useState("");

  const hasGroups = groups.length > 0;
  const activeGroupId =
    groups.length === 0
      ? ""
      : groups.some((g) => g.id === selectedGroup)
        ? selectedGroup
        : (groups[0]?.id ?? "");
  const current = groups.find((g) => g.id === activeGroupId);

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/device-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Falha ao criar grupo");
      const data = (await res.json()) as { id?: string };
      const id = data.id;
      setName("");
      if (id) setSelectedGroup(id);
      router.refresh();
    } catch {
      setFeedback("Não foi possível criar o grupo.");
    } finally {
      setBusy(false);
    }
  }

  async function addMember() {
    if (!activeGroupId || !deviceId) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/device-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_member",
          groupId: activeGroupId,
          deviceId,
        }),
      });
      if (!res.ok) throw new Error("Falha ao adicionar");
      router.refresh();
    } catch {
      setFeedback("Não foi possível adicionar o device.");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(memberDeviceId: string) {
    if (!activeGroupId) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/device-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove_member",
          groupId: activeGroupId,
          deviceId: memberDeviceId,
        }),
      });
      if (!res.ok) throw new Error("Falha ao remover");
      router.refresh();
    } catch {
      setFeedback("Não foi possível remover o membro.");
    } finally {
      setBusy(false);
    }
  }

  async function assignPlaylist() {
    if (!activeGroupId || !playlistId) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/device-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_playlist",
          groupId: activeGroupId,
          playlistId,
        }),
      });
      if (!res.ok) throw new Error("Falha ao atribuir");
      const json = (await res.json()) as { devicesUpdated?: number };
      const n = json.devicesUpdated ?? 0;
      setFeedback(`Playlist atribuída a ${n} device${n === 1 ? "" : "s"}.`);
      router.refresh();
    } catch {
      setFeedback("Não foi possível atribuir a playlist.");
    } finally {
      setBusy(false);
    }
  }

  async function updateGroup() {
    if (!activeGroupId || !editNameValue.trim()) {
      return;
    }
    
    // Check if anything changed
    const newName = editNameValue.trim();
    const newDesc = editDescValue.trim() || null;
    if (newName === current?.name && newDesc === current?.description) {
      setIsEditingGroup(false);
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/device-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_group",
          groupId: activeGroupId,
          name: newName,
          description: newDesc,
        }),
      });
      if (!res.ok) throw new Error("Falha ao atualizar");
      setIsEditingGroup(false);
      router.refresh();
    } catch {
      setFeedback("Não foi possível atualizar o grupo.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteGroup() {
    if (!activeGroupId) return;
    if (!confirm("Tem a certeza que deseja apagar este grupo? Esta ação não pode ser desfeita.")) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/device-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_group",
          groupId: activeGroupId,
        }),
      });
      if (!res.ok) throw new Error("Falha ao apagar");
      setSelectedGroup("");
      router.refresh();
    } catch {
      setFeedback("Não foi possível apagar o grupo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-2 lg:items-start">
      {/* Master list */}
      <Card className="min-w-0 border-0 shadow-sm ring-1 ring-black/5">
        <CardHeader className="border-b border-[var(--color-border)] bg-[var(--color-secondary)]/10 pb-3">
          <CardTitle>Grupos</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4 pt-4">
          <form
            onSubmit={createGroup}
            className="flex min-w-0 flex-col gap-2 sm:flex-row"
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do novo grupo..."
              required
              disabled={busy}
              className="h-9 min-w-0 flex-1 bg-[var(--color-secondary)]/30"
            />
            <Button
              type="submit"
              disabled={busy}
              className="h-9 w-full shrink-0 sm:w-auto"
            >
              Criar
            </Button>
          </form>

          {!hasGroups ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-white/40 p-6 text-center">
              <p className="text-sm text-[var(--color-muted-foreground)]">
                Crie o seu primeiro grupo.
              </p>
            </div>
          ) : (
            <div className="flex max-h-[min(50vh,22rem)] flex-col gap-2 overflow-y-auto overscroll-contain pr-1 lg:max-h-[60vh]">
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setSelectedGroup(g.id);
                    setFeedback(null);
                  }}
                  className={`flex min-w-0 items-center justify-between gap-2 rounded-md border px-3 py-2.5 text-left text-sm transition-all ${
                    g.id === activeGroupId
                      ? "border-[var(--color-primary)]/20 bg-[var(--color-primary)]/10 font-medium text-[var(--color-primary)] shadow-sm"
                      : "border-transparent bg-white text-[var(--color-foreground)] hover:border-[var(--color-border)] hover:bg-[var(--color-secondary)]/30"
                  }`}
                >
                  <span className="min-w-0 truncate">{g.name}</span>
                  <span className="shrink-0 rounded-full bg-white/50 px-2 py-0.5 text-xs opacity-70">
                    {g.memberIds.length} ecrãs
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail */}
      <Card className="flex min-w-0 flex-col border-0 shadow-sm ring-1 ring-black/5">
        <CardHeader className="flex flex-row items-start justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-secondary)]/10 pb-3 sm:items-center">
          <CardTitle className="min-w-0 flex-1 truncate text-base sm:text-lg">
            {!current ? "Nenhum grupo selecionado" : `Gerir: ${current.name}`}
          </CardTitle>
          {current ? (
            <div className="ml-auto flex shrink-0 gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-[var(--color-muted-foreground)] hover:text-foreground"
                aria-label="Editar grupo"
                onClick={() => {
                  setEditNameValue(current.name);
                  setEditDescValue(current.description || "");
                  setIsEditingGroup(true);
                }}
                disabled={busy}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-[var(--color-muted-foreground)] hover:text-red-600"
                aria-label="Apagar grupo"
                onClick={deleteGroup}
                disabled={busy}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="min-w-0 pt-4">
          {!current ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-white/40 p-8 text-center sm:p-12">
              <p className="text-sm text-[var(--color-muted-foreground)]">
                Selecione um grupo na lista para gerir os seus ecrãs.
              </p>
            </div>
          ) : (
            <div className="min-w-0 space-y-6">
              {current.description ? (
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-secondary)]/20 p-3">
                  <p className="break-words text-sm text-[var(--color-muted-foreground)] whitespace-pre-wrap">
                    {current.description}
                  </p>
                </div>
              ) : null}

              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
                <select
                  className="h-9 w-full min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-secondary)]/30 px-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 disabled:opacity-50 sm:min-w-[12rem]"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  disabled={busy || devices.length === 0}
                  aria-label="Selecionar ecrã"
                >
                  {devices.length === 0 ? (
                    <option value="">Sem devices disponíveis</option>
                  ) : (
                    devices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))
                  )}
                </select>
                <Button
                  type="button"
                  onClick={addMember}
                  disabled={!deviceId || busy}
                  variant="secondary"
                  className="h-9 w-full shrink-0 sm:w-auto"
                >
                  Adicionar ecrã
                </Button>
              </div>

              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
                <select
                  className="h-9 w-full min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-secondary)]/30 px-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 disabled:opacity-50 sm:min-w-[12rem]"
                  value={playlistId}
                  onChange={(e) => setPlaylistId(e.target.value)}
                  disabled={busy || playlists.length === 0}
                  aria-label="Selecionar playlist"
                >
                  {playlists.length === 0 ? (
                    <option value="">Sem playlists disponíveis</option>
                  ) : (
                    playlists.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))
                  )}
                </select>
                <Button
                  type="button"
                  onClick={assignPlaylist}
                  disabled={!playlistId || busy}
                  className="h-9 w-full shrink-0 sm:w-auto"
                >
                  Atribuir playlist
                </Button>
              </div>

              {feedback ? (
                <p
                  className="rounded-md bg-[var(--color-primary)]/10 px-3 py-2 text-sm font-medium break-words text-[var(--color-primary)]"
                  role="status"
                >
                  {feedback}
                </p>
              ) : null}

              <div className="border-t border-[var(--color-border)] pt-4">
                <h3 className="mb-3 text-sm font-semibold">
                  Membros do Grupo ({current.memberIds.length})
                </h3>
                {current.memberIds.length === 0 ? (
                  <p className="text-sm text-[var(--color-muted-foreground)]">
                    Este grupo não tem ecrãs associados.
                  </p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {current.memberIds.map((id) => {
                      const d = devices.find((x) => x.id === id);
                      return (
                        <li
                          key={id}
                          className="flex min-w-0 flex-col gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-secondary)]/10 px-3 py-2.5 transition-colors hover:bg-[var(--color-secondary)]/30 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="min-w-0 truncate">
                            {d?.label ?? id}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => removeMember(id)}
                            className="h-9 w-full px-2 text-xs text-red-500 hover:bg-red-50 hover:text-red-700 sm:h-7 sm:w-auto"
                          >
                            Remover
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Group Modal */}
      {mounted && isEditingGroup && createPortal(
        <ModalOverlay onClose={() => !busy && setIsEditingGroup(false)}>
          <ModalPanel size="md" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setIsEditingGroup(false)}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              disabled={busy}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Fechar</span>
            </button>

            <h2 className="mb-4 pr-8 text-lg font-semibold leading-none tracking-tight text-[var(--color-foreground)]">
              Editar Grupo
            </h2>

            <div className="space-y-4">
              <div className="w-full min-w-0 space-y-2">
                <Label htmlFor="group-name">Nome do Grupo</Label>
                <Input
                  id="group-name"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  placeholder="Ex: Montra Principal"
                  disabled={busy}
                  className="bg-white"
                />
              </div>
              <div className="w-full min-w-0 space-y-2">
                <Label htmlFor="group-desc">
                  Descrição{" "}
                  <span className="text-[var(--color-muted-foreground)] font-normal text-xs">
                    (Opcional)
                  </span>
                </Label>
                <textarea
                  id="group-desc"
                  value={editDescValue}
                  onChange={(e) => setEditDescValue(e.target.value)}
                  placeholder="Detalhes ou anotações sobre este grupo..."
                  disabled={busy}
                  rows={3}
                  className="flex min-h-[80px] w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <Button type="button" variant="outline" onClick={() => setIsEditingGroup(false)} disabled={busy}>
                Cancelar
              </Button>
              <Button type="button" onClick={updateGroup} disabled={busy || !editNameValue.trim()}>
                {busy ? "A guardar..." : "Guardar Alterações"}
              </Button>
            </div>
          </ModalPanel>
        </ModalOverlay>,
        document.body
      )}
    </div>
  );
}

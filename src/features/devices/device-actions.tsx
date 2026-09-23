"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ListVideo, MoreVertical, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalOverlay, ModalPanel } from "@/components/ui/modal-shell";
import { useIsClient } from "@/lib/use-is-client";
import { AssignPlaylistForm } from "@/features/devices/assign-playlist-form";

type DeviceData = {
  id: string;
  name: string;
  deviceCode: string;
  location: string | null;
};

export function DeviceActions({
  device,
  playlists,
  currentPlaylistId,
}: {
  device: DeviceData;
  playlists?: { id: string; name: string }[];
  currentPlaylistId?: string | null;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const mounted = useIsClient();

  const [name, setName] = useState(device.name);
  const [deviceCode, setDeviceCode] = useState(device.deviceCode);
  const [location, setLocation] = useState(device.location ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/devices/${device.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, deviceCode, location }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to update device");
      }
      setEditOpen(false);
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("Ocorreu um erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/devices/${device.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to delete device");
      }
      setDeleteOpen(false);
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("Ocorreu um erro desconhecido.");
      setLoading(false);
    }
  }

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          aria-label="Acções do ecrã"
          title="Mais acções"
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-md p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-elevated)]">
            {playlists ? (
              <button
                type="button"
                onClick={() => {
                  setAssignOpen(true);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)]"
              >
                <ListVideo className="h-3.5 w-3.5 opacity-70" />
                Atribuir playlist
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setEditOpen(true);
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)]"
            >
              <Pencil className="h-3.5 w-3.5 opacity-70" />
              Editar
            </button>
            <button
              type="button"
              onClick={() => {
                setDeleteOpen(true);
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--color-destructive)] transition-colors hover:bg-[var(--color-muted)]"
            >
              <Trash2 className="h-3.5 w-3.5 opacity-70" />
              Remover
            </button>
          </div>
        )}
      </div>

      {mounted &&
        assignOpen &&
        playlists &&
        createPortal(
          <ModalOverlay onClose={() => setAssignOpen(false)}>
            <ModalPanel size="md" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setAssignOpen(false)}
                className="absolute right-4 top-4 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              >
                <X className="h-5 w-5" />
              </button>
              <h2 className="mb-1 pr-8 text-lg font-semibold text-[var(--color-text-primary)]">
                Atribuir playlist
              </h2>
              <p className="ui-secondary mb-4">{device.name}</p>
              <AssignPlaylistForm
                deviceId={device.id}
                playlists={playlists}
                currentPlaylistId={currentPlaylistId ?? null}
              />
            </ModalPanel>
          </ModalOverlay>,
          document.body,
        )}

      {mounted &&
        editOpen &&
        createPortal(
          <ModalOverlay onClose={() => !loading && setEditOpen(false)}>
            <ModalPanel size="md" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setEditOpen(false)}
                className="absolute right-4 top-4 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              >
                <X className="h-5 w-5" />
              </button>
              <h2 className="mb-4 pr-8 text-lg font-semibold text-[var(--color-text-primary)]">
                Editar Ecrã
              </h2>
              <form onSubmit={handleEdit} className="w-full min-w-0 space-y-4">
                <div className="w-full min-w-0 space-y-2">
                  <Label htmlFor="edit-name">Nome</Label>
                  <Input
                    id="edit-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="w-full min-w-0 space-y-2">
                  <Label htmlFor="edit-code">Código</Label>
                  <Input
                    id="edit-code"
                    value={deviceCode}
                    onChange={(e) => setDeviceCode(e.target.value)}
                    required
                  />
                </div>
                <div className="w-full min-w-0 space-y-2">
                  <Label htmlFor="edit-location">Localização</Label>
                  <Input
                    id="edit-location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
                {error ? (
                  <p className="text-sm text-[var(--color-destructive)]">{error}</p>
                ) : null}
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "A Guardar..." : "Guardar"}
                  </Button>
                </div>
              </form>
            </ModalPanel>
          </ModalOverlay>,
          document.body,
        )}

      {mounted &&
        deleteOpen &&
        createPortal(
          <ModalOverlay onClose={() => !loading && setDeleteOpen(false)}>
            <ModalPanel size="md" onClick={(e) => e.stopPropagation()}>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-danger)]/10">
                <Trash2 className="h-6 w-6 text-[var(--color-danger)]" />
              </div>
              <h2 className="mb-2 text-center text-lg font-semibold text-[var(--color-text-primary)]">
                Remover ecrã?
              </h2>
              <p className="mb-6 text-center text-sm text-[var(--color-muted-foreground)]">
                Vai remover permanentemente <strong>{device.name}</strong>.
              </p>
              {error ? (
                <p className="mb-4 text-center text-sm text-[var(--color-destructive)]">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center sm:gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  {loading ? "A remover..." : "Remover"}
                </Button>
              </div>
            </ModalPanel>
          </ModalOverlay>,
          document.body,
        )}
    </>
  );
}

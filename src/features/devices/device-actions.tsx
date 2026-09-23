"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIsClient } from "@/lib/use-is-client";

type DeviceData = {
  id: string;
  name: string;
  deviceCode: string;
  location: string | null;
};

export function DeviceActions({ device }: { device: DeviceData }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  
  const menuRef = useRef<HTMLDivElement>(null);

  const mounted = useIsClient();

  // Form states
  const [name, setName] = useState(device.name);
  const [deviceCode, setDeviceCode] = useState(device.deviceCode);
  const [location, setLocation] = useState(device.location ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close menu on click outside
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
      {/* Dropdown Menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-md p-1.5 text-[var(--color-muted-foreground)] hover:bg-[var(--color-secondary)] hover:text-[var(--color-foreground)] transition-colors"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-10 mt-1 w-40 overflow-hidden rounded-md border border-[var(--color-border)] bg-white shadow-md animate-in fade-in zoom-in-95">
            <button
              onClick={() => { setEditOpen(true); setMenuOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-secondary)] transition-colors"
            >
              <Pencil className="h-3.5 w-3.5 opacity-70" />
              Editar Ecrã
            </button>
            <button
              onClick={() => { setDeleteOpen(true); setMenuOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--color-destructive)] hover:bg-[var(--color-secondary)] transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5 opacity-70" />
              Remover Ecrã
            </button>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {mounted && editOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setEditOpen(false)}
              className="absolute right-4 top-4 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="mb-4 text-xl font-bold text-[var(--color-foreground)]">Editar Ecrã</h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome Descritivo</Label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-code">Código (ID)</Label>
                <Input
                  id="edit-code"
                  value={deviceCode}
                  onChange={(e) => setDeviceCode(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-location">Localização Física</Label>
                <Input
                  id="edit-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}
              <div className="mt-6 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "A Guardar..." : "Guardar Alterações"}
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {mounted && deleteOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl text-center relative animate-in fade-in zoom-in-95">
             <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
               <Trash2 className="h-6 w-6 text-red-600" />
             </div>
            <h2 className="mb-2 text-xl font-bold text-[var(--color-foreground)]">Tem a certeza?</h2>
            <p className="mb-6 text-sm text-[var(--color-muted-foreground)]">
              Vai remover permanentemente o ecrã <strong>{device.name}</strong>. Esta ação não pode ser desfeita e o ecrã deixará de receber atualizações do Vitrine360.
            </p>
            {error && <p className="text-sm text-[var(--color-destructive)] mb-4">{error}</p>}
            <div className="flex justify-center gap-3">
              <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={loading}>
                {loading ? "A remover..." : "Sim, remover ecrã"}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

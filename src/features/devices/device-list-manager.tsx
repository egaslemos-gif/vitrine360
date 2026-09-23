"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MonitorPlay, Search, X, Trash2 } from "lucide-react";
import { LivePresence } from "@/features/devices/live-presence";
import { DeviceActions } from "@/features/devices/device-actions";
import { AssignPlaylistForm } from "@/features/devices/assign-playlist-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useIsClient } from "@/lib/use-is-client";
import type { DeviceRuntimeObservability } from "@/domain/device-observability";
import { deriveDeviceRuntimeObservability } from "@/domain/device-observability";

type Device = {
  id: string;
  name: string | null;
  deviceCode: string | null;
  location: string | null;
  status: string;
  presence: "ONLINE" | "AWAY" | "OFFLINE";
  manifestVersion: number | null;
  currentPlaylistId: string | null;
  displayType: string;
  lastSeenAt: string | null;
  playerState?: string | null;
};

type Playlist = {
  id: string;
  name: string;
};

type Group = {
  id: string;
  name: string;
  memberIds: string[];
};

type LiveRow = {
  presence: "ONLINE" | "AWAY" | "OFFLINE";
  manifestVersion: number | null;
  lastSeenAt: string | null;
  observability: DeviceRuntimeObservability;
};

export function DeviceListManager({
  devices,
  playlists,
  groups,
}: {
  devices: Device[];
  playlists: Playlist[];
  groups: Group[];
}) {
  const [search, setSearch] = useState("");
  const [presenceFilter, setPresenceFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [playlistFilter, setPlaylistFilter] = useState("ALL");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const mounted = useIsClient();
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [polledMap, setPolledMap] = useState<Record<string, LiveRow> | null>(
    null,
  );

  const router = useRouter();

  const seededMap = useMemo(() => {
    const seed: Record<string, LiveRow> = {};
    for (const d of devices) {
      seed[d.id] = {
        presence: d.presence,
        manifestVersion: d.manifestVersion,
        lastSeenAt: d.lastSeenAt,
        observability: deriveDeviceRuntimeObservability({
          presence: d.presence,
          lastSeenAt: d.lastSeenAt,
          playerStateRaw: d.playerState,
          manifestVersion: d.manifestVersion,
        }),
      };
    }
    return seed;
  }, [devices]);

  const liveMap = polledMap ?? seededMap;

  // Single centralized poll for all cards
  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch("/api/admin/devices/presence");
        if (!res.ok) return;
        const data = (await res.json()) as {
          devices?: Record<
            string,
            {
              presence: LiveRow["presence"];
              manifestVersion: number | null;
              lastSeenAt: string | null;
              observability: DeviceRuntimeObservability;
            }
          >;
        };
        if (!data.devices) return;
        const next: Record<string, LiveRow> = {};
        for (const [id, row] of Object.entries(data.devices)) {
          if (!row.observability) continue;
          next[id] = {
            presence: row.presence,
            manifestVersion: row.manifestVersion,
            lastSeenAt: row.lastSeenAt,
            observability: row.observability,
          };
        }
        setPolledMap(next);
      } catch {
        /* ignore */
      }
    };
    void tick();
    const id = window.setInterval(tick, 10_000);
    return () => window.clearInterval(id);
  }, []);

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      const q = search.toLowerCase();
      if (
        q &&
        !d.name?.toLowerCase().includes(q) &&
        !d.deviceCode?.toLowerCase().includes(q)
      ) {
        return false;
      }

      const livePresence = liveMap[d.id]?.presence ?? d.presence;
      if (presenceFilter !== "ALL" && livePresence !== presenceFilter) {
        return false;
      }

      if (categoryFilter !== "ALL" && d.displayType !== categoryFilter) {
        return false;
      }

      if (groupFilter !== "ALL") {
        const group = groups.find((g) => g.id === groupFilter);
        if (!group || !group.memberIds.includes(d.id)) {
          return false;
        }
      }

      if (playlistFilter === "ASSIGNED" && !d.currentPlaylistId) {
        return false;
      }
      if (playlistFilter === "UNASSIGNED" && d.currentPlaylistId) {
        return false;
      }

      return true;
    });
  }, [
    devices,
    search,
    presenceFilter,
    categoryFilter,
    groupFilter,
    playlistFilter,
    groups,
    liveMap,
  ]);

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredDevices.length && filteredDevices.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDevices.map(d => d.id)));
    }
  };

  async function handleBulkDelete() {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const promises = Array.from(selectedIds).map(id =>
        fetch(`/api/admin/devices/${id}`, { method: "DELETE" })
      );
      const results = await Promise.allSettled(promises);
      
      const failed = results.filter(r => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok));
      if (failed.length > 0) {
        throw new Error(`Falha ao remover ${failed.length} ecrãs. Tente novamente.`);
      }

      setBulkDeleteOpen(false);
      setSelectedIds(new Set());
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) setDeleteError(err.message);
      else setDeleteError("Ocorreu um erro desconhecido.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center bg-white p-4 rounded-xl shadow-sm ring-1 ring-black/5">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-muted-foreground)]" />
          <Input
            placeholder="Procurar ecrã (nome ou código)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-[var(--color-secondary)]/30 border-[var(--color-border)]"
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          <select
            value={presenceFilter}
            onChange={(e) => setPresenceFilter(e.target.value)}
            className="h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-secondary)]/30 px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
          >
            <option value="ALL">Estado: Todos</option>
            <option value="ONLINE">Online</option>
            <option value="AWAY">Instáveis</option>
            <option value="OFFLINE">Offline</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-secondary)]/30 px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
          >
            <option value="ALL">Categoria: Todas</option>
            <option value="TV">TV</option>
            <option value="TOUCH_DISPLAY">Touch Display</option>
            <option value="LED">LED</option>
            <option value="KIOSK">Kiosk</option>
            <option value="VIDEO_WALL">Video Wall</option>
            <option value="TABLET">Tablet</option>
            <option value="OTHER">Outro</option>
          </select>

          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-secondary)]/30 px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
          >
            <option value="ALL">Grupo: Todos</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          <select
            value={playlistFilter}
            onChange={(e) => setPlaylistFilter(e.target.value)}
            className="h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-secondary)]/30 px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
          >
            <option value="ALL">Playlist: Todas</option>
            <option value="ASSIGNED">Com Playlist</option>
            <option value="UNASSIGNED">Sem Playlist</option>
          </select>

          {(search || presenceFilter !== "ALL" || categoryFilter !== "ALL" || groupFilter !== "ALL" || playlistFilter !== "ALL") && (
            <button
              onClick={() => {
                setSearch("");
                setPresenceFilter("ALL");
                setCategoryFilter("ALL");
                setGroupFilter("ALL");
                setPlaylistFilter("ALL");
              }}
              title="Limpar todos os filtros"
              className="h-9 px-3 flex items-center justify-center rounded-md border border-[var(--color-border)] text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors"
            >
              <X className="h-4 w-4 mr-2" />
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Device Grid Header */}
      <div className="flex items-center justify-between mt-6">
        <h2 className="text-xl font-semibold tracking-tight">Ecrãs Registados ({filteredDevices.length})</h2>
        {filteredDevices.length > 0 && (
          <button
            onClick={toggleAll}
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            {selectedIds.size === filteredDevices.length ? "Desmarcar Todos" : "Selecionar Todos"}
          </button>
        )}
      </div>
      
      {filteredDevices.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl border-dashed bg-white/40">
          <p className="text-[var(--color-muted-foreground)]">Nenhum ecrã encontrado com os filtros atuais.</p>
          <button 
            onClick={() => {
              setSearch("");
              setPresenceFilter("ALL");
              setCategoryFilter("ALL");
              setGroupFilter("ALL");
              setPlaylistFilter("ALL");
            }}
            className="mt-2 text-sm text-[var(--color-primary)] font-medium hover:underline"
          >
            Limpar Filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          {filteredDevices.map((d) => (
            <Card key={d.id} className="overflow-hidden shadow-sm transition-all hover:shadow-md border-0 ring-1 ring-black/5 bg-white">
              <CardHeader className="bg-[var(--color-secondary)]/30 border-b border-[var(--color-border)] px-4 py-4 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3 truncate">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(d.id)}
                    onChange={() => toggleSelection(d.id)}
                    className="w-4 h-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
                  />
                  <div className="p-2 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-md shrink-0">
                    <MonitorPlay className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate" title={d.name ?? ""}>
                      <Link
                        href={`/admin/devices/${d.id}`}
                        className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                      >
                        {d.name}
                      </Link>
                    </CardTitle>
                    <CardDescription className="text-xs truncate">
                      {d.deviceCode} · {d.displayType} ·{" "}
                      {d.location ?? "Sem localização"}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <LivePresence
                    presence={liveMap[d.id]?.presence ?? d.presence}
                    version={
                      liveMap[d.id]?.manifestVersion ?? d.manifestVersion ?? 0
                    }
                    lastSeenAt={liveMap[d.id]?.lastSeenAt ?? d.lastSeenAt}
                    observability={liveMap[d.id]?.observability ?? null}
                  />
                  <DeviceActions device={{ id: d.id, name: d.name ?? "", deviceCode: d.deviceCode ?? "", location: d.location }} />
                </div>
              </CardHeader>
              <CardContent className="p-4 bg-white">
                <div className="pt-2">
                  <AssignPlaylistForm
                    deviceId={d.id}
                    playlists={playlists}
                    currentPlaylistId={d.currentPlaylistId}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[var(--color-primary)] text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-4 animate-in slide-in-from-bottom-5">
          <span className="font-medium text-sm">{selectedIds.size} ecrã{selectedIds.size > 1 ? "s" : ""} selecionado{selectedIds.size > 1 ? "s" : ""}</span>
          <div className="w-px h-4 bg-white/30" />
          <button 
            onClick={() => setBulkDeleteOpen(true)}
            className="flex items-center text-sm font-medium hover:text-red-200 transition-colors"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Remover
          </button>
          <button 
            onClick={() => setSelectedIds(new Set())}
            className="ml-2 p-1 hover:bg-white/10 rounded-full transition-colors"
            title="Cancelar seleção"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {mounted && bulkDeleteOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl text-center relative animate-in fade-in zoom-in-95">
             <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
               <Trash2 className="h-6 w-6 text-red-600" />
             </div>
            <h2 className="mb-2 text-xl font-bold text-[var(--color-foreground)]">Remover {selectedIds.size} ecrã{selectedIds.size > 1 ? "s" : ""}?</h2>
            <p className="mb-6 text-sm text-[var(--color-muted-foreground)]">
              Vai remover permanentemente {selectedIds.size} ecrã{selectedIds.size > 1 ? "s" : ""}. Esta ação não pode ser desfeita e os ecrãs selecionados deixarão de receber atualizações do Vitrine360.
            </p>
            {deleteError && <p className="text-sm text-[var(--color-destructive)] mb-4">{deleteError}</p>}
            <div className="flex justify-center gap-3">
              <Button type="button" variant="outline" onClick={() => setBulkDeleteOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" onClick={handleBulkDelete} disabled={isDeleting}>
                {isDeleting ? "A remover..." : "Sim, remover"}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

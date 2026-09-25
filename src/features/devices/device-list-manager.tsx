"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FilterBar } from "@/components/ui/filter-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { MonitorPlay, Search, X, Trash2, MapPin, LayoutGrid, List } from "lucide-react";
import { DeviceActions } from "@/features/devices/device-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ModalOverlay, ModalPanel } from "@/components/ui/modal-shell";
import { useIsClient } from "@/lib/use-is-client";
import type { DeviceRuntimeObservability } from "@/domain/device-observability";
import { deriveDeviceRuntimeObservability } from "@/domain/device-observability";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  const [locationFilter, setLocationFilter] = useState("ALL");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [playlistFilter, setPlaylistFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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

  const locations = useMemo(() => {
    const set = new Set<string>();
    for (const d of devices) {
      if (d.location?.trim()) set.add(d.location.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, "pt"));
  }, [devices]);

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      const q = search.toLowerCase().trim();
      if (q) {
        const hay = `${d.name ?? ""} ${d.deviceCode ?? ""} ${d.location ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      const livePresence = liveMap[d.id]?.presence ?? d.presence;
      if (presenceFilter !== "ALL" && livePresence !== presenceFilter) {
        return false;
      }

      if (locationFilter !== "ALL" && (d.location ?? "").trim() !== locationFilter) {
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
    locationFilter,
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
      <FilterBar>
        <div className="relative min-w-0 w-full flex-1 sm:min-w-[12rem]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-muted-foreground)]" />
          <Input
            placeholder="Procurar por nome, código ou local..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 border-[var(--color-border)] bg-[var(--color-secondary)]/30 pl-9"
            aria-label="Pesquisar ecrãs"
          />
        </div>

        <div className="flex min-w-0 w-full flex-wrap items-center gap-2 md:w-auto">
          <select
            value={presenceFilter}
            onChange={(e) => setPresenceFilter(e.target.value)}
            aria-label="Filtrar por estado"
            className="h-9 min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-secondary)]/30 px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 sm:flex-none"
          >
            <option value="ALL">Estado: Todos</option>
            <option value="ONLINE">Online</option>
            <option value="AWAY">Instáveis</option>
            <option value="OFFLINE">Offline</option>
          </select>

          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            aria-label="Filtrar por grupo"
            className="h-9 min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-secondary)]/30 px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 sm:flex-none"
          >
            <option value="ALL">Grupo: Todos</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            aria-label="Filtrar por local"
            className="h-9 min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-secondary)]/30 px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 sm:flex-none"
          >
            <option value="ALL">Local: Todos</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>

          <select
            value={playlistFilter}
            onChange={(e) => setPlaylistFilter(e.target.value)}
            aria-label="Filtrar por playlist"
            className="h-9 min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-secondary)]/30 px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 sm:flex-none"
          >
            <option value="ALL">Playlist: Todas</option>
            <option value="ASSIGNED">Com Playlist</option>
            <option value="UNASSIGNED">Sem Playlist</option>
          </select>

          <div
            className="ml-auto flex overflow-hidden rounded-md border border-[var(--color-border)]"
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

          {(search ||
            presenceFilter !== "ALL" ||
            locationFilter !== "ALL" ||
            groupFilter !== "ALL" ||
            playlistFilter !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPresenceFilter("ALL");
                setLocationFilter("ALL");
                setGroupFilter("ALL");
                setPlaylistFilter("ALL");
              }}
              title="Limpar todos os filtros"
              className="flex h-9 items-center justify-center rounded-md border border-[var(--color-border)] px-3 text-sm text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]"
            >
              <X className="mr-2 h-4 w-4" />
              Limpar
            </button>
          )}
        </div>
      </FilterBar>

      <div className="mt-2 flex items-center justify-between">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {filteredDevices.length} ecrã{filteredDevices.length === 1 ? "" : "s"}
        </p>
        {filteredDevices.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            {selectedIds.size === filteredDevices.length
              ? "Desmarcar Todos"
              : "Selecionar Todos"}
          </button>
        )}
      </div>
      
      {filteredDevices.length === 0 ? (
        <EmptyState
          title="Nenhum ecrã encontrado"
          description="Ajuste os filtros ou registe um novo ecrã para começar."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setPresenceFilter("ALL");
                setLocationFilter("ALL");
                setGroupFilter("ALL");
                setPlaylistFilter("ALL");
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
              ? "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
              : "flex flex-col gap-2"
          }
        >
          {filteredDevices.map((d) => {
            const live = liveMap[d.id];
            const presence = live?.presence ?? d.presence;
            const playlistName =
              playlists.find((p) => p.id === d.currentPlaylistId)?.name ??
              "—";
            const deviceData = {
              id: d.id,
              name: d.name ?? "",
              deviceCode: d.deviceCode ?? "",
              location: d.location,
            };
            return (
              <Card
                key={d.id}
                className={
                  viewMode === "list"
                    ? "border border-[var(--color-border)] bg-[var(--color-surface)] shadow-none"
                    : "border border-[var(--color-border)] bg-[var(--color-surface)] shadow-none transition-colors hover:border-[var(--color-primary)]/30"
                }
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0 px-4 pb-2 pt-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(d.id)}
                      onChange={() => toggleSelection(d.id)}
                      aria-label={`Seleccionar ${d.name ?? d.deviceCode ?? d.id}`}
                      className="mt-1 h-4 w-4 cursor-pointer rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                    />
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]">
                      <MonitorPlay className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="ui-card-title truncate" title={d.name ?? ""}>
                          <Link
                            href={`/admin/devices/${d.id}`}
                            className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                          >
                            {d.name ?? "Sem nome"}
                          </Link>
                        </CardTitle>
                        <StatusBadge status={presence} />
                      </div>
                      <p className="ui-caption mt-1 flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                        <span className="truncate">
                          {d.displayType}
                          {d.location ? ` · ${d.location}` : ""}
                        </span>
                      </p>
                    </div>
                  </div>
                  <DeviceActions
                    device={deviceData}
                    playlists={playlists}
                    currentPlaylistId={d.currentPlaylistId}
                  />
                </CardHeader>
                <CardContent className="space-y-3 px-4 pb-3">
                  <div className="ui-meta-grid">
                    <div>
                      <p className="ui-caption">Último contacto</p>
                      <p className="ui-secondary mt-0.5 tabular-nums">
                        {(live?.lastSeenAt ?? d.lastSeenAt)
                          ? new Date(
                              (live?.lastSeenAt ?? d.lastSeenAt) as string,
                            ).toLocaleString("pt-PT")
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="ui-caption">Manifest</p>
                      <p className="ui-secondary mt-0.5">
                        v{live?.manifestVersion ?? d.manifestVersion ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="ui-caption">Playlist</p>
                    <p className="ui-secondary mt-0.5 truncate">{playlistName}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Link
                      href={`/admin/devices/${d.id}`}
                      className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                    >
                      Ver detalhes
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
        <ModalOverlay onClose={() => !isDeleting && setBulkDeleteOpen(false)}>
          <ModalPanel size="md" onClick={(e) => e.stopPropagation()} className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-[var(--color-foreground)]">
              Remover {selectedIds.size} ecrã{selectedIds.size > 1 ? "s" : ""}?
            </h2>
            <p className="mb-6 text-sm text-[var(--color-muted-foreground)]">
              Vai remover permanentemente {selectedIds.size} ecrã{selectedIds.size > 1 ? "s" : ""}. Esta ação não pode ser desfeita e os ecrãs selecionados deixarão de receber atualizações do Vitrine360.
            </p>
            {deleteError && (
              <p className="mb-4 text-sm text-[var(--color-destructive)]">{deleteError}</p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <Button type="button" variant="outline" onClick={() => setBulkDeleteOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" onClick={handleBulkDelete} disabled={isDeleting}>
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

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AssignPlaylistForm({
  deviceId,
  playlists,
  currentPlaylistId,
  compact = false,
}: {
  deviceId: string;
  playlists: { id: string; name: string }[];
  currentPlaylistId: string | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [playlistId, setPlaylistId] = useState(currentPlaylistId ?? "");
  const [status, setStatus] = useState<string | null>(null);

  async function assign() {
    if (!playlistId) return;
    setStatus(null);
    const targetId = playlistId === "none" ? null : playlistId;
    const res = await fetch(`/api/admin/devices/${deviceId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playlistId: targetId }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setStatus(data.error ?? "Erro");
      return;
    }
    setStatus(
      targetId
        ? "Playlist atribuída · manifest actualizado"
        : "Playlist removida · manifest actualizado",
    );
    router.refresh();
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", compact && "gap-1.5")}>
      <select
        className={cn(
          "rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-secondary)]",
          compact ? "h-8 max-w-[11rem] px-1.5 text-xs" : "h-9 px-2",
        )}
        value={playlistId}
        onChange={(e) => setPlaylistId(e.target.value)}
        aria-label="Seleccionar playlist"
      >
        <option value="" disabled>
          Seleccione uma playlist
        </option>
        <option value="none">-- Nenhuma (Desatribuir) --</option>
        {playlists.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={compact ? "h-8 px-2 text-xs" : undefined}
        onClick={assign}
      >
        Atribuir
      </Button>
      {status ? (
        <span className="ui-caption">{status}</span>
      ) : null}
    </div>
  );
}

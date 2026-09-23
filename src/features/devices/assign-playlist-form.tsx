"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function AssignPlaylistForm({
  deviceId,
  playlists,
  currentPlaylistId,
}: {
  deviceId: string;
  playlists: { id: string; name: string }[];
  currentPlaylistId: string | null;
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
    setStatus(targetId ? "Playlist atribuída · manifest actualizado" : "Playlist removida · manifest actualizado");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className="h-9 rounded-md border border-[var(--color-border)] bg-white px-2 text-sm"
        value={playlistId}
        onChange={(e) => setPlaylistId(e.target.value)}
      >
        <option value="" disabled>Seleccione uma playlist</option>
        <option value="none">-- Nenhuma (Desatribuir) --</option>
        {playlists.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <Button type="button" size="sm" onClick={assign}>
        Atribuir
      </Button>
      {status ? (
        <span className="text-xs text-[var(--color-muted-foreground)]">
          {status}
        </span>
      ) : null}
    </div>
  );
}

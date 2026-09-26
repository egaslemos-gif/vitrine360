/**
 * RUNTIME-PLAYBACK-04 — Single time formatting helper for Player controls.
 */

export function formatPlaybackTime(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "--:--";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

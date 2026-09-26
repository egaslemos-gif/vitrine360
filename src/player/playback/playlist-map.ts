/**
 * RUNTIME-PLAYBACK-02/03 — Map DisplayEngine PlaybackItem → controller playlist item.
 * Timing classification lives in `@/domain/playback-timing`.
 */

import type { PlaybackPlaylistItem } from "@/domain/playback-state";
export {
  classifyTiming,
  effectiveDurationMs,
  usesNativeMediaEnded,
  usesPresentationTimer,
  PresentationTimer,
} from "@/domain/playback-timing";

export type EnginePlaybackItem = {
  playlistItemId: string;
  contentId: string;
  type: string;
  title: string;
  /** Already resolved: durationOverrideMs ?? content.durationMs (see manifest). */
  durationMs: number;
  transition: string;
  fitMode?: string;
  payload: Record<string, unknown>;
  assets: {
    id: string;
    mimeType: string;
    url?: string;
    offlineUrl?: string;
    checksum?: string;
  }[];
  experienceExecutable?: boolean;
  experienceBlockReason?: string;
};

export function toPlaylistItems(
  items: EnginePlaybackItem[],
): PlaybackPlaylistItem[] {
  return items.map((item) => ({
    playlistItemId: item.playlistItemId,
    contentId: item.contentId,
    type: item.type,
    durationMs: item.durationMs,
    title: item.title,
  }));
}

/**
 * Fingerprint for soft sync — content order + durations + ids.
 * Avoids reloading controller on unrelated parent re-renders.
 */
export function playlistFingerprint(items: EnginePlaybackItem[]): string {
  return items
    .map(
      (i) =>
        `${i.playlistItemId}:${i.contentId}:${i.type}:${i.durationMs}:${i.transition}`,
    )
    .join("|");
}

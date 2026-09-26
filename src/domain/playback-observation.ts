/**
 * RUNTIME-PLAYBACK-06 — PlaybackObservation (projection, not SoT).
 *
 * Derived from PlaybackState. Never a command authority.
 */

import type {
  PlaybackError,
  PlaybackState,
  PlaybackStatus,
  RepeatMode,
} from "@/domain/playback-state";

export type PlaybackObservation = {
  status: PlaybackStatus;
  contentId: string | null;
  contentType: string | null;
  playlistId: string | null;
  playlistItemId: string | null;
  itemIndex: number;
  positionMs: number;
  /** null = unknown (natural media before metadata). Never coerce to 0. */
  durationMs: number | null;
  generation: number;
  repeatMode: RepeatMode;
  volume: number;
  muted: boolean;
  error: PlaybackError | null;
  updatedAt: number;
  observedAt: number;
};

/** Compact heartbeat-safe subset — no position ticks, no secrets. */
export type CompactPlaybackObservation = {
  status: PlaybackStatus;
  contentId: string | null;
  contentType: string | null;
  playlistId: string | null;
  playlistItemId: string | null;
  generation: number;
  /** Optional snapshot at heartbeat time — not a continuous stream. */
  positionMs?: number;
  durationMs?: number | null;
  errorCode?: string | null;
  observedAt: string;
};

export function playbackObservationFromState(
  state: PlaybackState,
  observedAt = state.updatedAt,
): PlaybackObservation {
  return {
    status: state.status,
    contentId: state.currentContentId,
    contentType: state.currentContentType,
    playlistId: state.playlistId,
    playlistItemId: state.currentPlaylistItemId,
    itemIndex: state.currentItemIndex,
    positionMs: state.positionMs,
    durationMs: state.durationMs,
    generation: state.generation,
    repeatMode: state.repeatMode,
    volume: state.volume,
    muted: state.muted,
    error: state.error ? { ...state.error } : null,
    updatedAt: state.updatedAt,
    observedAt,
  };
}

export function compactPlaybackObservation(
  obs: PlaybackObservation,
): CompactPlaybackObservation {
  return {
    status: obs.status,
    contentId: obs.contentId,
    contentType: obs.contentType,
    playlistId: obs.playlistId,
    playlistItemId: obs.playlistItemId,
    generation: obs.generation,
    positionMs: obs.positionMs,
    durationMs: obs.durationMs,
    errorCode: obs.error?.code ?? null,
    observedAt: new Date(obs.observedAt).toISOString(),
  };
}

/** Status transitions that count as session activity (not timeupdate). */
export function isPlaybackActivityTransition(
  prev: PlaybackState | null,
  next: PlaybackState,
): boolean {
  if (!prev) return true;
  if (prev.status !== next.status) return true;
  if (prev.currentContentId !== next.currentContentId) return true;
  if (prev.currentPlaylistItemId !== next.currentPlaylistItemId) return true;
  if (prev.playlistId !== next.playlistId) return true;
  if (prev.manifestVersion !== next.manifestVersion) return true;
  if (prev.volume !== next.volume) return true;
  if (prev.muted !== next.muted) return true;
  if (prev.repeatMode !== next.repeatMode) return true;
  if (prev.generation !== next.generation) return true;
  if ((prev.error?.code ?? null) !== (next.error?.code ?? null)) return true;
  // Seek commit: large position jump while same generation may still be seek —
  // treat only when status stable and position delta > 400ms without generation change
  // is handled by controller SEEK which also bumps updatedAt; we detect via
  // generation-stable large jump only if caller marks seek — skip timeupdate noise.
  return false;
}

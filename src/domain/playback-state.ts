/**
 * RUNTIME-PLAYBACK-01 — Canonical Playback State Model.
 *
 * Pure domain types. No React, DOM, network, auth, or DB imports.
 * Separated from: RuntimeState (policy/sync), Presence, Remote Commands.
 */

import type { ContentType } from "@/domain/types";
import { CONTENT_TYPES } from "@/domain/types";

export const PLAYBACK_STATUSES = [
  "IDLE",
  "LOADING",
  "PLAYING",
  "PAUSED",
  "STOPPED",
  "ENDED",
  "ERROR",
] as const;
export type PlaybackStatus = (typeof PLAYBACK_STATUSES)[number];

export const REPEAT_MODES = ["NONE", "PLAYLIST", "ITEM"] as const;
export type RepeatMode = (typeof REPEAT_MODES)[number];

export type PlaybackError = {
  code: string;
  message: string;
  contentId?: string;
  recoverable: boolean;
  occurredAt: number;
};

/**
 * Canonical runtime playback snapshot.
 *
 * Presence (ONLINE/OFFLINE) and Sync (CURRENT/STALE) are orthogonal —
 * see RuntimeStateContract / heartbeat. Do not merge those domains here.
 *
 * durationMs:
 * - null  → duration not yet known (e.g. natural VIDEO before metadata)
 * - > 0   → known presentation / media duration
 *
 * Playlist item `durationMs === 0` (natural VIDEO/AUDIO) is an *item*
 * convention preserved from DisplayEngine / tv.js — the controller maps
 * that to state.durationMs = null until media metadata arrives.
 */
export type PlaybackState = {
  status: PlaybackStatus;
  playlistId: string | null;
  manifestVersion: number | null;
  currentItemIndex: number;
  currentContentId: string | null;
  currentContentType: ContentType | null;
  /** Playlist item id (distinct from contentId — content may repeat). */
  currentPlaylistItemId: string | null;
  positionMs: number;
  durationMs: number | null;
  /** Linear gain 0–1 (not percent). */
  volume: number;
  muted: boolean;
  repeatMode: RepeatMode;
  /** Declared for future use — controller MUST NOT shuffle in RP-01. */
  shuffle: boolean;
  error: PlaybackError | null;
  updatedAt: number;
  /** Monotonic identity for stale media-event rejection. */
  generation: number;
};

export type PlaybackPlaylistItem = {
  playlistItemId: string;
  contentId: string;
  type: string;
  /** Item timing: 0 = natural duration for VIDEO/AUDIO (legacy-compatible). */
  durationMs: number;
  title?: string;
};

export type PlaybackAction =
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "STOP" }
  | { type: "NEXT" }
  | { type: "PREVIOUS" }
  | { type: "RESTART" }
  | { type: "SEEK"; positionMs: number }
  | { type: "SET_VOLUME"; volume: number }
  | { type: "SET_MUTED"; muted: boolean }
  | { type: "SET_REPEAT_MODE"; mode: RepeatMode }
  | { type: "LOAD_PLAYLIST"; playlistId: string; manifestVersion: number | null; items: PlaybackPlaylistItem[]; startIndex?: number }
  /** Soft manifest sync — preserve current item when still present (RP-02). */
  | {
      type: "SYNC_PLAYLIST";
      playlistId: string;
      manifestVersion: number | null;
      items: PlaybackPlaylistItem[];
      preferContentId?: string | null;
    }
  | { type: "MEDIA_LOADING" }
  | { type: "MEDIA_READY"; durationMs?: number | null; generation: number }
  | { type: "MEDIA_TIME_UPDATE"; positionMs: number; generation: number }
  | { type: "MEDIA_ENDED"; generation: number }
  | { type: "MEDIA_ERROR"; code: string; message: string; recoverable?: boolean; generation: number };

/** Suggested PREVIOUS restart threshold (ms). */
export const PREVIOUS_RESTART_THRESHOLD_MS = 3000;

export function isPlaybackStatus(value: unknown): value is PlaybackStatus {
  return (
    typeof value === "string" &&
    (PLAYBACK_STATUSES as readonly string[]).includes(value)
  );
}

export function isRepeatMode(value: unknown): value is RepeatMode {
  return (
    typeof value === "string" &&
    (REPEAT_MODES as readonly string[]).includes(value)
  );
}

export function isContentType(value: unknown): value is ContentType {
  return (
    typeof value === "string" &&
    (CONTENT_TYPES as readonly string[]).includes(value)
  );
}

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function clampPositionMs(
  positionMs: number,
  durationMs: number | null,
): number {
  if (!Number.isFinite(positionMs) || positionMs < 0) return 0;
  if (durationMs == null || durationMs < 0) return positionMs;
  return Math.min(positionMs, durationMs);
}

/**
 * Valid status transitions (deterministic).
 * LOADING may also return to IDLE via STOP.
 */
export const PLAYBACK_TRANSITIONS: Record<
  PlaybackStatus,
  readonly PlaybackStatus[]
> = {
  IDLE: ["LOADING", "ERROR"],
  LOADING: ["PLAYING", "PAUSED", "STOPPED", "ERROR", "IDLE"],
  PLAYING: ["PAUSED", "STOPPED", "ENDED", "ERROR", "LOADING", "IDLE"],
  PAUSED: ["PLAYING", "STOPPED", "LOADING", "ERROR", "IDLE"],
  STOPPED: ["PLAYING", "LOADING", "IDLE"],
  ENDED: ["PLAYING", "LOADING", "STOPPED", "IDLE"],
  ERROR: ["LOADING", "IDLE", "STOPPED"],
};

export function canTransition(
  from: PlaybackStatus,
  to: PlaybackStatus,
): boolean {
  if (from === to) return true;
  return PLAYBACK_TRANSITIONS[from].includes(to);
}

export function createInitialPlaybackState(
  now = Date.now(),
): PlaybackState {
  return {
    status: "IDLE",
    playlistId: null,
    manifestVersion: null,
    currentItemIndex: 0,
    currentContentId: null,
    currentContentType: null,
    currentPlaylistItemId: null,
    positionMs: 0,
    durationMs: null,
    volume: 1,
    muted: false,
    repeatMode: "PLAYLIST",
    shuffle: false,
    error: null,
    updatedAt: now,
    generation: 0,
  };
}

export function snapshotPlaybackState(state: PlaybackState): PlaybackState {
  return {
    ...state,
    error: state.error ? { ...state.error } : null,
  };
}

/** Resolve presentation duration for an item; null = natural / unknown. */
export function resolveItemDurationMs(item: PlaybackPlaylistItem): number | null {
  if (item.durationMs > 0) return item.durationMs;
  const t = item.type.toUpperCase();
  if (t === "VIDEO" || t === "AUDIO") return null;
  // IMAGE / GIF / TEXT / CLOCK / EXPERIENCE: fall back like DisplayEngine (8000).
  return 8000;
}

export function parseContentType(type: string): ContentType | null {
  const upper = type.toUpperCase();
  return isContentType(upper) ? upper : null;
}

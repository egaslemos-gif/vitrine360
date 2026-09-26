/**
 * RUNTIME-PLAYBACK-06 — PlayerSession projection (not authority).
 *
 * Client-only after hydration. Never use Date.now() during SSR render.
 */

import type { PlaybackObservation } from "@/domain/playback-observation";
import type { PlaybackStatus } from "@/domain/playback-state";

export const PLAYER_SESSION_LIFECYCLES = [
  "CREATED",
  "BOOTING",
  "READY",
  "PLAYING",
  "PAUSED",
  "STOPPED",
  "ERROR",
  "DISCONNECTED",
  "STOPPING",
  "ENDED",
] as const;
export type PlayerSessionLifecycle = (typeof PLAYER_SESSION_LIFECYCLES)[number];

export type PlayerSession = {
  sessionId: string;
  deviceId: string | null;
  tenantId: string | null;
  startedAt: number;
  lastActivityAt: number;
  lifecycle: PlayerSessionLifecycle;
  currentManifestVersion: number | null;
  currentPlaylistId: string | null;
  currentPlaylistItemId: string | null;
  currentContentId: string | null;
  playbackStatus: PlaybackStatus;
  /** Snapshot — prefer live PlaybackObservation for UI scrubbers. */
  positionMs: number;
  durationMs: number | null;
  volume: number;
  muted: boolean;
  repeatMode: string;
  syncState: string | null;
  networkState: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  updatedAt: number;
};

export function createSessionId(now: number): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `ps_${crypto.randomUUID()}`;
  }
  return `ps_${now.toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function deriveSessionLifecycle(
  playbackStatus: PlaybackStatus,
  opts?: { booting?: boolean; disconnected?: boolean },
): PlayerSessionLifecycle {
  if (opts?.disconnected) return "DISCONNECTED";
  if (opts?.booting) return "BOOTING";
  switch (playbackStatus) {
    case "IDLE":
      return "READY";
    case "LOADING":
      return "READY";
    case "PLAYING":
      return "PLAYING";
    case "PAUSED":
      return "PAUSED";
    case "STOPPED":
      return "STOPPED";
    case "ENDED":
      return "ENDED";
    case "ERROR":
      return "ERROR";
    default:
      return "READY";
  }
}

export function createPlayerSession(params: {
  now: number;
  deviceId?: string | null;
  tenantId?: string | null;
  sessionId?: string;
}): PlayerSession {
  const startedAt = params.now;
  return {
    sessionId: params.sessionId ?? createSessionId(startedAt),
    deviceId: params.deviceId ?? null,
    tenantId: params.tenantId ?? null,
    startedAt,
    lastActivityAt: startedAt,
    lifecycle: "CREATED",
    currentManifestVersion: null,
    currentPlaylistId: null,
    currentPlaylistItemId: null,
    currentContentId: null,
    playbackStatus: "IDLE",
    positionMs: 0,
    durationMs: null,
    volume: 1,
    muted: false,
    repeatMode: "PLAYLIST",
    syncState: null,
    networkState: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    updatedAt: startedAt,
  };
}

export function projectSessionFromObservation(
  session: PlayerSession,
  obs: PlaybackObservation,
  extras?: {
    syncState?: string | null;
    networkState?: string | null;
    manifestVersion?: number | null;
    touchActivity?: boolean;
    now?: number;
  },
): PlayerSession {
  const now = extras?.now ?? obs.observedAt;
  const lifecycle = deriveSessionLifecycle(obs.status);
  return {
    ...session,
    lifecycle: session.lifecycle === "CREATED" && lifecycle === "READY"
      ? "READY"
      : lifecycle,
    currentManifestVersion:
      extras?.manifestVersion ?? session.currentManifestVersion,
    currentPlaylistId: obs.playlistId,
    currentPlaylistItemId: obs.playlistItemId,
    currentContentId: obs.contentId,
    playbackStatus: obs.status,
    positionMs: obs.positionMs,
    durationMs: obs.durationMs,
    volume: obs.volume,
    muted: obs.muted,
    repeatMode: obs.repeatMode,
    syncState: extras?.syncState ?? session.syncState,
    networkState: extras?.networkState ?? session.networkState,
    lastErrorCode: obs.error?.code ?? null,
    lastErrorMessage: obs.error?.message ?? null,
    lastActivityAt: extras?.touchActivity ? now : session.lastActivityAt,
    updatedAt: now,
  };
}

/** Compact diagnostics block — no secrets. */
export function formatPlayerDiagnostics(session: PlayerSession): string {
  const ageSec = Math.max(0, Math.round((session.updatedAt - session.startedAt) / 1000));
  return [
    `SESSION ${session.sessionId.slice(0, 12)}… age=${ageSec}s life=${session.lifecycle}`,
    `PLAYBACK ${session.playbackStatus} content=${session.currentContentId ?? "—"} pl=${session.currentPlaylistId ?? "—"}`,
    `pos=${session.positionMs} dur=${session.durationMs ?? "null"}`,
    `SYNC ${session.syncState ?? "—"} NET ${session.networkState ?? "—"}`,
    session.lastErrorCode ? `ERROR ${session.lastErrorCode}` : "ERROR none",
  ].join(" · ");
}

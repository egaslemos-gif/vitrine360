/**
 * RUNTIME-PLAYBACK-06 — Client PlayerSession store (projection).
 * Create only after client hydration — never during SSR render.
 */

import {
  createPlayerSession,
  projectSessionFromObservation,
  type PlayerSession,
} from "@/domain/player-session";
import {
  isPlaybackActivityTransition,
  playbackObservationFromState,
  type PlaybackObservation,
} from "@/domain/playback-observation";
import type { PlaybackState } from "@/domain/playback-state";
import { getRuntimeState } from "@/player/runtime/state";
import {
  createTelemetryQueue,
  telemetryTypeForStatusTransition,
  type TelemetryQueue,
} from "@/player/session/telemetry-queue";

export const PLAYER_SESSION_GLOBAL_KEY = "__v360_player_session";
export const PLAYBACK_OBSERVATION_GLOBAL_KEY = "__v360_playback_observation";

export type PlayerSessionStore = {
  getSession: () => PlayerSession | null;
  getObservation: () => PlaybackObservation | null;
  getQueue: () => TelemetryQueue;
  /** Client boot — creates session. Idempotent until reset. */
  start: (opts?: {
    deviceId?: string | null;
    tenantId?: string | null;
    now?: number;
  }) => PlayerSession;
  /** Apply PlaybackState snapshot (from controller subscription). */
  observePlayback: (state: PlaybackState, now?: number) => void;
  noteSync: (syncState: string, ok: boolean, now?: number) => void;
  noteRuntimeError: (code: string, message?: string, now?: number) => void;
  reset: () => void;
  publishGlobals: () => void;
};

export function createPlayerSessionStore(): PlayerSessionStore {
  let session: PlayerSession | null = null;
  let observation: PlaybackObservation | null = null;
  let prevPlayback: PlaybackState | null = null;
  const queue = createTelemetryQueue(64);
  let readyEmitted = false;

  const publishGlobals = () => {
    if (typeof window === "undefined") return;
    try {
      (window as unknown as Record<string, unknown>)[PLAYER_SESSION_GLOBAL_KEY] =
        session ? { ...session } : null;
      (window as unknown as Record<string, unknown>)[
        PLAYBACK_OBSERVATION_GLOBAL_KEY
      ] = observation ? { ...observation } : null;
    } catch {
      /* ignore */
    }
  };

  return {
    getSession: () => (session ? { ...session } : null),
    getObservation: () => (observation ? { ...observation } : null),
    getQueue: () => queue,
    start(opts) {
      const now = opts?.now ?? Date.now();
      if (session) return { ...session };
      session = createPlayerSession({
        now,
        deviceId: opts?.deviceId ?? null,
        tenantId: opts?.tenantId ?? null,
      });
      queue.enqueue({
        type: "PLAYER_SESSION_STARTED",
        sessionId: session.sessionId,
        occurredAt: now,
      });
      publishGlobals();
      return { ...session };
    },
    observePlayback(state, now = Date.now()) {
      if (!session) {
        this.start({ now });
      }
      if (!session) return;

      const obs = playbackObservationFromState(state, now);
      observation = obs;

      const activity = isPlaybackActivityTransition(prevPlayback, state);
      // Seek commit: same generation, large position jump (not timeupdate ~250ms).
      const seekActivity =
        prevPlayback != null &&
        prevPlayback.generation === state.generation &&
        Math.abs(prevPlayback.positionMs - state.positionMs) > 1500;

      const touch = activity || seekActivity;

      const rs = (() => {
        try {
          return getRuntimeState();
        } catch {
          return null;
        }
      })();

      session = projectSessionFromObservation(session, obs, {
        syncState: rs?.syncState ?? session.syncState,
        networkState: rs?.networkState ?? session.networkState,
        manifestVersion:
          state.manifestVersion ?? rs?.currentManifestVersion ?? null,
        touchActivity: touch,
        now,
      });

      if (!readyEmitted && state.status !== "IDLE") {
        readyEmitted = true;
        queue.enqueue({
          type: "PLAYER_SESSION_READY",
          sessionId: session.sessionId,
          occurredAt: now,
          generation: state.generation,
          status: state.status,
        });
      }

      if (prevPlayback) {
        if (
          prevPlayback.currentPlaylistItemId !== state.currentPlaylistItemId ||
          prevPlayback.currentContentId !== state.currentContentId
        ) {
          queue.enqueue({
            type: "PLAYBACK_ITEM_CHANGED",
            sessionId: session.sessionId,
            occurredAt: now,
            generation: state.generation,
            contentId: state.currentContentId,
            playlistId: state.playlistId,
            playlistItemId: state.currentPlaylistItemId,
            status: state.status,
          });
        }
        const t = telemetryTypeForStatusTransition(
          prevPlayback.status,
          state.status,
        );
        if (t) {
          queue.enqueue({
            type: t,
            sessionId: session.sessionId,
            occurredAt: now,
            generation: state.generation,
            contentId: state.currentContentId,
            playlistId: state.playlistId,
            playlistItemId: state.currentPlaylistItemId,
            status: state.status,
            errorCode: state.error?.code ?? null,
            message: state.error?.message ?? null,
          });
        }
      } else if (state.status === "PLAYING") {
        queue.enqueue({
          type: "PLAYBACK_STARTED",
          sessionId: session.sessionId,
          occurredAt: now,
          generation: state.generation,
          contentId: state.currentContentId,
          status: state.status,
        });
      }

      prevPlayback = { ...state, error: state.error ? { ...state.error } : null };
      publishGlobals();
    },
    noteSync(syncState, ok, now = Date.now()) {
      if (!session) return;
      session = {
        ...session,
        syncState,
        lastActivityAt: now,
        updatedAt: now,
      };
      queue.enqueue({
        type: ok ? "SYNC_COMPLETED" : "SYNC_ERROR",
        sessionId: session.sessionId,
        occurredAt: now,
        message: syncState,
      });
      publishGlobals();
    },
    noteRuntimeError(code, message, now = Date.now()) {
      if (!session) return;
      session = {
        ...session,
        lastErrorCode: code,
        lastErrorMessage: message ?? null,
        lastActivityAt: now,
        updatedAt: now,
        lifecycle: "ERROR",
      };
      queue.enqueue({
        type: "RUNTIME_ERROR",
        sessionId: session.sessionId,
        occurredAt: now,
        errorCode: code,
        message: message ?? null,
      });
      publishGlobals();
    },
    reset() {
      session = null;
      observation = null;
      prevPlayback = null;
      readyEmitted = false;
      queue.clear();
      publishGlobals();
    },
    publishGlobals,
  };
}

let singleton: PlayerSessionStore | null = null;

export function getPlayerSessionStore(): PlayerSessionStore {
  if (!singleton) singleton = createPlayerSessionStore();
  return singleton;
}

export function resetPlayerSessionStoreForTests(): PlayerSessionStore {
  singleton = createPlayerSessionStore();
  return singleton;
}

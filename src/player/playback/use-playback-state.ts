/**
 * Thin React subscription to PlaybackController.
 * React renders snapshots only — no playlist / transition logic here.
 *
 * RUNTIME-PLAYBACK-01: optional integration surface.
 * DisplayEngine remains the production renderer until RP-02 wiring.
 */

"use client";

import { useRef, useSyncExternalStore } from "react";
import type { PlaybackController } from "@/player/playback/playback-controller";
import type { PlaybackState } from "@/domain/playback-state";
import { createInitialPlaybackState } from "@/domain/playback-state";

const EMPTY = createInitialPlaybackState(0);

/** Pristine controller snapshot — must match getServerSnapshot for hydration. */
export function isPristinePlaybackSnapshot(state: PlaybackState): boolean {
  return (
    state.status === "IDLE" &&
    state.generation === 0 &&
    state.playlistId === null
  );
}

/**
 * Subscribe to controller snapshots with referential stability for
 * useSyncExternalStore (must not allocate a new object when unchanged).
 */
export function usePlaybackState(
  controller: PlaybackController | null,
): PlaybackState {
  const cacheRef = useRef<PlaybackState>(EMPTY);

  return useSyncExternalStore(
    (onStoreChange) => {
      if (!controller) return () => {};
      return controller.subscribe((snap) => {
        cacheRef.current = isPristinePlaybackSnapshot(snap) ? EMPTY : snap;
        onStoreChange();
      });
    },
    () => {
      if (!controller) return EMPTY;
      const live = controller.getState();
      // Pristine IDLE must be referentially equal to getServerSnapshot (EMPTY)
      // so React hydration does not remount / warn (RP-04 CONTROL-041).
      if (isPristinePlaybackSnapshot(live)) {
        return EMPTY;
      }
      const cached = cacheRef.current;
      if (
        cached.updatedAt === live.updatedAt &&
        cached.generation === live.generation
      ) {
        return cached;
      }
      cacheRef.current = live;
      return live;
    },
    () => EMPTY,
  );
}

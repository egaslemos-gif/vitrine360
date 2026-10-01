/**
 * Unattended-playback recovery (digital signage must never park on a bad item).
 *
 * - LOADING watchdog: an item that never becomes ready (stalled network, expired URL,
 *   codec the device cannot decode) is reported as MEDIA_TIMEOUT instead of waiting forever.
 * - ERROR recovery: retry the same item once, then move on to the next item.
 *
 * It only dispatches actions to the PlaybackController (single source of truth for the
 * playlist index and repeat policy); it never touches the media element.
 */

"use client";

import { useEffect, useRef } from "react";
import type { PlaybackState } from "@/domain/playback-state";
import type { PlaybackController } from "@/player/playback/playback-controller";
import { MEDIA_ERROR_CODES } from "@/player/playback/media-types";

export const PLAYBACK_RECOVERY = {
  /** Wait for an item to become ready before declaring a timeout. */
  LOADING_STALL_MS: 30_000,
  /** Delay before the single automatic retry of a failed item. */
  RETRY_AFTER_MS: 2_500,
  /** Delay before skipping an item that failed again. */
  SKIP_AFTER_MS: 4_500,
  MAX_RETRIES_PER_ITEM: 1,
} as const;

export function usePlaybackRecovery(
  controller: PlaybackController,
  state: PlaybackState,
): void {
  const retries = useRef<Map<string, number>>(new Map());
  const { status, generation, currentPlaylistItemId, error } = state;
  const itemKey = currentPlaylistItemId ?? "";
  const recoverable = error?.recoverable !== false;

  // Healthy again → forget previous failures of this item.
  useEffect(() => {
    if (status === "PLAYING" && itemKey) retries.current.delete(itemKey);
  }, [status, itemKey]);

  // LOADING watchdog.
  useEffect(() => {
    if (status !== "LOADING") return;
    const gen = generation;
    const id = window.setTimeout(() => {
      const cur = controller.getState();
      if (cur.status !== "LOADING" || cur.generation !== gen) return;
      controller.dispatch({
        type: "MEDIA_ERROR",
        code: MEDIA_ERROR_CODES.MEDIA_TIMEOUT,
        message: "Media did not become ready in time",
        recoverable: true,
        generation: gen,
      });
    }, PLAYBACK_RECOVERY.LOADING_STALL_MS);
    return () => window.clearTimeout(id);
  }, [status, generation, controller]);

  // ERROR → retry once, then skip.
  useEffect(() => {
    if (status !== "ERROR") return;
    const gen = generation;
    const attempts = retries.current.get(itemKey) ?? 0;
    const shouldRetry = recoverable && attempts < PLAYBACK_RECOVERY.MAX_RETRIES_PER_ITEM;
    const delay = shouldRetry
      ? PLAYBACK_RECOVERY.RETRY_AFTER_MS
      : PLAYBACK_RECOVERY.SKIP_AFTER_MS;

    const id = window.setTimeout(() => {
      const cur = controller.getState();
      if (cur.status !== "ERROR" || cur.generation !== gen) return;
      if (shouldRetry) {
        retries.current.set(itemKey, attempts + 1);
        controller.dispatch({ type: "PLAY" });
      } else {
        retries.current.delete(itemKey);
        controller.dispatch({ type: "NEXT" });
      }
    }, delay);
    return () => window.clearTimeout(id);
  }, [status, generation, itemKey, recoverable, controller]);
}

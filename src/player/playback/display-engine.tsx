/**
 * RUNTIME-PLAYBACK-02 — DisplayEngine orchestration layer.
 *
 * Owns PlaybackController lifecycle, loads/syncs playlist from manifest items,
 * subscribes to PlaybackState, and delegates presentation to PlaybackRendererAdapter.
 *
 * MUST NOT independently own playlist index / NEXT / PREVIOUS / ENDED policy.
 */

"use client";

import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  forwardRef,
  type CSSProperties,
} from "react";
import { PlaybackController } from "@/player/playback/playback-controller";
import { usePlaybackState } from "@/player/playback/use-playback-state";
import { PlaybackRendererAdapter } from "@/player/playback/playback-renderer-adapter";
import {
  playlistFingerprint,
  toPlaylistItems,
  type EnginePlaybackItem,
} from "@/player/playback/playlist-map";
import type { PlaybackAction, PlaybackState } from "@/domain/playback-state";

/** @deprecated Prefer EnginePlaybackItem — kept for Experience slide imports. */
export type PlaybackItem = EnginePlaybackItem;

export type DisplayEngineHandle = {
  dispatch: (action: PlaybackAction) => PlaybackState;
  getState: () => PlaybackState;
  getController: () => PlaybackController;
};

const stageStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  boxSizing: "border-box",
};

export const DisplayEngine = forwardRef<
  DisplayEngineHandle,
  {
    items: PlaybackItem[];
    playlistId?: string;
    manifestVersion?: number | null;
    onItemChange?: (item: PlaybackItem | null) => void;
    onPlaybackStateChange?: (state: PlaybackState) => void;
  }
>(function DisplayEngine(
  {
    items,
    playlistId = "device-playlist",
    manifestVersion = null,
    onItemChange,
    onPlaybackStateChange,
  },
  ref,
) {
  const controllerRef = useRef<PlaybackController | null>(null);
  if (controllerRef.current == null) {
    controllerRef.current = new PlaybackController();
  }
  const controller = controllerRef.current;

  useImperativeHandle(
    ref,
    () => ({
      dispatch: (action) => controller.dispatch(action),
      getState: () => controller.getState(),
      getController: () => controller,
    }),
    [controller],
  );

  const fingerprint = useMemo(() => playlistFingerprint(items), [items]);
  const preferContentIdRef = useRef<string | null>(null);
  const initialLoadRef = useRef(true);

  // Load / soft-sync playlist — controller is SoT for index.
  useEffect(() => {
    const playlistItems = toPlaylistItems(items);
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      controller.dispatch({
        type: "LOAD_PLAYLIST",
        playlistId,
        manifestVersion,
        items: playlistItems,
        startIndex: 0,
      });
      return;
    }
    controller.dispatch({
      type: "SYNC_PLAYLIST",
      playlistId,
      manifestVersion,
      items: playlistItems,
      preferContentId: preferContentIdRef.current,
    });
  }, [fingerprint, playlistId, manifestVersion, controller, items]);

  const state = usePlaybackState(controller);
  const item =
    items.length > 0 && state.currentItemIndex >= 0
      ? (items[state.currentItemIndex] ?? null)
      : null;

  useEffect(() => {
    if (item?.contentId) preferContentIdRef.current = item.contentId;
  }, [item?.contentId]);

  useEffect(() => {
    onItemChange?.(item);
  }, [item, onItemChange]);

  useEffect(() => {
    onPlaybackStateChange?.(state);
  }, [state, onPlaybackStateChange]);

  // Timers cleanup lives in PresentationTimer / adapter.
  // Do NOT STOP on unmount — React Strict Mode remount + SYNC soft-remap
  // would otherwise leave the controller permanently STOPPED.

  if (!items.length) {
    return (
      <div
        style={{
          ...stageStyle,
          background: "#070b14",
          color: "#fff",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div>
          <p
            style={{
              letterSpacing: "0.35em",
              color: "rgba(255,255,255,0.4)",
              fontSize: 14,
            }}
          >
            VITRINE360
          </p>
          <p style={{ marginTop: 24, fontSize: 32, fontWeight: 600 }}>
            NO CONTENT AVAILABLE
          </p>
          <p style={{ marginTop: 12, color: "rgba(255,255,255,0.5)" }}>
            A sincronizar a playlist…
          </p>
        </div>
      </div>
    );
  }

  // Guard: items shrank before SYNC remapped index — never read item.* as null.
  if (!item || state.status === "IDLE") {
    return (
      <div
        style={{
          ...stageStyle,
          background: "#070b14",
          color: "rgba(255,255,255,0.55)",
          textAlign: "center",
        }}
      >
        A carregar playback…
      </div>
    );
  }

  const keepFrame =
    item.type === "VIDEO" ||
    item.type === "AUDIO" ||
    item.transition === "cut";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "#000",
        color: "#fff",
      }}
      data-playback-status={state.status}
      data-playback-generation={state.generation}
      data-playback-index={state.currentItemIndex}
      data-playback-content={state.currentContentId ?? ""}
    >
      <div
        className={`player-slide-${item.transition || "fade"}`}
        style={{
          position: "absolute",
          inset: 0,
          opacity: state.status === "LOADING" && !keepFrame ? 0.92 : 1,
          transition: keepFrame ? undefined : "opacity 300ms",
        }}
      >
        <PlaybackRendererAdapter
          controller={controller}
          state={state}
          item={item}
        />
      </div>
    </div>
  );
});

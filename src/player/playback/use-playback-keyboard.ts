/**
 * RUNTIME-PLAYBACK-04 — Keyboard shortcuts → PlaybackAction.
 * Scope: only when player root is focused / contains focus.
 * Skips input/textarea/select/contenteditable.
 */

"use client";

import { useEffect } from "react";
import type { PlaybackAction, PlaybackState } from "@/domain/playback-state";
import { isEditableTarget } from "@/player/playback/control-availability";
import { getFullscreenController } from "@/player/runtime/fullscreen";

export type PlaybackKeyboardOptions = {
  enabled?: boolean;
  /** Root element that must contain focus (or be fullscreen). */
  getRoot: () => HTMLElement | null;
  state: PlaybackState;
  dispatch: (action: PlaybackAction) => void;
  onShowControls?: () => void;
};

export function usePlaybackKeyboard(opts: PlaybackKeyboardOptions): void {
  const { enabled = true, getRoot, state, dispatch, onShowControls } = opts;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (ev: KeyboardEvent) => {
      if (isEditableTarget(ev.target)) return;

      const root = getRoot();
      if (!root) return;
      const active = document.activeElement;
      const inScope =
        root === active ||
        (active != null && root.contains(active)) ||
        document.fullscreenElement === root ||
        (document.fullscreenElement != null &&
          root.contains(document.fullscreenElement));
      if (!inScope) return;

      const key = ev.key;
      const show = () => onShowControls?.();

      if (key === " " || key === "Spacebar") {
        ev.preventDefault();
        show();
        if (state.status === "PLAYING") dispatch({ type: "PAUSE" });
        else dispatch({ type: "PLAY" });
        return;
      }
      if (key === "ArrowLeft") {
        ev.preventDefault();
        show();
        dispatch({ type: "PREVIOUS" });
        return;
      }
      if (key === "ArrowRight") {
        ev.preventDefault();
        show();
        dispatch({ type: "NEXT" });
        return;
      }
      if (key === "ArrowUp") {
        ev.preventDefault();
        show();
        dispatch({
          type: "SET_VOLUME",
          volume: Math.min(1, state.volume + 0.05),
        });
        return;
      }
      if (key === "ArrowDown") {
        ev.preventDefault();
        show();
        dispatch({
          type: "SET_VOLUME",
          volume: Math.max(0, state.volume - 0.05),
        });
        return;
      }
      if (key === "Home") {
        ev.preventDefault();
        show();
        dispatch({ type: "SEEK", positionMs: 0 });
        return;
      }
      if (key === "End" && state.durationMs != null) {
        ev.preventDefault();
        show();
        dispatch({ type: "SEEK", positionMs: state.durationMs });
        return;
      }
      if (key === "m" || key === "M") {
        ev.preventDefault();
        show();
        dispatch({ type: "SET_MUTED", muted: !state.muted });
        return;
      }
      if (key === "f" || key === "F") {
        ev.preventDefault();
        show();
        const fs = getFullscreenController();
        if (!fs) return;
        if (fs.snapshot().active) void fs.exit();
        else void fs.request({ userActivation: true, source: "user" });
        return;
      }
      if (key === "r" || key === "R") {
        ev.preventDefault();
        show();
        dispatch({ type: "RESTART" });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, getRoot, state, dispatch, onShowControls]);
}

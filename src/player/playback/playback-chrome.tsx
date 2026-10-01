/**
 * RUNTIME-PLAYBACK-04 — Player chrome: viewport + PlaybackControls + keyboard + auto-hide.
 *
 * Auto-hide reuses CursorIdleController (same class as RUNTIME-POLICY-02).
 * When Runtime State already mirrors cursorVisible (shell), prefers that SSoT.
 */

"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { PlaybackAction, PlaybackState } from "@/domain/playback-state";
import { PlaybackControls } from "@/player/playback/playback-controls";
import { usePlaybackKeyboard } from "@/player/playback/use-playback-keyboard";
import { CursorIdleController } from "@/player/runtime/cursor-idle";
import {
  FullscreenController,
  getFullscreenController,
  setFullscreenController,
} from "@/player/runtime/fullscreen";
import {
  getRuntimeStateStore,
  RUNTIME_STATE_UPDATED_EVENT,
} from "@/player/runtime/state";

import { DisplayIdentityHud } from "@/player/playback/display-identity-hud";

export type PlaybackChromeProps = {
  state: PlaybackState;
  dispatch: (action: PlaybackAction) => void;
  children: ReactNode;
  itemCount?: number;
  itemTitle?: string | null;
  /** Prefer shell Runtime State cursorVisible when available. */
  autoHide?: boolean;
  style?: CSSProperties;
};

export function PlaybackChrome({
  state,
  dispatch,
  children,
  itemCount,
  itemTitle,
  autoHide = true,
  style,
}: PlaybackChromeProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [idleVisible, setIdleVisible] = useState(true);
  const [compact, setCompact] = useState(false);
  const [fullscreenAvailable, setFullscreenAvailable] = useState(true);
  /** Defer interactive controls until after hydration (RP-04 CONTROL-041). */
  const [controlsReady, setControlsReady] = useState(false);
  const localCursorRef = useRef<CursorIdleController | null>(null);
  const localFsRef = useRef<FullscreenController | null>(null);
  const controlsVisible = !autoHide || idleVisible;

  const getRoot = useCallback(() => rootRef.current, []);

  const showControls = useCallback(() => {
    setIdleVisible(true);
  }, []);

  usePlaybackKeyboard({
    enabled: controlsReady,
    getRoot,
    state,
    dispatch,
    onShowControls: showControls,
  });

  // Mount controls only on client after hydrate — avoids SSR/client label mismatch
  // when DisplayEngine loads playlist in the same commit tree.
  useEffect(() => {
    const id = window.setTimeout(() => setControlsReady(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  // Responsive compact mode
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => setCompact(mq.matches);
    const syncId = window.setTimeout(apply, 0);
    mq.addEventListener("change", apply);
    return () => {
      window.clearTimeout(syncId);
      mq.removeEventListener("change", apply);
    };
  }, []);

  // Ensure FullscreenController exists (shell installs it; lab installs a local one).
  useEffect(() => {
    if (getFullscreenController()) {
      const syncId = window.setTimeout(() => setFullscreenAvailable(true), 0);
      return () => window.clearTimeout(syncId);
    }
    const fs = new FullscreenController({
      getTarget: () => rootRef.current,
      capabilityFullscreen: true,
    });
    localFsRef.current = fs;
    setFullscreenController(fs);
    fs.start();
    const syncId = window.setTimeout(() => setFullscreenAvailable(true), 0);
    return () => {
      window.clearTimeout(syncId);
      fs.dispose();
      if (getFullscreenController() === fs) setFullscreenController(null);
      localFsRef.current = null;
    };
  }, []);

  // Default full screen. Browsers only allow it from a user gesture, so it is armed for the
  // first one (kiosk / TV shells that already run full screen are unaffected). One attempt
  // only: never fight a user who leaves full screen on purpose. The presentation policy
  // still decides — a WINDOWED policy makes the request a no-op.
  useEffect(() => {
    const types = ["pointerup", "click", "touchend", "keydown"];
    let done = false;
    function detach() {
      for (const type of types) window.removeEventListener(type, onGesture, true);
    }
    function onGesture(ev: Event) {
      if (done) return;
      if (ev instanceof KeyboardEvent && ["Shift", "Control", "Alt", "Meta"].includes(ev.key)) {
        return;
      }
      done = true;
      detach();
      const fs = getFullscreenController();
      if (!fs || fs.isActive()) return;
      void fs.request({ userActivation: true, source: "user" });
    }
    for (const type of types) window.addEventListener(type, onGesture, true);
    return detach;
  }, []);

  // Auto-hide: prefer Runtime State from shell CursorIdleController; else local instance.
  useEffect(() => {
    if (!autoHide) return;

    const store = getRuntimeStateStore();
    try {
      const snap = store.get();
      if (typeof snap.cursorVisible === "boolean") {
        const syncId = window.setTimeout(() => {
          setIdleVisible(snap.cursorVisible);
        }, 0);
        const onEvt = (ev: Event) => {
          const detail = (ev as CustomEvent).detail as
            | { cursorVisible?: boolean }
            | undefined;
          if (typeof detail?.cursorVisible === "boolean") {
            setIdleVisible(detail.cursorVisible);
          } else {
            setIdleVisible(store.get().cursorVisible);
          }
        };
        window.addEventListener(RUNTIME_STATE_UPDATED_EVENT, onEvt);
        return () => {
          window.clearTimeout(syncId);
          window.removeEventListener(RUNTIME_STATE_UPDATED_EVENT, onEvt);
        };
      }
    } catch {
      // fall through to local CursorIdleController
    }

    const cursor = new CursorIdleController("AUTO_HIDE", undefined, {
      onVisibilityChange: (visible) => setIdleVisible(visible),
    });
    localCursorRef.current = cursor;
    cursor.start();
    return () => {
      cursor.dispose();
      localCursorRef.current = null;
    };
  }, [autoHide]);

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      data-playback-chrome
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        outline: "none",
        ...style,
      }}
      onPointerDown={() => {
        showControls();
        localCursorRef.current?.handleInput("pointerdown");
      }}
    >
      <div style={{ position: "absolute", inset: 0 }}>{children}</div>
        {controlsReady && (
          <DisplayIdentityHud visible={controlsVisible} itemTitle={itemTitle} />
        )}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 16,
            display: "flex",
            justifyContent: "center",
            opacity: controlsVisible ? 1 : 0,
            transform: controlsVisible ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 220ms ease, transform 220ms ease",
            pointerEvents: controlsVisible ? "auto" : "none",
            zIndex: 20,
          }}
        >
          {controlsReady ? (
            <PlaybackControls
              state={state}
              dispatch={dispatch}
              itemCount={itemCount}
              itemTitle={itemTitle}
              visible
              compact={compact}
              fullscreenAvailable={fullscreenAvailable}
            />
          ) : (
            <div
              data-playback-controls="pending"
              aria-hidden
              style={{
                background: "rgba(20, 18, 44, 0.34)",
                border: "1px solid rgba(255,255,255,0.22)",
                borderRadius: 26,
                width: "min(920px, calc(100% - 24px))",
                minHeight: 96,
              }}
            />
          )}
        </div>
    </div>
  );
}

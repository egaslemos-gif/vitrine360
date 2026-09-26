/**
 * Dev-only Playback lab — DisplayEngine + Chrome + RP-07 Command Lab.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DisplayEngine,
  type DisplayEngineHandle,
  type PlaybackItem,
} from "@/player/playback/display-engine";
import { PlaybackChrome } from "@/player/playback/playback-chrome";
import {
  createInitialPlaybackState,
  type PlaybackAction,
  type PlaybackState,
} from "@/domain/playback-state";
import { playbackObservationFromState } from "@/domain/playback-observation";
import { getPlayerSessionStore } from "@/player/session/player-session-store";
import { createCommandDispatcher } from "@/player/command/command-dispatcher";
import { createIdempotencyStore } from "@/player/command/idempotency-store";
import { createLocalCommandTransport } from "@/player/command/local-command-transport";
import { CommandLabPanel } from "@/player/command/command-lab-panel";
import type { DeviceCommand, CommandResult } from "@/domain/device-command";
import type { PlaybackController } from "@/player/playback/playback-controller";

function svgData(label: string, fill: string): string {
  return (
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450">
        <rect fill="${fill}" width="100%" height="100%"/>
        <text x="50%" y="50%" fill="white" font-size="48" text-anchor="middle" dy=".3em">${label}</text>
      </svg>`,
    )
  );
}

const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

const LAB_TENANT = "lab-tenant";
const LAB_DEVICE = "lab-device";

const LAB_ITEMS: PlaybackItem[] = [
  {
    playlistItemId: "lab_img_1",
    contentId: "lab_c_img",
    type: "IMAGE",
    title: "Lab Image",
    durationMs: 5000,
    transition: "fade",
    payload: { url: svgData("IMAGE", "#1e3a5f") },
    assets: [],
  },
  {
    playlistItemId: "lab_gif_1",
    contentId: "lab_c_gif",
    type: "GIF",
    title: "Lab GIF",
    durationMs: 4000,
    transition: "fade",
    payload: { url: svgData("GIF", "#7c3aed") },
    assets: [],
  },
  {
    playlistItemId: "lab_audio_1",
    contentId: "lab_c_audio",
    type: "AUDIO",
    title: "Lab Audio",
    durationMs: 0,
    transition: "fade",
    payload: { url: SILENT_WAV, artist: "Vitrine Lab", album: "RP-07" },
    assets: [],
  },
  {
    playlistItemId: "lab_vid_1",
    contentId: "lab_c_vid",
    type: "VIDEO",
    title: "Lab Video",
    durationMs: 0,
    transition: "fade",
    payload: { url: SILENT_WAV },
    assets: [],
  },
  {
    playlistItemId: "lab_text",
    contentId: "lab_c_text",
    type: "TEXT",
    title: "Lab Text",
    durationMs: 4000,
    transition: "fade",
    payload: { body: "Command → Dispatcher → Controller" },
    assets: [],
  },
];

type LabTransport = {
  send: (command: DeviceCommand) => CommandResult;
};

function rejectNoEngine(command: DeviceCommand): CommandResult {
  return {
    commandId: command.commandId,
    status: "REJECTED",
    deviceId: command.deviceId,
    sessionId: command.sessionId ?? null,
    action: null,
    reason: "UNKNOWN_DEVICE",
    correlationId: command.correlationId,
  };
}

export default function PlaybackLabClient() {
  const engineRef = useRef<DisplayEngineHandle>(null);
  const idempotencyRef = useRef(createIdempotencyStore());
  const sendImplRef = useRef<LabTransport["send"] | null>(null);
  const [snap, setSnap] = useState<PlaybackState>(() =>
    createInitialPlaybackState(0),
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const items = LAB_ITEMS;

  const transport = useMemo<LabTransport>(
    () => ({
      send(command: DeviceCommand): CommandResult {
        const impl = sendImplRef.current;
        if (!impl) return rejectNoEngine(command);
        return impl(command);
      },
    }),
    [],
  );

  useEffect(() => {
    sendImplRef.current = (command: DeviceCommand): CommandResult => {
      const handle = engineRef.current;
      if (!handle) return rejectNoEngine(command);

      const controller = {
        dispatch: (action: PlaybackAction) => handle.dispatch(action),
        getState: () => handle.getState(),
      } as PlaybackController;

      const dispatcher = createCommandDispatcher({
        controller,
        idempotency: idempotencyRef.current,
        getSession: () => {
          const s = getPlayerSessionStore().getSession();
          if (!s) return null;
          return {
            sessionId: s.sessionId,
            deviceId: LAB_DEVICE,
            tenantId: LAB_TENANT,
          };
        },
        auth: {
          authorized: true,
          tenantId: LAB_TENANT,
          deviceTenantId: LAB_TENANT,
          deviceId: LAB_DEVICE,
          role: "OPERATOR",
        },
      });
      const local = createLocalCommandTransport(dispatcher);
      const result = local.send(command);
      const next = handle.getState();
      setSnap(next);
      try {
        getPlayerSessionStore().observePlayback(next);
      } catch {
        /* observational */
      }
      return result;
    };

    return () => {
      sendImplRef.current = null;
    };
  }, []);

  useEffect(() => {
    const s = getPlayerSessionStore().start({
      now: Date.now(),
      deviceId: LAB_DEVICE,
      tenantId: LAB_TENANT,
    });
    const t = window.setTimeout(() => {
      setSessionId(s.sessionId);
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  function dispatch(action: PlaybackAction) {
    const handle = engineRef.current;
    if (!handle) return;
    handle.dispatch(action);
    const next = handle.getState();
    setSnap(next);
    try {
      getPlayerSessionStore().observePlayback(next);
    } catch {
      /* observational */
    }
  }

  const current = items[snap.currentItemIndex];

  return (
    <div
      style={{
        height: "100vh",
        width: "100%",
        background: "#070b14",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <header
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          padding: "10px 16px",
          fontSize: 13,
          opacity: 0.75,
          pointerEvents: "none",
        }}
      >
        <strong>RUNTIME-PLAYBACK-07 Lab</strong>
        <span style={{ marginLeft: 10 }}>
          Command Lab · session={sessionId?.slice(0, 12) ?? "…"}
        </span>
      </header>
      <CommandLabPanel
        transport={transport}
        tenantId={LAB_TENANT}
        deviceId={LAB_DEVICE}
        sessionId={sessionId}
        observation={playbackObservationFromState(snap, Date.now())}
      />
      <PlaybackChrome
        state={snap}
        dispatch={dispatch}
        itemCount={items.length}
        itemTitle={current?.title ?? null}
        autoHide
        style={{ height: "100%" }}
      >
        <DisplayEngine
          ref={engineRef}
          items={items}
          playlistId="lab-playlist"
          manifestVersion={1}
          onPlaybackStateChange={(pb) => {
            setSnap(pb);
            try {
              getPlayerSessionStore().observePlayback(pb);
              setSessionId(
                getPlayerSessionStore().getSession()?.sessionId ?? null,
              );
            } catch {
              /* observational */
            }
          }}
        />
      </PlaybackChrome>
    </div>
  );
}

/**
 * RUNTIME-PLAYBACK-07 — DEV-ONLY Command Lab panel.
 * Must not ship in Admin Console or production UI surfaces.
 */

"use client";

import { useCallback, useState } from "react";
import {
  createDeviceCommand,
  type CommandResult,
  type DeviceCommandType,
} from "@/domain/device-command";
import type { LocalCommandTransport } from "@/player/command/local-command-transport";
import { CommandResultSummary } from "@/components/ui/remote-control-primitives";
import {
  createCommandObservationCorrelation,
  type CommandObservationCorrelation,
} from "@/domain/command-observation";
import { compactPlaybackObservation, type PlaybackObservation } from "@/domain/playback-observation";

export type CommandLabPanelProps = {
  transport: LocalCommandTransport;
  tenantId: string;
  deviceId: string;
  sessionId: string | null;
  observation?: PlaybackObservation;
};

const BUTTONS: { type: DeviceCommandType; label: string }[] = [
  { type: "PLAY", label: "PLAY" },
  { type: "PAUSE", label: "PAUSE" },
  { type: "STOP", label: "STOP" },
  { type: "NEXT", label: "NEXT" },
  { type: "PREVIOUS", label: "PREV" },
  { type: "RESTART", label: "RESTART" },
];

export function CommandLabPanel({
  transport,
  tenantId,
  deviceId,
  sessionId,
  observation,
}: CommandLabPanelProps) {
  const [correlation, setCorrelation] = useState<CommandObservationCorrelation | null>(null);
  const [seekMs, setSeekMs] = useState(1000);
  const [volume, setVolume] = useState(0.5);

  const send = useCallback(
    (type: DeviceCommandType, payload?: Record<string, unknown>) => {
      const now = Date.now();
      if (!sessionId) {
        setCorrelation(
          createCommandObservationCorrelation({
            commandId: `cmd_${now}_stale`,
            deviceId,
            sessionId: undefined,
            type,
            status: "STALE_SESSION",
            timeline: {
              createdAt: now,
              queuedAt: now,
            },
          }),
        );
        return;
      }
      const created = createDeviceCommand({
        tenantId,
        deviceId,
        sessionId,
        type,
        binding: "SESSION_BOUND",
        payload: payload as never,
      });
      if (!created.ok) {
        setCorrelation(
          createCommandObservationCorrelation({
            commandId: `cmd_${now}_rej`,
            deviceId,
            sessionId,
            type,
            status: "REJECTED",
            timeline: {
              createdAt: now,
              queuedAt: now,
            },
          }),
        );
        return;
      }
      const result = transport.send(created.command);
      const applied = Date.now();
      setCorrelation(
        createCommandObservationCorrelation({
          commandId: created.command.commandId,
          deviceId,
          sessionId,
          type: created.command.type,
          status: result.status,
          timeline: {
            createdAt: created.command.issuedAt,
            queuedAt: created.command.issuedAt,
            deliveredAt: applied, // simulated
            dispatchedAt: applied, // simulated
            appliedAt: applied,
          },
        }),
      );
    },
    [transport, tenantId, deviceId, sessionId],
  );

  return (
    <div
      data-command-lab="dev"
      style={{
        position: "absolute",
        top: 48,
        right: 12,
        zIndex: 40,
        width: 280,
        maxWidth: "calc(100vw - 24px)",
        background: "rgba(12,16,28,0.92)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 12,
        padding: 12,
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
        fontSize: 12,
        pointerEvents: "auto",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8, letterSpacing: "0.04em" }}>
        COMMAND LAB · DEV
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {BUTTONS.map((b) => (
          <button
            key={b.type}
            type="button"
            onClick={() => send(b.type)}
            style={btnStyle}
          >
            {b.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => send("SEEK", { positionMs: seekMs })}
          style={btnStyle}
        >
          SEEK
        </button>
        <button
          type="button"
          onClick={() => send("SET_VOLUME", { volume })}
          style={btnStyle}
        >
          VOL
        </button>
        <button
          type="button"
          onClick={() => send("SET_MUTED", { muted: true })}
          style={btnStyle}
        >
          MUTE
        </button>
        <button
          type="button"
          onClick={() => send("SET_MUTED", { muted: false })}
          style={btnStyle}
        >
          UNMUTE
        </button>
        <button
          type="button"
          onClick={() => send("SET_REPEAT_MODE", { repeatMode: "ITEM" })}
          style={btnStyle}
        >
          REPEAT ITEM
        </button>
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
        <label>
          seekMs
          <input
            type="number"
            min={0}
            value={seekMs}
            onChange={(e) => setSeekMs(Number(e.target.value))}
            style={inputStyle}
          />
        </label>
        <label>
          vol
          <input
            type="number"
            min={0}
            max={1}
            step={0.1}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            style={inputStyle}
          />
        </label>
      </div>
      {correlation ? (
        <div style={{ marginTop: 10, color: "black", fontFamily: "sans-serif", zoom: 0.8 }}>
          <CommandResultSummary
            correlation={
              observation
                ? {
                    ...correlation,
                    observation: compactPlaybackObservation(observation),
                    timeline: {
                      ...correlation.timeline,
                      observedAt: Date.now(),
                    },
                  }
                : correlation
            }
          />
        </div>
      ) : (
        <p style={{ marginTop: 10, opacity: 0.55 }}>No command yet</p>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  minHeight: 36,
  minWidth: 52,
  padding: "4px 8px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  display: "block",
  width: 72,
  marginTop: 2,
  background: "rgba(0,0,0,0.4)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 6,
  color: "#fff",
  padding: 4,
};

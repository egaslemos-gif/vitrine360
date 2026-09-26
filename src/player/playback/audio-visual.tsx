/**
 * RUNTIME-PLAYBACK-05 — Professional AUDIO presentation surface.
 * Static visual only — no Web Audio API / live waveform.
 */

"use client";

import type { CSSProperties } from "react";
import { formatPlaybackTime } from "@/player/playback/format-time";

export type AudioVisualProps = {
  title: string;
  artist?: string | null;
  album?: string | null;
  positionMs: number;
  durationMs: number | null;
  status: string;
};

const shell: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 20,
  padding: "max(24px, 4vh) max(20px, 4vw)",
  boxSizing: "border-box",
  background:
    "radial-gradient(ellipse at 50% 20%, #1a2740 0%, #0b1220 55%, #070b14 100%)",
  color: "#fff",
  textAlign: "center",
};

/** Decorative static bars — not driven by analyser. */
function StaticWaveform({ active }: { active: boolean }) {
  const heights = [28, 52, 36, 64, 44, 70, 40, 58, 32, 48, 60, 38, 54, 42, 66];
  return (
    <div
      aria-hidden
      data-audio-waveform="static"
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: 5,
        height: 72,
        opacity: active ? 0.95 : 0.45,
        transition: "opacity 200ms ease",
      }}
    >
      {heights.map((h, i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: h,
            borderRadius: 3,
            background:
              i % 3 === 0
                ? "rgba(125, 211, 252, 0.85)"
                : "rgba(148, 163, 184, 0.55)",
            transform: active ? `scaleY(${0.85 + (i % 4) * 0.05})` : "scaleY(0.55)",
            transformOrigin: "bottom",
            transition: "transform 280ms ease",
          }}
        />
      ))}
    </div>
  );
}

export function AudioVisual({
  title,
  artist,
  album,
  positionMs,
  durationMs,
  status,
}: AudioVisualProps) {
  const progress =
    durationMs != null && durationMs > 0
      ? Math.min(1, Math.max(0, positionMs / durationMs))
      : 0;
  const meta = [artist, album].filter(Boolean).join(" · ");

  return (
    <div style={shell} data-audio-visual role="group" aria-label={title}>
      <div
        aria-hidden
        style={{
          width: 120,
          height: 120,
          borderRadius: 18,
          background:
            "linear-gradient(145deg, rgba(56,189,248,0.35), rgba(30,58,95,0.9))",
          border: "1px solid rgba(255,255,255,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 42,
          fontWeight: 700,
          letterSpacing: "0.04em",
        }}
      >
        ♪
      </div>

      <p
        style={{
          margin: 0,
          letterSpacing: "0.22em",
          fontSize: 12,
          opacity: 0.45,
          fontWeight: 600,
        }}
      >
        VITRINE360 · AUDIO
      </p>

      <h1
        style={{
          margin: 0,
          maxWidth: "min(920px, 92vw)",
          fontSize: "clamp(1.35rem, 4vw, 2.35rem)",
          fontWeight: 700,
          lineHeight: 1.2,
        }}
      >
        {title}
      </h1>

      {meta ? (
        <p style={{ margin: 0, opacity: 0.65, fontSize: 15 }}>{meta}</p>
      ) : null}

      <StaticWaveform active={status === "PLAYING"} />

      <div style={{ width: "min(420px, 88vw)" }} aria-hidden>
        <div
          style={{
            height: 4,
            borderRadius: 999,
            background: "rgba(255,255,255,0.12)",
            overflow: "hidden",
          }}
        >
          <div
            data-audio-progress
            style={{
              height: "100%",
              width: `${progress * 100}%`,
              background: "rgba(125, 211, 252, 0.9)",
              transition: "width 200ms linear",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 8,
            fontSize: 12,
            opacity: 0.55,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span>{formatPlaybackTime(positionMs)}</span>
          <span>
            {durationMs != null ? formatPlaybackTime(durationMs) : "—:—"}
          </span>
        </div>
      </div>
    </div>
  );
}

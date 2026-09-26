/**
 * RUNTIME-PLAYBACK-05 — Viewport media error overlay.
 * Never shows stack traces, URLs, tokens, or tenant ids.
 */

"use client";

import type { CSSProperties } from "react";
import { userFacingMediaErrorMessage } from "@/player/playback/media-types";

export type MediaErrorOverlayProps = {
  code: string;
  recoverable: boolean;
  onRetry?: () => void;
};

const shell: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(7, 11, 20, 0.92)",
  color: "#fff",
  zIndex: 12,
  padding: 24,
  boxSizing: "border-box",
};

export function MediaErrorOverlay({
  code,
  recoverable,
  onRetry,
}: MediaErrorOverlayProps) {
  return (
    <div
      role="alert"
      data-media-error-overlay
      style={shell}
      aria-live="assertive"
    >
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        <p
          style={{
            margin: 0,
            letterSpacing: "0.2em",
            fontSize: 12,
            opacity: 0.45,
            fontWeight: 600,
          }}
        >
          VITRINE360
        </p>
        <h2
          style={{
            margin: "20px 0 0",
            fontSize: "clamp(1.25rem, 3.5vw, 1.75rem)",
            fontWeight: 700,
          }}
        >
          {userFacingMediaErrorMessage(code)}
        </h2>
        {recoverable && onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            style={{
              marginTop: 28,
              minHeight: 44,
              minWidth: 120,
              padding: "10px 22px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "#fff",
              color: "#0b1220",
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}

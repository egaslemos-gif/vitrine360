"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { getConfig, getCurrentManifest, type LocalConfig, type LocalManifest } from "@/player/cache/indexed-db";
import { readLocalConfigSync } from "@/player/runtime/device-config";

export type DisplayIdentityHudProps = {
  visible: boolean;
  itemTitle?: string | null;
};

/* Inline styles on purpose: Smart TV browsers often ignore utility CSS. */
const INK = "#2b2550";
const INK_SOFT = "rgba(43, 37, 80, 0.62)";
const INK_FAINT = "rgba(43, 37, 80, 0.5)";
const BRAND = "#7057dc";

const label: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: INK_FAINT,
};

const ellipsis: CSSProperties = {
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

export function DisplayIdentityHud({
  visible,
  itemTitle,
}: DisplayIdentityHudProps) {
  const [config, setConfig] = useState<LocalConfig | null>(readLocalConfigSync);
  const [manifest, setManifest] = useState<LocalManifest | null>(null);

  useEffect(() => {
    getConfig().then(setConfig).catch(console.error);
    getCurrentManifest().then(setManifest).catch(console.error);
  }, []);

  if (!visible) return null;

  const playlistName = (manifest?.playlist as { name?: string } | undefined)?.name;
  const place = [config?.location, config?.groupName].filter(Boolean).join(" · ");

  return (
    <div
      data-display-identity-hud
      style={{
        position: "absolute",
        top: 20,
        left: 20,
        width: "min(320px, calc(100% - 40px))",
        padding: 14,
        background: "rgba(255, 255, 255, 0.86)",
        backdropFilter: "blur(22px) saturate(1.4)",
        WebkitBackdropFilter: "blur(22px) saturate(1.4)",
        borderRadius: 24,
        border: "1px solid rgba(255, 255, 255, 0.9)",
        color: INK,
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 14,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        zIndex: 50,
        pointerEvents: "none",
        boxSizing: "border-box",
        boxShadow: "0 18px 48px rgba(60, 40, 140, 0.28)",
        transition: "opacity 220ms ease, transform 220ms ease",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-8px)",
      }}
    >
      {/* Screen identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          aria-hidden
          style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: 14,
            background: "linear-gradient(135deg, #e6defe, #d3e8ff)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="13" rx="3" />
            <path d="M8 21h8M12 17v4" />
          </svg>
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={label}>Ecrã</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                flexShrink: 0,
                borderRadius: "50%",
                background: "#22c55e",
                boxShadow: "0 0 0 3px rgba(34, 197, 94, 0.2)",
              }}
            />
            <strong style={{ ...ellipsis, fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>
              {config ? (config.deviceName || config.deviceCode || "Dispositivo") : "A sincronizar identidade..."}
            </strong>
          </div>
          {place ? (
            <div style={{ ...ellipsis, marginTop: 2, fontSize: 12, color: INK_SOFT }}>{place}</div>
          ) : null}
        </div>
      </div>

      {/* Playlist + now playing */}
      <div
        style={{
          borderRadius: 18,
          background: "rgba(112, 87, 220, 0.08)",
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {playlistName ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={label}>Playlist</div>
            <div style={{ ...ellipsis, fontSize: 14, fontWeight: 600 }}>{playlistName}</div>
          </div>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ ...label, color: BRAND }}>A reproduzir</div>
          <div style={{ ...ellipsis, fontSize: 14, fontWeight: 600 }}>
            {itemTitle || "Sem conteúdo"}
          </div>
        </div>
      </div>
    </div>
  );
}

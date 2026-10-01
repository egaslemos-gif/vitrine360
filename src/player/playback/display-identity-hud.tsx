"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { getConfig, getCurrentManifest, type LocalConfig, type LocalManifest } from "@/player/cache/indexed-db";
import { readLocalConfigSync } from "@/player/runtime/device-config";

export type DisplayIdentityHudProps = {
  visible: boolean;
  itemTitle?: string | null;
};

/* Inline styles on purpose: Smart TV browsers often ignore utility CSS. */
const INK = "#ffffff";
const INK_SOFT = "rgba(255, 255, 255, 0.78)";
const INK_FAINT = "rgba(255, 255, 255, 0.62)";
const BRAND = "#c4b8ff";

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
        width: "min(280px, calc(100% - 40px))",
        padding: 12,
        background: "rgba(20, 18, 44, 0.34)",
        backdropFilter: "blur(22px) saturate(1.6)",
        WebkitBackdropFilter: "blur(22px) saturate(1.6)",
        borderRadius: 22,
        border: "1px solid rgba(255, 255, 255, 0.22)",
        textShadow: "0 1px 2px rgba(0, 0, 0, 0.45)",
        color: INK,
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 14,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        zIndex: 50,
        pointerEvents: "none",
        boxSizing: "border-box",
        boxShadow: "0 10px 36px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.18)",
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
            width: 36,
            height: 36,
            flexShrink: 0,
            borderRadius: 12,
            background: "rgba(255, 255, 255, 0.16)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          background: "rgba(255, 255, 255, 0.1)",
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

"use client";

import { useEffect, useState } from "react";
import { getConfig, getCurrentManifest, type LocalConfig, type LocalManifest } from "@/player/cache/indexed-db";
import { readLocalConfigSync } from "@/player/runtime/device-config";

export type DisplayIdentityHudProps = {
  visible: boolean;
  itemTitle?: string | null;
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

  return (
    <div
      data-display-identity-hud
      style={{
        position: "absolute",
        top: 24,
        left: 24,
        padding: "12px 16px",
        background: "rgba(12, 14, 20, 0.85)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.12)",
        color: "#fff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 14,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        zIndex: 50,
        pointerEvents: "none",
        maxWidth: 320,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        transition: "opacity 220ms ease, transform 220ms ease",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-8px)",
      }}
    >
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
        Ecrã
      </div>
      
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#4ade80",
            boxShadow: "0 0 8px #4ade80",
          }}
        />
        <strong style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>
          {config ? (config.deviceName || config.deviceCode || "Dispositivo") : "A sincronizar identidade..."}
        </strong>
      </div>
      
      {(manifest?.playlist as { name?: string } | undefined)?.name && (
        <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {(manifest?.playlist as { name?: string } | undefined)?.name}
        </div>
      )}

      {(config?.location || config?.groupName) && (
        <div style={{ display: "flex", gap: 6, color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
          {config?.location && <span>{config.location}</span>}
          {config?.location && config?.groupName && <span>·</span>}
          {config?.groupName && <span>{config.groupName}</span>}
        </div>
      )}

      <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.1)", margin: "4px 0" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.02em" }}>
          A reproduzir
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {itemTitle || "Sem conteúdo"}
        </div>
      </div>
    </div>
  );
}

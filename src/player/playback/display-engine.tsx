"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createObjectUrl, getConfig, putAssetBlob } from "@/player/cache/indexed-db";

export type PlaybackItem = {
  playlistItemId: string;
  contentId: string;
  type: string;
  title: string;
  durationMs: number;
  transition: string;
  fitMode?: string;
  payload: Record<string, unknown>;
  assets: {
    id: string;
    mimeType: string;
    url?: string;
    offlineUrl?: string;
    checksum?: string;
  }[];
  /** EXPERIENCE-09 — false when ref invalid / not published. Never execute HTML. */
  experienceExecutable?: boolean;
  experienceBlockReason?: string;
};

const stageStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};

/** Fill the stage; object-fit contain keeps the whole frame and centers the leftover axis. */
const mediaStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "contain",
  objectPosition: "center center",
  background: "transparent",
};

export function DisplayEngine({
  items,
  onItemChange,
}: {
  items: PlaybackItem[];
  onItemChange?: (item: PlaybackItem | null) => void;
}) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const item = items[index] ?? null;

  useEffect(() => {
    onItemChange?.(item);
  }, [item, onItemChange]);

  const advanceSlide = () => {
    const next = items[(index + 1) % items.length];
    if (!next || next.type === "VIDEO" || item?.type === "VIDEO" || item?.transition === "cut") {
      setVisible(true);
      setIndex((i) => (i + 1) % items.length);
      return;
    }
    setVisible(false);
    window.setTimeout(() => {
      setIndex((i) => (i + 1) % items.length);
      setVisible(true);
    }, 280);
  };

  const nextType = items.length ? items[(index + 1) % items.length]?.type : undefined;

  useEffect(() => {
    if (!items.length || !item) return;

    if (item.type === "VIDEO" && item.durationMs === 0) {
      return; // Slide component handles advance via onNaturalEnd
    }

    const keepFrame = nextType === "VIDEO" || item.type === "VIDEO" || item.transition === "cut";
    const duration = Math.max(item.durationMs || 8000, 2000);
    let transitionTimer: number | undefined;
    const timer = window.setTimeout(() => {
      if (keepFrame) {
        setVisible(true);
        setIndex((current) => (current + 1) % items.length);
        return;
      }
      setVisible(false);
      transitionTimer = window.setTimeout(() => {
        setIndex((current) => (current + 1) % items.length);
        setVisible(true);
      }, 280);
    }, duration);
    return () => {
      window.clearTimeout(timer);
      if (transitionTimer !== undefined) {
        window.clearTimeout(transitionTimer);
      }
    };
  }, [index, items.length, item?.durationMs, item?.transition, item?.type, nextType]);

  if (!items.length) {
    return (
      <div style={{ ...stageStyle, background: "#070b14", color: "#fff", textAlign: "center", padding: 24 }}>
        <div>
          <p style={{ letterSpacing: "0.35em", color: "rgba(255,255,255,0.4)", fontSize: 14 }}>VITRINE360</p>
          <p style={{ marginTop: 24, fontSize: 32, fontWeight: 600 }}>NO CONTENT AVAILABLE</p>
          <p style={{ marginTop: 12, color: "rgba(255,255,255,0.5)" }}>A sincronizar a playlist…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#000", color: "#fff" }}>
      <div
        className={`player-slide-${item.transition || "fade"}`}
        style={{ position: "absolute", inset: 0, opacity: visible ? 1 : 0, transition: "opacity 300ms" }}
      >
        <Slide key={`${item.playlistItemId}-${index}`} item={item!} onNaturalEnd={advanceSlide} />
      </div>
    </div>
  );
}

function Slide({ item, onNaturalEnd }: { item: PlaybackItem; onNaturalEnd?: () => void }) {
  const asset = item.assets[0];
  const assetId = asset?.id;
  const assetUrl = asset?.url;
  const offlineUrl = asset?.offlineUrl;
  const assetChecksum = asset?.checksum ?? "";
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    (async () => {
      if (!assetId) {
        const payloadUrl = item.payload?.url;
        setUrl(typeof payloadUrl === "string" ? payloadUrl : null);
        return;
      }
      const objectUrl = await createObjectUrl(assetId).catch(() => null);
      if (cancelled) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        return;
      }
      if (objectUrl) {
        revoked = objectUrl;
        setUrl(objectUrl);
        return;
      }
      if (assetUrl && /^https?:\/\//i.test(assetUrl)) {
        setUrl(assetUrl);
        return;
      }
      try {
        const config = await getConfig();
        const path = offlineUrl ?? `/api/device/media/${encodeURIComponent(assetId)}`;
        if (!config?.deviceToken) {
          setUrl(assetUrl ?? null);
          return;
        }
        const res = await fetch(path, {
          headers: { Authorization: `Bearer ${config.deviceToken}` },
        });
        if (!res.ok) throw new Error(`media ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        // Persist so refresh / later slides do not re-hit the network.
        if (assetChecksum) {
          void putAssetBlob(assetId, blob, assetChecksum).catch(() => undefined);
        }
        const blobUrl = URL.createObjectURL(blob);
        revoked = blobUrl;
        setUrl(blobUrl);
      } catch {
        if (!cancelled) setUrl(assetUrl ?? null);
      }
    })();
    return () => {
      cancelled = true;
      if (revoked && revoked.startsWith("blob:")) {
        URL.revokeObjectURL(revoked);
      }
    };
    // assetUrl is read once per asset. Refreshing the signed URL must not
    // restart a video that is already playing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId]);

  const clock = new Date();

  if (item.type === "IMAGE" && url) {
    return (
      <div style={{ ...stageStyle, background: "#000" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={item.title} className="player-media" style={{ ...mediaStyle, zIndex: 1 }} />
      </div>
    );
  }

  if (item.type === "VIDEO" && url) {
    return (
      <div style={{ ...stageStyle, background: "#000" }}>
        <video
          src={url}
          className="player-media"
          style={mediaStyle}
          autoPlay
          muted
          playsInline
          preload="auto"
          loop={item.durationMs > 0}
          onEnded={() => {
            if (item.durationMs === 0) onNaturalEnd?.();
          }}
          onError={() => {
            if (item.durationMs === 0) {
              setTimeout(() => onNaturalEnd?.(), 2000);
            }
          }}
        />
      </div>
    );
  }

  if (item.type === "CLOCK") {
    return (
      <div
        style={{
          ...stageStyle,
          flexDirection: "column",
          background: "#0b1220",
          textAlign: "center",
          padding: "4vh 6vw",
        }}
      >
        <p
          style={{
            margin: 0,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: "0.04em",
            fontVariantNumeric: "tabular-nums",
            fontFamily: "ui-monospace, Consolas, monospace",
            fontSize: "clamp(120px, 32vh, 320px)",
          }}
        >
          {clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
        <p
          style={{
            marginTop: "3vh",
            opacity: 0.78,
            fontWeight: 500,
            fontSize: "clamp(40px, 7vh, 88px)",
          }}
        >
          {clock.toLocaleDateString()}
        </p>
      </div>
    );
  }

  // EXPERIENCE-09: typed Content reference only — no iframe / HTML / eval here.
  // Runtime Core (EX-10) + Admission (EX-08) are required before execution.
  if (item.type === "EXPERIENCE") {
    const exp =
      item.payload?.experience && typeof item.payload.experience === "object"
        ? (item.payload.experience as { experienceId?: string; version?: string })
        : null;
    const blocked =
      item.experienceExecutable === false ||
      !exp?.experienceId ||
      !exp?.version;
    return (
      <div
        style={{
          ...stageStyle,
          flexDirection: "column",
          textAlign: "center",
          padding: "0 8vw",
          background: "linear-gradient(160deg,#0b1220 0%,#132033 55%,#1a2740 100%)",
        }}
        data-experience-playback="safe-fallback"
        data-experience-block={item.experienceBlockReason ?? (blocked ? "EXPERIENCE_UNAVAILABLE" : "PENDING_RUNTIME")}
      >
        <p className="text-sm tracking-[0.4em] text-white/40">VITRINE360</p>
        <h1
          className="mt-8 max-w-5xl text-4xl font-semibold leading-tight md:text-5xl"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          {item.title}
        </h1>
        <p className="mt-6 text-lg text-white/55">
          {blocked ? "EXPERIENCE_UNAVAILABLE" : "EXPERIENCE · awaiting Runtime admission"}
        </p>
        {exp?.experienceId ? (
          <p className="mt-3 font-mono text-sm text-white/35">
            {exp.experienceId}@{exp.version}
          </p>
        ) : null}
      </div>
    );
  }

  const body =
    (item.payload.body as string) ||
    (item.payload.message as string) ||
    (item.payload.description as string) ||
    "";

  return (
    <div
      style={{
        ...stageStyle,
        flexDirection: "column",
        textAlign: "center",
        padding: "6vh 8vw",
        background: "linear-gradient(160deg,#0b1220 0%,#132033 55%,#1a2740 100%)",
      }}
    >
      <p
        style={{
          margin: 0,
          letterSpacing: "0.35em",
          opacity: 0.45,
          fontWeight: 600,
          fontSize: "clamp(20px, 2.8vh, 36px)",
        }}
      >
        VITRINE360
      </p>
      <h1
        style={{
          marginTop: "4vh",
          maxWidth: "92vw",
          fontWeight: 700,
          lineHeight: 1.15,
          fontFamily: "var(--font-fraunces), Georgia, serif",
          fontSize: "clamp(64px, 11vh, 160px)",
        }}
      >
        {item.title}
      </h1>
      {body ? (
        <p
          style={{
            marginTop: "3.5vh",
            maxWidth: "88vw",
            opacity: 0.88,
            lineHeight: 1.35,
            fontWeight: 500,
            fontSize: "clamp(36px, 5.5vh, 84px)",
          }}
        >
          {body}
        </p>
      ) : null}
    </div>
  );
}

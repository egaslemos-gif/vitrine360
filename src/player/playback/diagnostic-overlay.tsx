"use client";

import { useEffect, useState } from "react";
import type { PlaybackState } from "@/domain/playback-state";
import type { EnginePlaybackItem } from "@/player/playback/playlist-map";

export function DiagnosticOverlay({
  state,
  item,
}: {
  state: PlaybackState;
  item: EnginePlaybackItem | null;
}) {
  const [elements, setElements] = useState<{
    audio: number;
    video: number;
    details: string;
  }>({ audio: 0, video: 0, details: "" });

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const interval = setInterval(() => {
      const audios = Array.from(document.querySelectorAll("audio"));
      const videos = Array.from(document.querySelectorAll("video"));
      
      const details = [...audios, ...videos]
        .map((el) => {
          return `[${el.tagName}] src=${(el.currentSrc || el.src).substring(0, 40)}... paused=${el.paused} ended=${el.ended} ready=${el.readyState} muted=${el.muted}`;
        })
        .join("\n");

      setElements({
        audio: audios.length,
        video: videos.length,
        details,
      });
    }, 500);
    return () => clearInterval(interval);
  }, []);

  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        background: "rgba(0,0,0,0.8)",
        color: "lime",
        padding: "10px",
        fontFamily: "monospace",
        fontSize: "10px",
        zIndex: 9999,
        pointerEvents: "none",
        whiteSpace: "pre-wrap",
        maxWidth: "500px",
        wordBreak: "break-all"
      }}
    >
      <div>GEN: {state.generation}</div>
      <div>STATUS: {state.status}</div>
      <div>ITEM: {item?.contentId} ({item?.type})</div>
      <div>AUDIO: {elements.audio}</div>
      <div>VIDEO: {elements.video}</div>
      <div style={{ marginTop: 8 }}>{elements.details}</div>
    </div>
  );
}

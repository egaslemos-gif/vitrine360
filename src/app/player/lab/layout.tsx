import type { ReactNode } from "react";
import { isPlaybackLabEnabled } from "@/lib/playback-lab-guard";

export default function PlaybackLabLayout({ children }: { children: ReactNode }) {
  if (!isPlaybackLabEnabled(process.env)) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        Playback lab is disabled in production.
      </div>
    );
  }

  return children;
}

/**
 * Dev-only Playback lab route.
 * Client shell hosts dynamic(ssr:false) interactive tree (Next.js requires
 * ssr:false inside a Client Component — not a Server Component).
 */

"use client";

import dynamic from "next/dynamic";

const PlaybackLabClient = dynamic(() => import("./lab-client"), {
  ssr: false,
  loading: () => (
    <div
      data-playback-lab="loading"
      style={{
        height: "100vh",
        width: "100%",
        background: "#070b14",
      }}
    />
  ),
});

export default function PlaybackLabPage() {
  if (process.env.NODE_ENV === "production") {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        Playback lab is disabled in production.
      </div>
    );
  }

  return <PlaybackLabClient />;
}

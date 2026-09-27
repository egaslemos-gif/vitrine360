import type { Metadata } from "next";
import { PlayerApp } from "./page-client";
import { ServiceWorkerRegister } from "@/player/device/sw-register";
import { PlayerRuntimeShell } from "@/player/runtime/shell";

/** Static shell — better PWA caching for Passive Runtime appliances */
export const dynamic = "force-static";
export const revalidate = false;

export const metadata: Metadata = {
  title: "Vitrine360 Player",
  description: "Digital Signage Passive Player Runtime",
  manifest: "/player-manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Vitrine360",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function PlayerPage() {
  return (
    <PlayerRuntimeShell>
      <ServiceWorkerRegister />
      <PlayerApp />
    </PlayerRuntimeShell>
  );
}

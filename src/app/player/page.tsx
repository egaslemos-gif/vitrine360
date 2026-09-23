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

/** Runs before React — Sraf freezes on Next hydration / IDB / SW. */
const SMART_TV_BOOT_REDIRECT = `
(function(){
  try {
    var ua = navigator.userAgent || "";
    var force = /[?&]tv=1(?:&|$)/.test(location.search);
    if (force || /Sraf|Web0S|Tizen|SmartTV|NetRange|HbbTV|Maple|Viera|Hisense|VIDAA/i.test(ua)) {
          if (location.pathname.indexOf("player-smarttv") === -1) {
            location.replace("/tv.html?v=044");
          }
    }
  } catch (e) {}
})();
`;

export default function PlayerPage() {
  return (
    <PlayerRuntimeShell>
      <script dangerouslySetInnerHTML={{ __html: SMART_TV_BOOT_REDIRECT }} />
      <ServiceWorkerRegister />
      <PlayerApp />
    </PlayerRuntimeShell>
  );
}

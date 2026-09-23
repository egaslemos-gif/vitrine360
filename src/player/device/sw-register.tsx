"use client";

import { useEffect } from "react";
import { isFragileSmartTvBrowser } from "@/player/device/fragile-tv";

/**
 * Registers SW and warms the runtime cache with current document assets
 * so offline reboot can hydrate /player without the origin server.
 * Skipped on fragile Smart TV browsers (pairing still works online).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Do not call getRegistrations()/unregister() on Sraf — those APIs can
    // freeze the JS event loop the same way IndexedDB does.
    if (isFragileSmartTvBrowser()) return;

    void (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        await reg.update().catch(() => undefined);

        const urls = [
          "/player",
          "/player-manifest.webmanifest",
          "/sw.js",
          ...Array.from(
            document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>(
              "script[src],link[rel='stylesheet'][href]",
            ),
          )
            .map((el) =>
              "src" in el && el.src ? el.src : (el as HTMLLinkElement).href,
            )
            .filter((u) => u.startsWith(window.location.origin)),
        ];

        await Promise.all(
          urls.map(async (url) => {
            try {
              await fetch(url, { credentials: "same-origin", cache: "reload" });
            } catch {
              /* ignore warm failures */
            }
          }),
        );
      } catch {
        /* ignore */
      }
    })();
  }, []);

  return null;
}

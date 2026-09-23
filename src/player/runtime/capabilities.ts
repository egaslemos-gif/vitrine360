/**
 * RUNTIME-POLICY-03 — Detected Runtime Capability Probe.
 *
 * Browser facts only. Does NOT call requestFullscreen / orientation.lock,
 * register SW, open IndexedDB, or hit the network.
 *
 * Distinct from `RuntimeCapabilities` in passive.ts (product flavour flags).
 */

import {
  UNKNOWN_CAPABILITIES,
  assertNoAuthTokenExposure,
  type DetectedRuntimeCapabilities,
} from "@/domain/runtime-policy";

/** Environment metadata — not capability booleans. */
export type RuntimeEnvironmentMeta = {
  userAgent: string;
  fragileSmartTv: boolean;
  secureContext: boolean;
  language: string;
};

export type CapabilityProbeHost = {
  window: {
    PointerEvent?: unknown;
    HTMLVideoElement?: unknown;
    HTMLImageElement?: unknown;
    indexedDB?: unknown;
    isSecureContext?: boolean;
    addEventListener?: unknown;
  };
  document: {
    createElement: (tag: string) => {
      canPlayType?: (type: string) => string;
    };
    documentElement?: {
      requestFullscreen?: unknown;
      webkitRequestFullscreen?: unknown;
      msRequestFullscreen?: unknown;
    };
  };
  navigator: {
    userAgent?: string;
    language?: string;
    maxTouchPoints?: number;
    onLine?: boolean;
    serviceWorker?: unknown;
  };
  screen?: {
    orientation?: unknown;
  };
};

export type CapabilityProbeResult = {
  capabilities: DetectedRuntimeCapabilities;
  environment: RuntimeEnvironmentMeta;
  probedAt: string;
  ok: boolean;
  error: string | null;
};

function freezeCaps(
  caps: DetectedRuntimeCapabilities,
): DetectedRuntimeCapabilities {
  return Object.freeze({ ...caps }) as DetectedRuntimeCapabilities;
}

function defaultHost(): CapabilityProbeHost {
  return {
    window: globalThis.window as CapabilityProbeHost["window"],
    document: globalThis.document as CapabilityProbeHost["document"],
    navigator: globalThis.navigator as CapabilityProbeHost["navigator"],
    screen: globalThis.screen as CapabilityProbeHost["screen"],
  };
}

function detectVideo(host: CapabilityProbeHost): boolean {
  try {
    if (typeof host.document?.createElement !== "function") return false;
    const el = host.document.createElement("video");
    if (typeof el.canPlayType !== "function") {
      // Element exists but no canPlayType — still basic video host in some engines
      return typeof host.window.HTMLVideoElement !== "undefined";
    }
    // Basic playback support: any non-empty canPlayType result counts as "has video"
    const probes = [
      'video/mp4; codecs="avc1.42E01E"',
      "video/mp4",
      "video/webm",
    ];
    for (const type of probes) {
      const r = el.canPlayType(type);
      if (r === "probably" || r === "maybe") return true;
    }
    return typeof host.window.HTMLVideoElement !== "undefined";
  } catch {
    return false;
  }
}

function detectImage(host: CapabilityProbeHost): boolean {
  try {
    return typeof host.window.HTMLImageElement !== "undefined";
  } catch {
    return false;
  }
}

function detectGif(host: CapabilityProbeHost): boolean {
  // Browser-native GIF via <img> — same surface as IMAGE capability
  return detectImage(host);
}

function detectTouch(host: CapabilityProbeHost): boolean {
  try {
    const n = host.navigator?.maxTouchPoints;
    return typeof n === "number" && n > 0;
  } catch {
    return false;
  }
}

function detectPointer(host: CapabilityProbeHost): boolean {
  try {
    return typeof host.window.PointerEvent !== "undefined";
  } catch {
    return false;
  }
}

function detectKeyboard(host: CapabilityProbeHost): boolean {
  try {
    return typeof host.window.addEventListener === "function";
  } catch {
    return false;
  }
}

function detectFullscreen(host: CapabilityProbeHost): boolean {
  try {
    const el = host.document?.documentElement;
    if (!el) return false;
    return (
      typeof el.requestFullscreen === "function" ||
      typeof el.webkitRequestFullscreen === "function" ||
      typeof el.msRequestFullscreen === "function"
    );
  } catch {
    return false;
  }
}

function detectOrientation(host: CapabilityProbeHost): boolean {
  try {
    return !!host.screen && typeof host.screen.orientation !== "undefined";
  } catch {
    return false;
  }
}

function detectNetwork(host: CapabilityProbeHost): boolean {
  try {
    return typeof host.navigator?.onLine === "boolean";
  } catch {
    return false;
  }
}

function detectServiceWorker(host: CapabilityProbeHost): boolean {
  try {
    return "serviceWorker" in (host.navigator ?? {});
  } catch {
    return false;
  }
}

function detectIndexedDB(host: CapabilityProbeHost): boolean {
  try {
    return "indexedDB" in (host.window ?? {});
  } catch {
    return false;
  }
}

/**
 * Probe browser capabilities. Never throws to callers — failures → safe defaults.
 * Does not mutate IndexedDB, SW registration, or Runtime Cache.
 */
export function probeRuntimeCapabilities(
  host?: CapabilityProbeHost,
): CapabilityProbeResult {
  const probedAt = new Date().toISOString();
  try {
    const h = host ?? defaultHost();
    const caps: DetectedRuntimeCapabilities = {
      video: detectVideo(h),
      image: detectImage(h),
      gif: detectGif(h),
      touch: detectTouch(h),
      pointer: detectPointer(h),
      keyboard: detectKeyboard(h),
      // Never infer remote from keydown alone
      remote: false,
      fullscreen: detectFullscreen(h),
      orientation: detectOrientation(h),
      network: detectNetwork(h),
      serviceWorker: detectServiceWorker(h),
      indexedDB: detectIndexedDB(h),
    };

    const frozen = freezeCaps(caps);
    assertNoAuthTokenExposure(frozen as unknown as Record<string, unknown>);

    const ua = h.navigator?.userAgent ?? "";
    const environment: RuntimeEnvironmentMeta = {
      userAgent: ua.slice(0, 240),
      fragileSmartTv:
        /Sraf|Web0S|Tizen|SmartTV|NetRange|HbbTV|Maple|Viera|Hisense|VIDAA/i.test(
          ua,
        ),
      secureContext: h.window?.isSecureContext === true,
      language: h.navigator?.language ?? "",
    };

    return {
      capabilities: frozen,
      environment,
      probedAt,
      ok: true,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      capabilities: freezeCaps({ ...UNKNOWN_CAPABILITIES }),
      environment: {
        userAgent: "",
        fragileSmartTv: false,
        secureContext: false,
        language: "",
      },
      probedAt,
      ok: false,
      error: message.slice(0, 200),
    };
  }
}

export function formatCapabilitiesDiagnostics(
  caps: DetectedRuntimeCapabilities,
): string {
  const row = (k: keyof DetectedRuntimeCapabilities) =>
    `${k}: ${caps[k] ? "✓" : "✗"}`;
  return [
    row("video"),
    row("image"),
    row("gif"),
    row("touch"),
    row("pointer"),
    row("keyboard"),
    row("remote"),
    row("fullscreen"),
    row("orientation"),
    row("network"),
    row("serviceWorker"),
    row("indexedDB"),
  ].join(" · ");
}

/** Window key for diagnostics / E2E (no secrets). */
export const CAPABILITIES_GLOBAL_KEY = "__v360_runtime_capabilities";

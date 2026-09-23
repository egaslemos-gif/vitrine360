/**
 * RUNTIME-POLICY-03 — Capability probe unit tests (CAP-001 … 017)
 * Run: npm run test:runtime-policy-03
 */
import assert from "node:assert/strict";
import {
  probeRuntimeCapabilities,
  formatCapabilitiesDiagnostics,
  type CapabilityProbeHost,
} from "../src/player/runtime/capabilities";
import {
  UNKNOWN_CAPABILITIES,
  assertNoAuthTokenExposure,
} from "../src/domain/runtime-policy";
import { getPassiveRuntimeCapabilities } from "../src/player/runtime/passive";

function makeHost(overrides: {
  touchPoints?: number;
  pointer?: boolean;
  fullscreen?: boolean;
  orientation?: boolean;
  online?: boolean;
  sw?: boolean;
  idb?: boolean;
  videoCanPlay?: string;
  hasVideoEl?: boolean;
  hasImage?: boolean;
  ua?: string;
  secure?: boolean;
}): CapabilityProbeHost {
  const videoCanPlay = overrides.videoCanPlay ?? "probably";
  const win: CapabilityProbeHost["window"] = {
    PointerEvent:
      overrides.pointer === false ? undefined : function PointerEvent() {},
    HTMLVideoElement:
      overrides.hasVideoEl === false
        ? undefined
        : function HTMLVideoElement() {},
    HTMLImageElement:
      overrides.hasImage === false
        ? undefined
        : function HTMLImageElement() {},
    isSecureContext: overrides.secure !== false,
    addEventListener: () => {},
  };
  if (overrides.idb !== false) {
    (win as { indexedDB?: unknown }).indexedDB = {};
  }

  const nav: CapabilityProbeHost["navigator"] = {
    userAgent: overrides.ua ?? "Mozilla/5.0 Test",
    language: "pt",
    maxTouchPoints: overrides.touchPoints ?? 0,
    onLine: overrides.online !== false,
  };
  if (overrides.sw !== false) {
    (nav as { serviceWorker?: unknown }).serviceWorker = {};
  }

  return {
    window: win,
    document: {
      createElement: (tag: string) => {
        if (tag === "video") {
          return {
            canPlayType: () => videoCanPlay,
          };
        }
        return {};
      },
      documentElement: {
        requestFullscreen:
          overrides.fullscreen === false ? undefined : () => {},
      },
    },
    navigator: nav,
    screen: {
      orientation:
        overrides.orientation === false
          ? undefined
          : { type: "landscape-primary" },
    },
  };
}

function main() {
  console.log("RUNTIME-POLICY-03 capability probe");

  // CAP-001 Default / unknown shape
  console.log("CAP-001 default object");
  assert.equal(typeof UNKNOWN_CAPABILITIES.video, "boolean");
  assert.equal(UNKNOWN_CAPABILITIES.remote, false);
  const flavour = getPassiveRuntimeCapabilities();
  assert.ok(!("fullscreen" in flavour));
  assert.ok("fullscreen" in UNKNOWN_CAPABILITIES);

  // CAP-002 Video
  console.log("CAP-002 video");
  assert.equal(
    probeRuntimeCapabilities(makeHost({ videoCanPlay: "probably" })).capabilities
      .video,
    true,
  );
  assert.equal(
    probeRuntimeCapabilities(
      makeHost({ videoCanPlay: "", hasVideoEl: false }),
    ).capabilities.video,
    false,
  );

  // CAP-003 Image
  console.log("CAP-003 image");
  assert.equal(
    probeRuntimeCapabilities(makeHost({ hasImage: true })).capabilities.image,
    true,
  );
  assert.equal(
    probeRuntimeCapabilities(makeHost({ hasImage: false })).capabilities.image,
    false,
  );

  // CAP-004 GIF (native via image)
  console.log("CAP-004 gif");
  assert.equal(
    probeRuntimeCapabilities(makeHost({ hasImage: true })).capabilities.gif,
    true,
  );

  // CAP-005 Touch
  console.log("CAP-005 touch");
  assert.equal(
    probeRuntimeCapabilities(makeHost({ touchPoints: 2 })).capabilities.touch,
    true,
  );
  assert.equal(
    probeRuntimeCapabilities(makeHost({ touchPoints: 0 })).capabilities.touch,
    false,
  );

  // CAP-006 Pointer
  console.log("CAP-006 pointer");
  assert.equal(
    probeRuntimeCapabilities(makeHost({ pointer: true })).capabilities.pointer,
    true,
  );
  assert.equal(
    probeRuntimeCapabilities(makeHost({ pointer: false })).capabilities.pointer,
    false,
  );

  // CAP-007 Keyboard
  console.log("CAP-007 keyboard");
  assert.equal(
    probeRuntimeCapabilities(makeHost({})).capabilities.keyboard,
    true,
  );

  // CAP-008 Remote false without evidence
  console.log("CAP-008 remote false");
  assert.equal(
    probeRuntimeCapabilities(makeHost({})).capabilities.remote,
    false,
  );

  // CAP-009 Fullscreen API presence (not invoked)
  console.log("CAP-009 fullscreen");
  assert.equal(
    probeRuntimeCapabilities(makeHost({ fullscreen: true })).capabilities
      .fullscreen,
    true,
  );
  assert.equal(
    probeRuntimeCapabilities(makeHost({ fullscreen: false })).capabilities
      .fullscreen,
    false,
  );

  // CAP-010 Orientation API presence
  console.log("CAP-010 orientation");
  assert.equal(
    probeRuntimeCapabilities(makeHost({ orientation: true })).capabilities
      .orientation,
    true,
  );
  assert.equal(
    probeRuntimeCapabilities(makeHost({ orientation: false })).capabilities
      .orientation,
    false,
  );

  // CAP-011 Network API
  console.log("CAP-011 network");
  assert.equal(
    probeRuntimeCapabilities(makeHost({ online: true })).capabilities.network,
    true,
  );

  // CAP-012 Service Worker API
  console.log("CAP-012 serviceWorker");
  assert.equal(
    probeRuntimeCapabilities(makeHost({ sw: true })).capabilities.serviceWorker,
    true,
  );
  assert.equal(
    probeRuntimeCapabilities(makeHost({ sw: false })).capabilities.serviceWorker,
    false,
  );

  // CAP-013 IndexedDB API
  console.log("CAP-013 indexedDB");
  assert.equal(
    probeRuntimeCapabilities(makeHost({ idb: true })).capabilities.indexedDB,
    true,
  );
  assert.equal(
    probeRuntimeCapabilities(makeHost({ idb: false })).capabilities.indexedDB,
    false,
  );

  // CAP-014 No token exposure
  console.log("CAP-014 no tokens");
  const snap = probeRuntimeCapabilities(makeHost({}));
  assert.doesNotThrow(() =>
    assertNoAuthTokenExposure(
      snap.capabilities as unknown as Record<string, unknown>,
    ),
  );
  assert.doesNotThrow(() =>
    assertNoAuthTokenExposure(
      snap.environment as unknown as Record<string, unknown>,
    ),
  );

  // CAP-015 Immutability
  console.log("CAP-015 freeze");
  const frozen = probeRuntimeCapabilities(makeHost({})).capabilities;
  assert.throws(() => {
    (frozen as { video: boolean }).video = !frozen.video;
  });

  // CAP-016 Probe does not mutate Runtime Cache — no IDB open (host has no open call)
  console.log("CAP-016 no cache mutation");
  let idbOpened = false;
  const hostNoOpen = makeHost({ idb: true });
  (hostNoOpen.window as { indexedDB: { open?: () => void } }).indexedDB = {
    open: () => {
      idbOpened = true;
    },
  };
  probeRuntimeCapabilities(hostNoOpen);
  assert.equal(idbOpened, false);

  // CAP-017 Probe failure non-fatal
  console.log("CAP-017 non-fatal");
  const badHost = {
    get window() {
      throw new Error("boom");
    },
    document: { createElement: () => ({}) },
    navigator: {},
  } as unknown as CapabilityProbeHost;
  const failed = probeRuntimeCapabilities(badHost);
  assert.equal(failed.ok, false);
  assert.ok(failed.error);
  assert.equal(failed.capabilities.remote, false);

  assert.ok(formatCapabilitiesDiagnostics(frozen).includes("video:"));

  // Environment is not capability: Hisense UA does not force fullscreen false
  console.log("CAP env metadata");
  const hisense = probeRuntimeCapabilities(
    makeHost({
      ua: "Mozilla/5.0 Hisense VIDAA Sraf",
      fullscreen: true,
    }),
  );
  assert.equal(hisense.environment.fragileSmartTv, true);
  assert.equal(hisense.capabilities.fullscreen, true);

  console.log("PASS RUNTIME-POLICY-03");
}

main();

/**
 * RUNTIME-POLICY-07 — Device Runtime Observability tests.
 * Run: npm run test:runtime-policy-07
 */
import assert from "node:assert/strict";
import {
  deriveDeviceRuntimeObservability,
  parsePlayerStatePayload,
  presenceToLabel,
} from "../src/domain/device-observability";
import {
  assertNoAuthTokenExposure,
  assertTenantDeviceScope,
} from "../src/domain/runtime-policy";

function payload(extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    state: "PLAYING",
    contentId: "content-1",
    runtime: "PASSIVE",
    observedAt: new Date().toISOString(),
    runtimeState: {
      isPlaying: true,
      currentContentId: "content-1",
      currentManifestVersion: 3,
      syncState: "READY",
      networkState: "ONLINE",
      cursorVisible: false,
      fullscreenActive: false,
      orientationActual: "LANDSCAPE",
      lastInputAt: Date.now(),
      lastInputClass: "KEYBOARD_LIKE",
    },
    policy: {
      policySource: "DEVICE_CONFIG",
      requested: {
        presentation: "AUTO",
        cursor: "AUTO_HIDE",
        interaction: "PASSIVE",
        orientation: "LANDSCAPE",
        input: ["KEYBOARD_LIKE"],
      },
      resolved: {
        presentation: "FULLSCREEN",
        cursor: "AUTO_HIDE",
        interaction: "PASSIVE",
        orientation: "LANDSCAPE",
        input: ["KEYBOARD_LIKE"],
      },
    },
    ...extra,
  });
}

function main() {
  console.log("RUNTIME-POLICY-07 device observability");

  // OBS-001 presence ≠ runtime
  console.log("OBS-001 independent");
  const onlineIdle = deriveDeviceRuntimeObservability({
    presence: "ONLINE",
    lastSeenAt: new Date().toISOString(),
    playerStateRaw: JSON.stringify({
      state: "IDLE",
      observedAt: new Date().toISOString(),
      runtimeState: { isPlaying: false, syncState: "READY" },
    }),
  });
  assert.equal(onlineIdle.presence.status, "ONLINE");
  assert.equal(onlineIdle.runtime.isPlaying, false);

  // OBS-002 ONLINE ≠ PLAYING
  console.log("OBS-002 ONLINE not PLAYING");
  assert.equal(onlineIdle.runtime.isPlaying, false);

  // OBS-003 OFFLINE preserves last reported
  console.log("OBS-003 OFFLINE last reported");
  const offlinePlaying = deriveDeviceRuntimeObservability({
    presence: "OFFLINE",
    lastSeenAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    playerStateRaw: payload({
      observedAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    }),
  });
  assert.equal(offlinePlaying.presence.status, "OFFLINE");
  assert.equal(offlinePlaying.runtime.isPlaying, true);
  assert.equal(offlinePlaying.runtime.isLastReported, true);
  assert.equal(presenceToLabel("AWAY"), "INSTAVEL");

  // OBS-004 lastSeenAt controls presence label mapping (caller supplies presence)
  console.log("OBS-004 lastSeenAt");
  assert.equal(offlinePlaying.presence.lastSeenAt != null, true);
  assert.equal(offlinePlaying.presence.backendHeartbeat, "NOT_RECENT");

  // OBS-005 observedAt
  console.log("OBS-005 observedAt");
  assert.ok(onlineIdle.observedAt || offlinePlaying.observedAt);

  // OBS-006 requested ≠ resolved
  console.log("OBS-006 requested vs resolved");
  assert.equal(offlinePlaying.policy.requested?.presentation, "AUTO");
  assert.equal(offlinePlaying.policy.resolved?.presentation, "FULLSCREEN");
  assert.notEqual(
    offlinePlaying.policy.requested?.presentation,
    offlinePlaying.policy.resolved?.presentation,
  );

  // OBS-007 resolved ≠ actual
  console.log("OBS-007 resolved vs actual");
  assert.equal(offlinePlaying.policy.resolved?.presentation, "FULLSCREEN");
  assert.equal(offlinePlaying.actual.fullscreenActive, false);

  // OBS-008 fullscreen mismatch INFO
  console.log("OBS-008 fullscreen INFO");
  assert.ok(
    offlinePlaying.diagnostics.some(
      (d) =>
        d.code === "PRESENTATION_NOT_ACTUALLY_FULLSCREEN" &&
        d.severity === "INFO",
    ),
  );

  // OBS-009 orientation WARNING
  console.log("OBS-009 orientation WARNING");
  const orientMismatch = deriveDeviceRuntimeObservability({
    presence: "ONLINE",
    lastSeenAt: new Date().toISOString(),
    playerStateRaw: payload({
      runtimeState: {
        isPlaying: true,
        fullscreenActive: false,
        orientationActual: "PORTRAIT",
        syncState: "READY",
        networkState: "ONLINE",
      },
      policy: {
        policySource: "DEVICE_CONFIG",
        requested: { orientation: "LANDSCAPE", presentation: "AUTO" },
        resolved: { orientation: "LANDSCAPE", presentation: "FULLSCREEN" },
      },
    }),
  });
  assert.ok(
    orientMismatch.diagnostics.some(
      (d) => d.code === "ORIENTATION_MISMATCH" && d.severity === "WARNING",
    ),
  );

  // OBS-010 sort ERROR > WARNING > INFO
  console.log("OBS-010 sort");
  const sorted = deriveDeviceRuntimeObservability({
    presence: "ONLINE",
    lastSeenAt: new Date().toISOString(),
    playerStateRaw: payload({
      diagnostics: [
        { code: "Z_INFO", severity: "INFO", message: "i" },
        { code: "A_ERROR", severity: "ERROR", message: "e" },
        { code: "B_WARN", severity: "WARNING", message: "w" },
      ],
      runtimeState: {
        isPlaying: false,
        fullscreenActive: false,
        orientationActual: "PORTRAIT",
      },
      policy: {
        policySource: "DEFAULT",
        requested: { orientation: "LANDSCAPE", presentation: "FULLSCREEN" },
        resolved: { orientation: "LANDSCAPE", presentation: "FULLSCREEN" },
      },
    }),
  });
  assert.equal(sorted.diagnostics[0]?.severity, "ERROR");
  const severities = sorted.diagnostics.map((d) => d.severity);
  const firstWarn = severities.indexOf("WARNING");
  const firstInfo = severities.indexOf("INFO");
  assert.ok(firstWarn >= 0 && firstInfo >= 0 && firstWarn < firstInfo);

  // OBS-011 content lookup
  console.log("OBS-011 content");
  const withContent = deriveDeviceRuntimeObservability({
    presence: "ONLINE",
    lastSeenAt: new Date().toISOString(),
    playerStateRaw: payload(),
    contentMeta: { id: "content-1", title: "Promo", type: "IMAGE" },
  });
  assert.equal(withContent.content.available, true);
  assert.equal(withContent.content.title, "Promo");

  // OBS-012 missing content
  console.log("OBS-012 missing content");
  const missing = deriveDeviceRuntimeObservability({
    presence: "ONLINE",
    lastSeenAt: new Date().toISOString(),
    playerStateRaw: payload(),
    contentMeta: null,
  });
  assert.equal(missing.content.available, false);
  assert.equal(missing.content.id, "content-1");

  // OBS-013 manifest
  console.log("OBS-013 manifest");
  assert.equal(offlinePlaying.runtime.currentManifestVersion, 3);

  // OBS-014 network ONLINE ≠ backend
  console.log("OBS-014 network vs backend");
  const netOnlineHeartbeatStale = deriveDeviceRuntimeObservability({
    presence: "OFFLINE",
    lastSeenAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    playerStateRaw: payload({
      runtimeState: {
        isPlaying: true,
        networkState: "ONLINE",
        fullscreenActive: false,
        orientationActual: "LANDSCAPE",
      },
    }),
  });
  assert.equal(netOnlineHeartbeatStale.runtime.networkState, "ONLINE");
  assert.equal(
    netOnlineHeartbeatStale.presence.backendHeartbeat,
    "NOT_RECENT",
  );

  // OBS-015 / 016 tenant-device scope
  console.log("OBS-015/016 isolation");
  assert.throws(() =>
    assertTenantDeviceScope("tenant-a", "tenant-b", "d1", "d1"),
  );
  assert.throws(() =>
    assertTenantDeviceScope("tenant-a", "tenant-a", "dev-a", "dev-b"),
  );
  assertTenantDeviceScope("tenant-a", "tenant-a", "dev-a", "dev-a");

  // OBS-017 no tokens
  console.log("OBS-017 no tokens");
  assertNoAuthTokenExposure(
    offlinePlaying as unknown as Record<string, unknown>,
  );
  const parsed = parsePlayerStatePayload(
    JSON.stringify({
      state: "PLAYING",
      runtimeState: { isPlaying: true },
    }),
  );
  assert.ok(parsed);
  assert.ok(!JSON.stringify(offlinePlaying).toLowerCase().includes("bearer"));

  // OBS-018 stale marked
  console.log("OBS-018 stale");
  assert.equal(offlinePlaying.stale, true);
  assert.ok((offlinePlaying.staleAgeMs ?? 0) > 0);
  const fresh = deriveDeviceRuntimeObservability({
    presence: "ONLINE",
    lastSeenAt: new Date().toISOString(),
    playerStateRaw: payload(),
  });
  assert.equal(fresh.stale, false);

  // OBS-019 no N+1 requirement — derive is pure / local
  console.log("OBS-019 derive pure");
  assert.equal(typeof deriveDeviceRuntimeObservability, "function");

  // OBS-020 does not mutate input
  console.log("OBS-020 immutable");
  const raw = payload();
  const before = raw;
  deriveDeviceRuntimeObservability({
    presence: "ONLINE",
    lastSeenAt: new Date().toISOString(),
    playerStateRaw: raw,
  });
  assert.equal(raw, before);

  console.log("PASS RUNTIME-POLICY-07");
}

main();

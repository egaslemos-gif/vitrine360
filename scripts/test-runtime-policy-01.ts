/**
 * RUNTIME-POLICY-01 — Architectural contract tests.
 * Run: npm run test:runtime-policy-01
 *
 * Does not implement fullscreen/orientation features — pure domain contracts.
 */
import assert from "node:assert/strict";
import {
  DEFAULT_DOMAIN_RUNTIME_POLICY,
  UNKNOWN_CAPABILITIES,
  defaultPolicyFromDeviceConfig,
  resolveRuntimePolicy,
  classifyInputEvent,
  assertTenantDeviceScope,
  assertNoAuthTokenExposure,
  cursorVisibleAfterInput,
  CURSOR_IDLE_MS,
  type DetectedRuntimeCapabilities,
  type DomainRuntimePolicy,
} from "../src/domain/runtime-policy";
import {
  getPassiveRuntimeCapabilities,
  getInteractiveRuntimeCapabilities,
} from "../src/player/runtime/passive";
import { PLAYER_RUNTIME } from "../src/domain/types";

function main() {
  console.log("RUNTIME-POLICY-01 architectural probes");

  // POLICY-001 Default policy
  console.log("POLICY-001 default policy");
  assert.equal(DEFAULT_DOMAIN_RUNTIME_POLICY.presentation, "AUTO");
  assert.equal(DEFAULT_DOMAIN_RUNTIME_POLICY.cursor, "AUTO_HIDE");
  assert.equal(DEFAULT_DOMAIN_RUNTIME_POLICY.interaction, "PASSIVE");
  assert.equal(DEFAULT_DOMAIN_RUNTIME_POLICY.orientation, "AUTO");
  assert.ok(DEFAULT_DOMAIN_RUNTIME_POLICY.input.includes("KEYBOARD_LIKE"));

  // POLICY-002 Explicit policy from device config
  console.log("POLICY-002 explicit / device-derived policy");
  const fromTv = defaultPolicyFromDeviceConfig({
    interactionMode: "PASSIVE",
    displayType: "TV",
    orientationStored: "landscape",
  });
  assert.equal(fromTv.presentation, "AUTO");
  assert.equal(fromTv.interaction, "PASSIVE");
  assert.equal(fromTv.orientation, "LANDSCAPE");
  const fromTouch = defaultPolicyFromDeviceConfig({
    interactionMode: "TOUCH",
    displayType: "TOUCH_DISPLAY",
    orientationStored: "portrait",
  });
  assert.equal(fromTouch.interaction, "INTERACTIVE");
  assert.equal(fromTouch.orientation, "PORTRAIT");
  assert.equal(fromTouch.presentation, "AUTO");

  // POLICY-003 Capability detection contract (facts ≠ desire)
  console.log("POLICY-003 capability detection contract");
  const caps: DetectedRuntimeCapabilities = {
    ...UNKNOWN_CAPABILITIES,
    image: true,
    gif: true,
    video: true,
    network: true,
  };
  assert.equal(caps.fullscreen, false);
  assert.equal(fromTv.presentation, "AUTO");
  assert.notEqual(
    fromTv.presentation,
    "FULLSCREEN",
    "TV displayType must not imply FULLSCREEN presentation",
  );

  // POLICY-004 Unsupported fullscreen fallback
  console.log("POLICY-004 unsupported fullscreen fallback");
  const resolvedFs = resolveRuntimePolicy({
    tenantId: "t1",
    deviceId: "d1",
    policy: { ...DEFAULT_DOMAIN_RUNTIME_POLICY, presentation: "FULLSCREEN" },
    capabilities: { ...UNKNOWN_CAPABILITIES, fullscreen: false },
  });
  assert.equal(resolvedFs.presentation, "WINDOWED");
  assert.ok(resolvedFs.fallbacks.some((f) => f.field === "presentation"));
  assert.ok(resolvedFs.diagnostics.length > 0);

  // POLICY-005 Cursor policy
  console.log("POLICY-005 cursor policy");
  assert.equal(cursorVisibleAfterInput("HIDDEN", CURSOR_IDLE_MS, 0), false);
  assert.equal(cursorVisibleAfterInput("VISIBLE", CURSOR_IDLE_MS, 99999), true);
  assert.equal(cursorVisibleAfterInput("AUTO_HIDE", CURSOR_IDLE_MS, 500), true);
  assert.equal(cursorVisibleAfterInput("AUTO_HIDE", CURSOR_IDLE_MS, 3001), false);
  assert.equal(CURSOR_IDLE_MS, 3000);

  // POLICY-006 Input capability / classification
  console.log("POLICY-006 input capability");
  assert.equal(classifyInputEvent("mousemove"), "MOUSE");
  assert.equal(classifyInputEvent("touchstart"), "TOUCH");
  assert.equal(classifyInputEvent("keydown"), "KEYBOARD_LIKE");
  assert.notEqual(classifyInputEvent("keydown"), "REMOTE");

  // POLICY-007 Orientation capability
  console.log("POLICY-007 orientation capability");
  const orient = resolveRuntimePolicy({
    tenantId: "t1",
    deviceId: "d1",
    policy: { ...DEFAULT_DOMAIN_RUNTIME_POLICY, orientation: "LANDSCAPE" },
    capabilities: { ...UNKNOWN_CAPABILITIES, orientation: false },
  });
  assert.equal(orient.orientation, "AUTO");
  assert.ok(orient.fallbacks.some((f) => f.field === "orientation"));

  // POLICY-008 Resolved policy observability
  console.log("POLICY-008 resolved policy");
  const auto = resolveRuntimePolicy({
    tenantId: "t1",
    deviceId: "d1",
    policy: { ...DEFAULT_DOMAIN_RUNTIME_POLICY, presentation: "AUTO" },
    capabilities: { ...UNKNOWN_CAPABILITIES, fullscreen: true },
    environment: { userActivationAvailable: true },
  });
  assert.equal(auto.presentation, "FULLSCREEN");
  assert.equal(auto.tenantId, "t1");
  assert.equal(auto.deviceId, "d1");

  // POLICY-009 Runtime state separation (type-level via shapes)
  console.log("POLICY-009 runtime state separation");
  const stateKeys = [
    "isPlaying",
    "cursorVisible",
    "fullscreenActive",
    "lastInputAt",
  ];
  const policyKeys = Object.keys(DEFAULT_DOMAIN_RUNTIME_POLICY);
  for (const k of stateKeys) {
    assert.ok(!policyKeys.includes(k), `state key ${k} must not be policy`);
  }

  // POLICY-010 Tenant isolation
  console.log("POLICY-010 tenant isolation");
  assert.throws(() =>
    assertTenantDeviceScope("tenant-a", "tenant-b", "d1", "d1"),
  );
  assert.throws(() =>
    assertTenantDeviceScope("tenant-a", "tenant-a", "d1", "d2"),
  );
  assert.doesNotThrow(() =>
    assertTenantDeviceScope("tenant-a", "tenant-a", "d1", "d1"),
  );

  // POLICY-011 No auth token exposure
  console.log("POLICY-011 no auth token exposure");
  assert.doesNotThrow(() =>
    assertNoAuthTokenExposure({ presentation: "AUTO", cursor: "HIDDEN" }),
  );
  assert.throws(() =>
    assertNoAuthTokenExposure({ deviceToken: "secret" }),
  );
  assert.throws(() =>
    assertNoAuthTokenExposure({ note: "Bearer abc.def.ghi" }),
  );

  // POLICY-012 React/Legacy contract consistency (documented constants)
  console.log("POLICY-012 React/Legacy contract consistency");
  assert.equal(PLAYER_RUNTIME, "PASSIVE");
  assert.equal(getPassiveRuntimeCapabilities().runtime, "PASSIVE");
  assert.equal(getPassiveRuntimeCapabilities().touchNavigation, false);
  assert.equal(getInteractiveRuntimeCapabilities().runtime, "INTERACTIVE");
  // Cursor idle timeout shared intent (React player-app + tv.js both 3000)
  assert.equal(CURSOR_IDLE_MS, 3000);
  // Naming collision must remain intentional: product flavour ≠ detected caps
  const flavour = getPassiveRuntimeCapabilities();
  assert.ok(!("fullscreen" in flavour));
  assert.ok("fullscreen" in UNKNOWN_CAPABILITIES);

  // Fragile TV: fullscreen request falls back without Hisense-specific branch inventing support
  const fragile = resolveRuntimePolicy({
    tenantId: "t1",
    deviceId: "d1",
    policy: { ...DEFAULT_DOMAIN_RUNTIME_POLICY, presentation: "FULLSCREEN" },
    capabilities: { ...UNKNOWN_CAPABILITIES, fullscreen: true },
    environment: { fragileSmartTv: true },
  });
  assert.equal(fragile.presentation, "WINDOWED");

  const remotePolicy: DomainRuntimePolicy = {
    ...DEFAULT_DOMAIN_RUNTIME_POLICY,
    input: ["REMOTE", "TOUCH"],
  };
  const remoteResolved = resolveRuntimePolicy({
    tenantId: "t1",
    deviceId: "d1",
    policy: remotePolicy,
    capabilities: { ...UNKNOWN_CAPABILITIES, remote: false, touch: true },
  });
  assert.ok(remoteResolved.input.includes("KEYBOARD_LIKE"));
  assert.ok(!remoteResolved.input.includes("REMOTE"));

  console.log("PASS RUNTIME-POLICY-01");
}

main();

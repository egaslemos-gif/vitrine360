/**
 * RUNTIME-POLICY-04 — Policy resolution wiring tests
 * Run: npm run test:runtime-policy-04
 */
import assert from "node:assert/strict";
import {
  DEFAULT_DOMAIN_RUNTIME_POLICY,
  UNKNOWN_CAPABILITIES,
  assertNoAuthTokenExposure,
  assertTenantDeviceScope,
  defaultPolicyFromDeviceConfig,
  resolveRuntimePolicy,
  type DetectedRuntimeCapabilities,
  type DomainRuntimePolicy,
} from "../src/domain/runtime-policy";
import {
  buildRequestedPolicy,
  resolvePlayerRuntimePolicy,
  resolvedCursorPolicy,
} from "../src/player/runtime/resolve-policy";
import type { CapabilityProbeResult } from "../src/player/runtime/capabilities";

function caps(
  partial: Partial<DetectedRuntimeCapabilities>,
): DetectedRuntimeCapabilities {
  return { ...UNKNOWN_CAPABILITIES, ...partial };
}

function fakeProbe(
  c: Partial<DetectedRuntimeCapabilities>,
  env: Partial<CapabilityProbeResult["environment"]> = {},
): CapabilityProbeResult {
  return {
    capabilities: caps(c),
    environment: {
      userAgent: env.userAgent ?? "Test",
      fragileSmartTv: env.fragileSmartTv ?? false,
      secureContext: env.secureContext ?? true,
      language: env.language ?? "en",
    },
    probedAt: new Date().toISOString(),
    ok: true,
    error: null,
  };
}

function main() {
  console.log("RUNTIME-POLICY-04 resolution wiring");

  // POLICY-RESOLVE-001 Default policy
  console.log("POLICY-RESOLVE-001 default");
  const def = buildRequestedPolicy(null);
  assert.equal(def.cursor, DEFAULT_DOMAIN_RUNTIME_POLICY.cursor);
  assert.equal(def.interaction, "PASSIVE");
  // No Device enrichment → presentation AUTO (displayType must not force FULLSCREEN)
  assert.equal(def.presentation, "AUTO");

  // POLICY-RESOLVE-002 Explicit overrides
  console.log("POLICY-RESOLVE-002 explicit");
  const explicit: DomainRuntimePolicy = {
    ...DEFAULT_DOMAIN_RUNTIME_POLICY,
    presentation: "WINDOWED",
    cursor: "VISIBLE",
  };
  const over = resolvePlayerRuntimePolicy({
    policy: explicit,
    probe: fakeProbe({ fullscreen: true }),
  });
  assert.equal(over.requested.presentation, "WINDOWED");
  assert.equal(over.resolved.presentation, "WINDOWED");
  assert.equal(over.resolved.cursor, "VISIBLE");
  assert.equal(over.policySource, "EXPLICIT");

  // POLICY-RESOLVE-003 Fullscreen supported
  console.log("POLICY-RESOLVE-003 fullscreen supported");
  const fsOk = resolvePlayerRuntimePolicy({
    policy: { ...DEFAULT_DOMAIN_RUNTIME_POLICY, presentation: "FULLSCREEN" },
    probe: fakeProbe({ fullscreen: true }),
    userActivationAvailable: true,
  });
  assert.equal(fsOk.resolved.presentation, "FULLSCREEN");
  assert.equal(fsOk.fallbacks.length, 0);

  // POLICY-RESOLVE-004 Fullscreen unsupported → WINDOWED
  console.log("POLICY-RESOLVE-004 fullscreen unsupported");
  const fsNo = resolvePlayerRuntimePolicy({
    policy: { ...DEFAULT_DOMAIN_RUNTIME_POLICY, presentation: "FULLSCREEN" },
    probe: fakeProbe({ fullscreen: false }),
  });
  assert.equal(fsNo.resolved.presentation, "WINDOWED");
  assert.ok(fsNo.fallbacks.some((f) => f.field === "presentation"));

  // POLICY-RESOLVE-005 Orientation supported
  console.log("POLICY-RESOLVE-005 orientation supported");
  const orOk = resolveRuntimePolicy({
    tenantId: "t1",
    deviceId: "d1",
    policy: { ...DEFAULT_DOMAIN_RUNTIME_POLICY, orientation: "LANDSCAPE" },
    capabilities: caps({ orientation: true }),
  });
  assert.equal(orOk.orientation, "LANDSCAPE");

  // POLICY-RESOLVE-006 Orientation unsupported → AUTO
  console.log("POLICY-RESOLVE-006 orientation unsupported");
  const orNo = resolveRuntimePolicy({
    tenantId: "t1",
    deviceId: "d1",
    policy: { ...DEFAULT_DOMAIN_RUNTIME_POLICY, orientation: "PORTRAIT" },
    capabilities: caps({ orientation: false }),
  });
  assert.equal(orNo.orientation, "AUTO");
  assert.ok(orNo.fallbacks.some((f) => f.field === "orientation"));

  // POLICY-RESOLVE-007 / 008 Remote without capability → KEYBOARD_LIKE
  console.log("POLICY-RESOLVE-007/008 remote fallback");
  const rem = resolveRuntimePolicy({
    tenantId: "t1",
    deviceId: "d1",
    policy: {
      ...DEFAULT_DOMAIN_RUNTIME_POLICY,
      input: ["REMOTE", "TOUCH"],
    },
    capabilities: caps({ remote: false, touch: true }),
  });
  assert.ok(rem.input.includes("KEYBOARD_LIKE"));
  assert.ok(!rem.input.includes("REMOTE"));
  assert.ok(rem.diagnostics.some((d) => d.includes("KEYBOARD_LIKE")));

  // POLICY-RESOLVE-009 Cursor AUTO_HIDE
  console.log("POLICY-RESOLVE-009 cursor");
  const cur = resolvePlayerRuntimePolicy({
    probe: fakeProbe({}),
  });
  assert.equal(resolvedCursorPolicy(cur), "AUTO_HIDE");

  // POLICY-RESOLVE-010 Interaction PASSIVE
  console.log("POLICY-RESOLVE-010 PASSIVE");
  assert.equal(cur.resolved.interaction, "PASSIVE");

  // POLICY-RESOLVE-011 INTERACTIVE_NOT_IMPLEMENTED
  console.log("POLICY-RESOLVE-011 INTERACTIVE_NOT_IMPLEMENTED");
  const inter = resolveRuntimePolicy({
    tenantId: "t1",
    deviceId: "d1",
    policy: { ...DEFAULT_DOMAIN_RUNTIME_POLICY, interaction: "INTERACTIVE" },
    capabilities: caps({ touch: true, pointer: true }),
  });
  assert.ok(
    inter.diagnostics.some((d) => d.includes("INTERACTIVE_NOT_IMPLEMENTED")),
  );

  // POLICY-RESOLVE-012 fragileSmartTv
  console.log("POLICY-RESOLVE-012 fragileSmartTv");
  const frag = resolvePlayerRuntimePolicy({
    policy: { ...DEFAULT_DOMAIN_RUNTIME_POLICY, presentation: "FULLSCREEN" },
    probe: fakeProbe(
      { fullscreen: true },
      { fragileSmartTv: true, userAgent: "Hisense VIDAA Sraf" },
    ),
  });
  assert.equal(frag.resolved.presentation, "WINDOWED");
  assert.equal(frag.environment.fragileSmartTv, true);

  // POLICY-RESOLVE-013 secure context
  console.log("POLICY-RESOLVE-013 secureContext");
  const sec = resolvePlayerRuntimePolicy({
    probe: fakeProbe({}, { secureContext: true }),
  });
  assert.equal(sec.environment.secureContext, true);

  // POLICY-RESOLVE-014 Fallback diagnostics
  console.log("POLICY-RESOLVE-014 diagnostics");
  assert.ok(fsNo.diagnostics.length > 0);
  assert.ok(fsNo.fallbacks[0]?.reason);

  // POLICY-RESOLVE-015 No token exposure
  console.log("POLICY-RESOLVE-015 no tokens");
  assert.doesNotThrow(() =>
    assertNoAuthTokenExposure(
      cur.resolved as unknown as Record<string, unknown>,
    ),
  );

  // POLICY-RESOLVE-016 Tenant/device scope
  console.log("POLICY-RESOLVE-016 scope");
  assert.throws(() =>
    assertTenantDeviceScope("a", "b", "d1", "d1"),
  );
  assert.doesNotThrow(() =>
    assertTenantDeviceScope("a", "a", "d1", "d1"),
  );
  const scoped = resolvePlayerRuntimePolicy({
    device: { tenantId: "tenant-x", deviceId: "dev-y" },
    probe: fakeProbe({}),
  });
  assert.equal(scoped.tenantId, "tenant-x");
  assert.equal(scoped.deviceId, "dev-y");

  // Device-derived defaults path
  const fromTouch = defaultPolicyFromDeviceConfig({
    displayType: "TOUCH_DISPLAY",
    interactionMode: "TOUCH",
    orientationStored: "portrait",
  });
  assert.equal(fromTouch.interaction, "INTERACTIVE");
  assert.equal(fromTouch.orientation, "PORTRAIT");

  console.log("PASS RUNTIME-POLICY-04");
}

main();

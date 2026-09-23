/**
 * RUNTIME-POLICY-05 — Device config → DomainRuntimePolicy enrichment.
 * Run: npm run test:runtime-policy-05
 */
import assert from "node:assert/strict";
import {
  DEFAULT_DOMAIN_RUNTIME_POLICY,
  UNKNOWN_CAPABILITIES,
  assertNoAuthTokenExposure,
  assertTenantDeviceScope,
  defaultPolicyFromDeviceConfig,
  orientationStoredToPolicy,
  toDevicePolicyConfigWire,
  type DomainRuntimePolicy,
} from "../src/domain/runtime-policy";
import {
  buildRequestedPolicy,
  resolvePlayerRuntimePolicy,
  resolvePolicySource,
} from "../src/player/runtime/resolve-policy";
import {
  localConfigToDevicePolicyInput,
  withServerDeviceConfig,
} from "../src/player/runtime/device-config";
import type { LocalConfig } from "../src/player/cache/indexed-db";
import type { CapabilityProbeResult } from "../src/player/runtime/capabilities";

function probe(
  caps: Partial<CapabilityProbeResult["capabilities"]> = {},
): CapabilityProbeResult {
  return {
    capabilities: { ...UNKNOWN_CAPABILITIES, fullscreen: true, orientation: true, ...caps },
    environment: {
      userAgent: "test",
      fragileSmartTv: false,
      secureContext: true,
      language: "pt",
    },
    probedAt: new Date().toISOString(),
    ok: true,
    error: null,
  };
}

function main() {
  console.log("RUNTIME-POLICY-05 device enrichment");

  // DEVICE-POLICY-001 PASSIVE → PASSIVE
  console.log("DEVICE-POLICY-001 PASSIVE");
  const passive = defaultPolicyFromDeviceConfig({
    displayType: "TV",
    interactionMode: "PASSIVE",
    orientationStored: "landscape",
  });
  assert.equal(passive.interaction, "PASSIVE");
  assert.equal(passive.cursor, "AUTO_HIDE");

  // DEVICE-POLICY-002 LANDSCAPE
  console.log("DEVICE-POLICY-002 orientation LANDSCAPE");
  assert.equal(orientationStoredToPolicy("landscape"), "LANDSCAPE");
  assert.equal(orientationStoredToPolicy("LANDSCAPE"), "LANDSCAPE");
  assert.equal(
    defaultPolicyFromDeviceConfig({
      displayType: "LED",
      interactionMode: "PASSIVE",
      orientationStored: "landscape",
    }).orientation,
    "LANDSCAPE",
  );

  // DEVICE-POLICY-003 PORTRAIT
  console.log("DEVICE-POLICY-003 orientation PORTRAIT");
  assert.equal(
    defaultPolicyFromDeviceConfig({
      displayType: "TABLET",
      interactionMode: "PASSIVE",
      orientationStored: "portrait",
    }).orientation,
    "PORTRAIT",
  );

  // DEVICE-POLICY-004 AUTO
  console.log("DEVICE-POLICY-004 orientation AUTO");
  assert.equal(orientationStoredToPolicy("auto"), "AUTO");
  assert.equal(orientationStoredToPolicy("unknown"), "AUTO");
  assert.equal(
    defaultPolicyFromDeviceConfig({
      displayType: "OTHER",
      interactionMode: "PASSIVE",
      orientationStored: "auto",
    }).orientation,
    "AUTO",
  );

  // DEVICE-POLICY-005 TOUCH → INTERACTIVE policy + diagnostic
  console.log("DEVICE-POLICY-005 TOUCH");
  const touch = resolvePlayerRuntimePolicy({
    device: {
      tenantId: "t1",
      deviceId: "d1",
      displayType: "TOUCH_DISPLAY",
      interactionMode: "TOUCH",
      orientationStored: "landscape",
      hasDevicePolicy: true,
    },
    probe: probe({ touch: true }),
  });
  assert.equal(touch.requested.interaction, "INTERACTIVE");
  assert.equal(touch.resolved.interaction, "INTERACTIVE");
  assert.ok(
    touch.diagnostics.some((d) => d.includes("INTERACTIVE_NOT_IMPLEMENTED")),
  );
  assert.equal(touch.policySource, "DEVICE_CONFIG");

  // DEVICE-POLICY-006 HYBRID
  console.log("DEVICE-POLICY-006 HYBRID");
  const hybrid = defaultPolicyFromDeviceConfig({
    displayType: "KIOSK",
    interactionMode: "HYBRID",
    orientationStored: "landscape",
  });
  assert.equal(hybrid.interaction, "INTERACTIVE");
  const hybridR = resolvePlayerRuntimePolicy({
    device: {
      tenantId: "t1",
      deviceId: "d2",
      displayType: "KIOSK",
      interactionMode: "HYBRID",
      orientationStored: "landscape",
      hasDevicePolicy: true,
    },
    probe: probe(),
  });
  assert.ok(
    hybridR.diagnostics.some((d) => d.includes("INTERACTIVE_NOT_IMPLEMENTED")),
  );

  // DEVICE-POLICY-007 TV does not imply fullscreen
  console.log("DEVICE-POLICY-007 TV ↛ FULLSCREEN");
  assert.equal(passive.presentation, "AUTO");
  const tvBundle = resolvePlayerRuntimePolicy({
    device: {
      tenantId: "t1",
      deviceId: "d-tv",
      displayType: "TV",
      interactionMode: "PASSIVE",
      orientationStored: "landscape",
      hasDevicePolicy: true,
    },
    probe: probe({ fullscreen: true }),
  });
  assert.equal(tvBundle.requested.presentation, "AUTO");

  // DEVICE-POLICY-008 displayType does not alter policy unexpectedly
  console.log("DEVICE-POLICY-008 displayType neutral");
  for (const dt of [
    "TV",
    "TOUCH_DISPLAY",
    "LED",
    "KIOSK",
    "VIDEO_WALL",
    "TABLET",
    "OTHER",
  ] as const) {
    const p = defaultPolicyFromDeviceConfig({
      displayType: dt,
      interactionMode: "PASSIVE",
      orientationStored: "landscape",
    });
    assert.equal(p.presentation, "AUTO", dt);
    assert.equal(p.interaction, "PASSIVE", dt);
    assert.equal(p.cursor, "AUTO_HIDE", dt);
  }

  // DEVICE-POLICY-009 timezone remains separate
  console.log("DEVICE-POLICY-009 timezone separate");
  const withTz = resolvePlayerRuntimePolicy({
    device: {
      tenantId: "t1",
      deviceId: "d3",
      displayType: "TV",
      interactionMode: "PASSIVE",
      orientationStored: "landscape",
      timezone: "Africa/Maputo",
      hasDevicePolicy: true,
    },
    probe: probe(),
  });
  assert.equal(
    (withTz.requested as DomainRuntimePolicy & { timezone?: string }).timezone,
    undefined,
  );
  assert.ok(!JSON.stringify(withTz.requested).includes("Africa/Maputo"));
  assert.ok(!JSON.stringify(withTz.resolved).includes("Africa/Maputo"));

  // DEVICE-POLICY-010 policySource
  console.log("DEVICE-POLICY-010 policySource");
  assert.equal(resolvePolicySource({}), "DEFAULT");
  assert.equal(
    resolvePolicySource({
      device: { hasDevicePolicy: true, displayType: "TV" },
    }),
    "DEVICE_CONFIG",
  );
  assert.equal(
    resolvePolicySource({
      explicitPolicy: DEFAULT_DOMAIN_RUNTIME_POLICY,
    }),
    "EXPLICIT",
  );
  assert.equal(buildRequestedPolicy(null).presentation, "AUTO");
  assert.equal(
    resolvePlayerRuntimePolicy({ probe: probe() }).policySource,
    "DEFAULT",
  );

  // DEVICE-POLICY-011 tenant isolation
  console.log("DEVICE-POLICY-011 tenant isolation");
  assert.throws(() =>
    assertTenantDeviceScope("tenant-a", "tenant-b", "d1", "d1"),
  );
  const scoped = resolvePlayerRuntimePolicy({
    device: {
      tenantId: "tenant-a",
      deviceId: "dev-1",
      hasDevicePolicy: true,
      displayType: "TV",
      interactionMode: "PASSIVE",
      orientationStored: "landscape",
    },
    probe: probe(),
  });
  assert.equal(scoped.tenantId, "tenant-a");
  assert.equal(scoped.deviceId, "dev-1");

  // DEVICE-POLICY-012 device isolation on merge
  console.log("DEVICE-POLICY-012 device isolation");
  const cfgA: LocalConfig = {
    deviceId: "device-a",
    deviceToken: "tok",
    tenantId: "tenant-a",
  };
  const rejected = withServerDeviceConfig(cfgA, {
    tenantId: "tenant-a",
    deviceId: "device-b",
    displayType: "TV",
    interactionMode: "PASSIVE",
    orientation: "portrait",
    timezone: null,
    status: "ACTIVE",
  });
  assert.equal(rejected.hasDevicePolicy, undefined);
  assert.equal(rejected.orientation, undefined);

  const accepted = withServerDeviceConfig(cfgA, {
    tenantId: "tenant-a",
    deviceId: "device-a",
    displayType: "TOUCH_DISPLAY",
    interactionMode: "TOUCH",
    orientation: "portrait",
    timezone: "UTC",
    status: "ACTIVE",
  });
  assert.equal(accepted.hasDevicePolicy, true);
  assert.equal(accepted.orientation, "portrait");
  assert.equal(accepted.displayType, "TOUCH_DISPLAY");

  // DEVICE-POLICY-013 local/server consistency
  console.log("DEVICE-POLICY-013 local/server consistency");
  const wire = toDevicePolicyConfigWire({
    id: "device-a",
    tenantId: "tenant-a",
    displayType: "TV",
    interactionMode: "PASSIVE",
    orientation: "landscape",
    timezone: "Africa/Maputo",
    status: "ACTIVE",
  });
  const local = withServerDeviceConfig(cfgA, wire);
  const input = localConfigToDevicePolicyInput(local);
  assert.equal(input.hasDevicePolicy, true);
  assert.equal(input.displayType, "TV");
  assert.equal(input.interactionMode, "PASSIVE");
  assert.equal(input.orientationStored, "landscape");
  assert.equal(input.timezone, "Africa/Maputo");
  const fromLocal = buildRequestedPolicy(input);
  assert.equal(fromLocal.presentation, "AUTO");
  assert.equal(fromLocal.orientation, "LANDSCAPE");
  assert.equal(fromLocal.interaction, "PASSIVE");
  assert.deepEqual(
    fromLocal,
    defaultPolicyFromDeviceConfig({
      displayType: "TV",
      interactionMode: "PASSIVE",
      orientationStored: "landscape",
    }),
  );

  // Security: no token exposure in wire / policy
  assertNoAuthTokenExposure(
    wire as unknown as Record<string, unknown>,
  );
  assertNoAuthTokenExposure(
    fromLocal as unknown as Record<string, unknown>,
  );
  assert.ok(!("deviceToken" in wire));

  // Input default includes KEYBOARD_LIKE
  assert.ok(fromLocal.input.includes("KEYBOARD_LIKE"));

  console.log("PASS RUNTIME-POLICY-05");
}

main();

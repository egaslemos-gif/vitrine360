/**
 * RUNTIME-POLICY-04/05 — Wire resolveRuntimePolicy into the Player Runtime.
 *
 * Single source of truth: domain resolveRuntimePolicy().
 * Applies only behaviours already supported (cursor). Does NOT call
 * requestFullscreen / orientation.lock / Interactive Runtime.
 */

import {
  DEFAULT_DOMAIN_RUNTIME_POLICY,
  assertNoAuthTokenExposure,
  assertTenantDeviceScope,
  defaultPolicyFromDeviceConfig,
  resolveRuntimePolicy,
  type CursorPolicy,
  type DeviceConfigurationSlice,
  type DomainRuntimePolicy,
  type ResolvedRuntimePolicy,
  type RuntimePolicySource,
} from "@/domain/runtime-policy";
import {
  probeRuntimeCapabilities,
  type CapabilityProbeResult,
  type RuntimeEnvironmentMeta,
} from "@/player/runtime/capabilities";

export const RUNTIME_POLICY_GLOBAL_KEY = "__v360_runtime_policy";

export type DeviceConfigForPolicy = {
  tenantId?: string | null;
  deviceId?: string | null;
  displayType?: DeviceConfigurationSlice["displayType"];
  interactionMode?: DeviceConfigurationSlice["interactionMode"];
  orientationStored?: string;
  status?: string;
  /** Device timezone — not mapped into DomainRuntimePolicy. */
  timezone?: string | null;
  /** True when fields came from server Device row. */
  hasDevicePolicy?: boolean;
};

export type RuntimePolicyBundle = {
  requested: DomainRuntimePolicy;
  resolved: ResolvedRuntimePolicy;
  capabilities: CapabilityProbeResult["capabilities"];
  environment: RuntimeEnvironmentMeta & {
    userActivationAvailable?: boolean;
  };
  fallbacks: ResolvedRuntimePolicy["fallbacks"];
  diagnostics: string[];
  policySource: RuntimePolicySource;
  deviceId: string;
  tenantId: string;
  resolvedAt: string;
  ok: boolean;
  error: string | null;
};

function deviceHasPolicyFields(
  device?: DeviceConfigForPolicy | null,
): boolean {
  return Boolean(
    device?.hasDevicePolicy === true ||
      (device &&
        (device.displayType != null ||
          device.interactionMode != null ||
          device.orientationStored != null)),
  );
}

/**
 * Build DomainRuntimePolicy from optional Device config (no DeviceRuntimeConfig table).
 * Without server Device fields → DEFAULT_DOMAIN_RUNTIME_POLICY (presentation AUTO).
 */
export function buildRequestedPolicy(
  device?: DeviceConfigForPolicy | null,
): DomainRuntimePolicy {
  if (!deviceHasPolicyFields(device)) {
    return { ...DEFAULT_DOMAIN_RUNTIME_POLICY };
  }
  return defaultPolicyFromDeviceConfig({
    displayType: device!.displayType ?? "TV",
    interactionMode: device!.interactionMode ?? "PASSIVE",
    orientationStored: device!.orientationStored ?? "auto",
  });
}

export function resolvePolicySource(params: {
  explicitPolicy?: DomainRuntimePolicy | null;
  device?: DeviceConfigForPolicy | null;
}): RuntimePolicySource {
  if (params.explicitPolicy) return "EXPLICIT";
  if (deviceHasPolicyFields(params.device)) return "DEVICE_CONFIG";
  return "DEFAULT";
}

/**
 * Resolve runtime policy from device config + live capability probe.
 * Non-throwing for Player boot safety.
 */
export function resolvePlayerRuntimePolicy(params?: {
  device?: DeviceConfigForPolicy | null;
  /** Override probe (tests / E2E simulation). */
  probe?: CapabilityProbeResult;
  /** Explicit policy override (tests). */
  policy?: DomainRuntimePolicy;
  userActivationAvailable?: boolean;
}): RuntimePolicyBundle {
  const resolvedAt = new Date().toISOString();
  const policySource = resolvePolicySource({
    explicitPolicy: params?.policy,
    device: params?.device,
  });
  try {
    const probed = params?.probe ?? probeRuntimeCapabilities();
    const device = params?.device ?? null;
    const tenantId = device?.tenantId?.trim() || "local";
    const deviceId = device?.deviceId?.trim() || "unpaired";

    assertTenantDeviceScope(tenantId, tenantId, deviceId, deviceId);

    const requested = params?.policy ?? buildRequestedPolicy(device);

    assertNoAuthTokenExposure(
      requested as unknown as Record<string, unknown>,
    );

    const environment = {
      ...probed.environment,
      userActivationAvailable: params?.userActivationAvailable,
    };

    const resolved = resolveRuntimePolicy({
      tenantId,
      deviceId,
      policy: requested,
      capabilities: probed.capabilities,
      environment: {
        fragileSmartTv: probed.environment.fragileSmartTv,
        userActivationAvailable: params?.userActivationAvailable,
      },
    });

    const diagnostics = [
      `policySource: ${policySource}`,
      ...resolved.diagnostics,
    ];

    // Timezone stays on Device config only — never on DomainRuntimePolicy.
    void device?.timezone;

    assertNoAuthTokenExposure(
      resolved as unknown as Record<string, unknown>,
    );
    assertNoAuthTokenExposure({
      policySource,
      diagnostics,
    } as unknown as Record<string, unknown>);

    return {
      requested,
      resolved,
      capabilities: probed.capabilities,
      environment,
      fallbacks: resolved.fallbacks,
      diagnostics,
      policySource,
      deviceId,
      tenantId,
      resolvedAt,
      ok: true,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const fallbackResolved: ResolvedRuntimePolicy = {
      tenantId: "local",
      deviceId: "unpaired",
      ...DEFAULT_DOMAIN_RUNTIME_POLICY,
      presentation: "WINDOWED",
      fallbacks: [],
      diagnostics: [
        `policySource: ${policySource}`,
        `resolvePlayerRuntimePolicy failed: ${message.slice(0, 160)}`,
      ],
    };
    return {
      requested: DEFAULT_DOMAIN_RUNTIME_POLICY,
      resolved: fallbackResolved,
      capabilities: probeRuntimeCapabilities().capabilities,
      environment: {
        userAgent: "",
        fragileSmartTv: false,
        secureContext: false,
        language: "",
      },
      fallbacks: [],
      diagnostics: fallbackResolved.diagnostics,
      policySource,
      deviceId: "unpaired",
      tenantId: "local",
      resolvedAt,
      ok: false,
      error: message.slice(0, 200),
    };
  }
}

export function resolvedCursorPolicy(
  bundle: RuntimePolicyBundle,
): CursorPolicy {
  return bundle.resolved.cursor;
}

export function formatPolicyDiagnostics(bundle: {
  requested: DomainRuntimePolicy;
  resolved: Pick<
    ResolvedRuntimePolicy,
    "presentation" | "cursor" | "orientation" | "interaction"
  >;
  fallbacks: ResolvedRuntimePolicy["fallbacks"];
  policySource?: RuntimePolicySource;
}): string {
  const lines = [
    bundle.policySource ? `source ${bundle.policySource}` : null,
    `presentation ${bundle.requested.presentation}→${bundle.resolved.presentation}`,
    `cursor ${bundle.resolved.cursor}`,
    `orientation ${bundle.requested.orientation}→${bundle.resolved.orientation}`,
    `interaction ${bundle.resolved.interaction}`,
  ].filter(Boolean) as string[];
  if (bundle.fallbacks.length) {
    lines.push(
      `fallbacks:${bundle.fallbacks.map((f) => `${f.requested}→${f.resolved}`).join(",")}`,
    );
  }
  return lines.join(" · ");
}

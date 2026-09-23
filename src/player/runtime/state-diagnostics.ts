/**
 * RUNTIME-POLICY-06 / 08A / 08B — Publish Requested / Resolved / Actual snapshot.
 */

import {
  assertNoAuthTokenExposure,
  diagnosePolicyVsActual,
  type DomainRuntimePolicy,
  type ResolvedRuntimePolicy,
  type RuntimePolicyActualDiagnostic,
  type RuntimePolicySource,
  type RuntimeStateContract,
} from "@/domain/runtime-policy";
import { getFullscreenController } from "@/player/runtime/fullscreen";
import { getOrientationController } from "@/player/runtime/orientation";
import {
  RUNTIME_STATE_GLOBAL_KEY,
  getRuntimeState,
  runtimeStateForHeartbeat,
} from "@/player/runtime/state";
import type { RuntimePolicyBundle } from "@/player/runtime/resolve-policy";

export type RuntimePolicyRuntimeSnapshot = {
  requested: Pick<
    DomainRuntimePolicy,
    "presentation" | "cursor" | "input" | "interaction" | "orientation"
  >;
  resolved: Pick<
    ResolvedRuntimePolicy,
    "presentation" | "cursor" | "input" | "interaction" | "orientation"
  >;
  actual: {
    fullscreenActive: boolean;
    cursorVisible: boolean;
    orientation: RuntimeStateContract["orientationActual"];
    isPlaying: boolean;
  };
  policySource: RuntimePolicySource | null;
  capabilities: RuntimePolicyBundle["capabilities"] | null;
  fallbacks: ResolvedRuntimePolicy["fallbacks"];
  diagnostics: string[];
  policyActualDiagnostics: RuntimePolicyActualDiagnostic[];
  state: RuntimeStateContract;
  updatedAt: number;
};

function controllerDiagnostics(
  prefix: "FULLSCREEN_" | "ORIENTATION_",
  code: string | null,
): RuntimePolicyActualDiagnostic[] {
  if (!code || !code.startsWith(prefix)) return [];
  const severity: "INFO" | "WARNING" =
    code.includes("UNAVAILABLE") ||
    code.includes("FAILED") ||
    code.includes("NOT_ALLOWED") ||
    code.includes("MISMATCH")
      ? "WARNING"
      : "INFO";
  // REQUIRES_FULLSCREEN is INFO
  const sev: "INFO" | "WARNING" =
    code === "ORIENTATION_REQUIRES_FULLSCREEN" ? "INFO" : severity;
  return [
    {
      code,
      severity: sev,
      message: code.replace(/_/g, " ").toLowerCase(),
    },
  ];
}

export function buildRuntimePolicyRuntimeSnapshot(params: {
  requested?: DomainRuntimePolicy | null;
  resolved?: Pick<
    ResolvedRuntimePolicy,
    "presentation" | "cursor" | "input" | "interaction" | "orientation"
  > | null;
  policySource?: RuntimePolicySource | null;
  capabilities?: RuntimePolicyBundle["capabilities"] | null;
  fallbacks?: ResolvedRuntimePolicy["fallbacks"];
  diagnostics?: string[];
  state?: RuntimeStateContract;
}): RuntimePolicyRuntimeSnapshot {
  const state = params.state ?? getRuntimeState();
  const requested = params.requested ?? {
    presentation: "AUTO" as const,
    cursor: "AUTO_HIDE" as const,
    input: ["KEYBOARD_LIKE" as const, "MOUSE" as const, "TOUCH" as const],
    interaction: "PASSIVE" as const,
    orientation: "AUTO" as const,
  };
  const resolved = params.resolved ?? requested;
  const fs = getFullscreenController();
  const orient = getOrientationController();
  const policyActualDiagnostics = [
    ...diagnosePolicyVsActual({
      resolvedPresentation: resolved.presentation,
      resolvedOrientation: resolved.orientation,
      fullscreenActive: state.fullscreenActive,
      orientationActual: state.orientationActual,
      fullscreenReason: fs?.notActiveReason() ?? null,
    }),
    ...controllerDiagnostics(
      "FULLSCREEN_",
      fs?.snapshot().lastDiagnosticCode ?? state.fullscreenDiagnosticCode,
    ),
    ...controllerDiagnostics(
      "ORIENTATION_",
      orient?.snapshot().lastDiagnosticCode ??
        state.orientationDiagnosticCode,
    ),
  ];

  const byCode = new Map<string, RuntimePolicyActualDiagnostic>();
  for (const d of policyActualDiagnostics) {
    if (!byCode.has(d.code)) byCode.set(d.code, d);
  }

  const snap: RuntimePolicyRuntimeSnapshot = {
    requested: {
      presentation: requested.presentation,
      cursor: requested.cursor,
      input: requested.input,
      interaction: requested.interaction,
      orientation: requested.orientation,
    },
    resolved: {
      presentation: resolved.presentation,
      cursor: resolved.cursor,
      input: resolved.input,
      interaction: resolved.interaction,
      orientation: resolved.orientation,
    },
    actual: {
      fullscreenActive: state.fullscreenActive,
      cursorVisible: state.cursorVisible,
      orientation: state.orientationActual,
      isPlaying: state.isPlaying,
    },
    policySource: params.policySource ?? null,
    capabilities: params.capabilities ?? null,
    fallbacks: params.fallbacks ?? [],
    diagnostics: params.diagnostics ?? [],
    policyActualDiagnostics: [...byCode.values()],
    state,
    updatedAt: state.updatedAt,
  };

  assertNoAuthTokenExposure(snap as unknown as Record<string, unknown>);
  return snap;
}

/** Publish window.__v360_runtime_state from last policy + live state. */
export function publishRuntimeStateGlobal(params: {
  requested?: DomainRuntimePolicy | null;
  resolved?: Pick<
    ResolvedRuntimePolicy,
    "presentation" | "cursor" | "input" | "interaction" | "orientation"
  > | null;
  policySource?: RuntimePolicySource | null;
  capabilities?: RuntimePolicyBundle["capabilities"] | null;
  fallbacks?: ResolvedRuntimePolicy["fallbacks"];
  diagnostics?: string[];
  tenantId?: string;
  deviceId?: string;
}): RuntimePolicyRuntimeSnapshot {
  const snap = buildRuntimePolicyRuntimeSnapshot(params);
  if (typeof window === "undefined") return snap;
  const fsSnap = getFullscreenController()?.snapshot();
  const orSnap = getOrientationController()?.snapshot();
  (window as unknown as Record<string, unknown>)[RUNTIME_STATE_GLOBAL_KEY] = {
    state: snap.state,
    policy: {
      requested: snap.requested,
      resolved: snap.resolved,
      policySource: snap.policySource,
    },
    actual: snap.actual,
    capabilities: snap.capabilities,
    fallbacks: snap.fallbacks,
    diagnostics: snap.diagnostics,
    policyActualDiagnostics: snap.policyActualDiagnostics,
    heartbeat: runtimeStateForHeartbeat(snap.state),
    tenantId: params.tenantId ?? null,
    deviceId: params.deviceId ?? null,
    updatedAt: snap.updatedAt,
    fullscreenApiCalled: Boolean(fsSnap && fsSnap.requestCount > 0),
    fullscreenControl: fsSnap
      ? {
          status: fsSnap.status,
          apiAvailable: fsSnap.apiAvailable,
          diagnosticCode: fsSnap.lastDiagnosticCode,
        }
      : null,
    orientationLockCalled: Boolean(orSnap && orSnap.lockCount > 0),
    orientationControl: orSnap
      ? {
          status: orSnap.status,
          lockAvailable: orSnap.lockAvailable,
          observationAvailable: orSnap.observationAvailable,
          diagnosticCode: orSnap.lastDiagnosticCode,
          locked: orSnap.locked,
          requiresFullscreen: orSnap.requiresFullscreen,
        }
      : null,
  };
  return snap;
}

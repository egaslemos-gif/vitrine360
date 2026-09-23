/**
 * RUNTIME-POLICY-07 — Device Runtime Observability (derived, not a new SSoT).
 *
 * Presence ≠ Runtime ≠ Policy. Never infer PLAYING from ONLINE.
 */

import {
  assertNoAuthTokenExposure,
  diagnosePolicyVsActual,
  type DomainRuntimePolicy,
  type RuntimeDiagnosticSeverity,
  type RuntimeNetworkState,
  type RuntimeOrientationActual,
  type RuntimePolicyActualDiagnostic,
  type RuntimePolicySource,
  type RuntimeSyncState,
  type InputClass,
} from "@/domain/runtime-policy";
import type { Presence } from "@/domain/types";

export type ObservabilityPresenceLabel = "ONLINE" | "INSTAVEL" | "OFFLINE";

export type DeviceRuntimeObservability = {
  presence: {
    status: Presence;
    /** UI label: AWAY → INSTAVEL */
    label: ObservabilityPresenceLabel;
    lastSeenAt: string | null;
    /** Browser-reported online vs heartbeat freshness — separate dimensions. */
    backendHeartbeat: "CONNECTED" | "NOT_RECENT";
  };
  runtime: {
    isPlaying: boolean;
    currentContentId: string | null;
    currentManifestVersion: number | null;
    syncState: RuntimeSyncState | string | null;
    networkState: RuntimeNetworkState | string | null;
    cursorVisible: boolean | null;
    fullscreenActive: boolean | null;
    fullscreenStatus: string | null;
    fullscreenDiagnosticCode: string | null;
    /** Derived control label for admin UI (POLICY-08A). */
    fullscreenControl:
      | "ACTIVE"
      | "AVAILABLE"
      | "REQUIRES USER ACTIVATION"
      | "UNAVAILABLE"
      | null;
    orientationActual: RuntimeOrientationActual | string | null;
    orientationStatus: string | null;
    orientationDiagnosticCode: string | null;
    /** Observation / lock capability summary. */
    orientationCapability: "OBSERVATION" | "LOCK" | "NONE" | null;
    orientationControl:
      | "AVAILABLE"
      | "REQUIRES FULLSCREEN"
      | "NOT ALLOWED"
      | "UNAVAILABLE"
      | "LOCKED"
      | null;
    lastInputAt: number | null;
    lastInputClass: InputClass | string | null;
    /** True when this is last reported (presence not ONLINE). */
    isLastReported: boolean;
  };
  policy: {
    policySource: RuntimePolicySource | string | null;
    requested: Partial<DomainRuntimePolicy> | null;
    resolved: Partial<DomainRuntimePolicy> | null;
  };
  actual: {
    fullscreenActive: boolean | null;
    orientationActual: RuntimeOrientationActual | string | null;
    cursorVisible: boolean | null;
    isPlaying: boolean | null;
  };
  content: {
    id: string | null;
    title: string | null;
    type: string | null;
    available: boolean;
  };
  diagnostics: RuntimePolicyActualDiagnostic[];
  diagnosticCounts: {
    errors: number;
    warnings: number;
    info: number;
  };
  /** ISO time of last runtime telemetry (from heartbeat / playerState). */
  observedAt: string | null;
  /** Human-oriented stale flag when telemetry older than freshness window. */
  stale: boolean;
  staleAgeMs: number | null;
};

export type PlayerStatePayload = {
  playlistId?: string | null;
  contentId?: string | null;
  state?: string | null;
  runtime?: string | null;
  runtimeState?: Record<string, unknown> | null;
  policy?: {
    policySource?: string | null;
    requested?: Partial<DomainRuntimePolicy> | null;
    resolved?: Partial<DomainRuntimePolicy> | null;
  } | null;
  diagnostics?: RuntimePolicyActualDiagnostic[] | string[] | null;
  observedAt?: string | null;
};

export function presenceToLabel(presence: Presence): ObservabilityPresenceLabel {
  if (presence === "AWAY") return "INSTAVEL";
  if (presence === "ONLINE") return "ONLINE";
  return "OFFLINE";
}

export function parsePlayerStatePayload(
  raw: string | null | undefined,
): PlayerStatePayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PlayerStatePayload;
    if (!parsed || typeof parsed !== "object") return null;
    assertNoAuthTokenExposure(parsed as unknown as Record<string, unknown>);
    return parsed;
  } catch {
    return null;
  }
}

function asBool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function sortDiagnostics(
  list: RuntimePolicyActualDiagnostic[],
): RuntimePolicyActualDiagnostic[] {
  const rank: Record<RuntimeDiagnosticSeverity, number> = {
    ERROR: 0,
    WARNING: 1,
    INFO: 2,
  };
  return [...list].sort((a, b) => rank[a.severity] - rank[b.severity]);
}

function normalizeDiagnostics(
  raw: PlayerStatePayload["diagnostics"],
  derived: RuntimePolicyActualDiagnostic[],
): RuntimePolicyActualDiagnostic[] {
  const fromPayload: RuntimePolicyActualDiagnostic[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "string") {
        fromPayload.push({
          code: item.slice(0, 80),
          severity: "INFO",
          message: item.slice(0, 200),
        });
      } else if (item && typeof item === "object" && "code" in item) {
        fromPayload.push({
          code: String(item.code).slice(0, 80),
          severity:
            item.severity === "ERROR" || item.severity === "WARNING"
              ? item.severity
              : "INFO",
          message: String(item.message ?? item.code).slice(0, 240),
        });
      }
    }
  }
  const byCode = new Map<string, RuntimePolicyActualDiagnostic>();
  for (const d of [...fromPayload, ...derived]) {
    if (!byCode.has(d.code)) byCode.set(d.code, d);
  }
  return sortDiagnostics([...byCode.values()]);
}

/**
 * Derive observability from existing Device row fields + optional content meta.
 * Does not mutate playback / policy / presence thresholds.
 */
export function deriveDeviceRuntimeObservability(params: {
  presence: Presence;
  lastSeenAt: string | null;
  playerStateRaw: string | null | undefined;
  manifestVersion?: number | null;
  contentMeta?: { id: string; title: string | null; type: string | null } | null;
  /** When telemetry age exceeds this, mark stale (default 3 min = online window). */
  staleAfterMs?: number;
  now?: number;
}): DeviceRuntimeObservability {
  const now = params.now ?? Date.now();
  const staleAfterMs =
    params.staleAfterMs ?? 3 * 60 * 1000;
  const payload = parsePlayerStatePayload(params.playerStateRaw);
  const rs = (payload?.runtimeState ?? {}) as Record<string, unknown>;

  const observedAt =
    (typeof payload?.observedAt === "string" && payload.observedAt) ||
    params.lastSeenAt ||
    null;
  const observedMs = observedAt ? Date.parse(observedAt) : NaN;
  const staleAgeMs = Number.isFinite(observedMs)
    ? Math.max(0, now - observedMs)
    : null;
  const stale =
    staleAgeMs == null ? Boolean(params.lastSeenAt) === false : staleAgeMs > staleAfterMs;

  const isPlaying =
    asBool(rs.isPlaying) ??
    (payload?.state === "PLAYING"
      ? true
      : payload?.state === "IDLE"
        ? false
        : false);

  const currentContentId =
    (typeof rs.currentContentId === "string" ? rs.currentContentId : null) ??
    (typeof payload?.contentId === "string" ? payload.contentId : null);

  const currentManifestVersion =
    typeof rs.currentManifestVersion === "number"
      ? rs.currentManifestVersion
      : params.manifestVersion ?? null;

  const fullscreenActive = asBool(rs.fullscreenActive);
  const fullscreenStatus =
    typeof rs.fullscreenStatus === "string" ? rs.fullscreenStatus : null;
  const fullscreenDiagnosticCode =
    typeof rs.fullscreenDiagnosticCode === "string"
      ? rs.fullscreenDiagnosticCode
      : rs.fullscreenDiagnosticCode === null
        ? null
        : null;
  const orientationActual =
    typeof rs.orientationActual === "string" ? rs.orientationActual : null;
  const orientationStatus =
    typeof rs.orientationStatus === "string" ? rs.orientationStatus : null;
  const orientationDiagnosticCode =
    typeof rs.orientationDiagnosticCode === "string"
      ? rs.orientationDiagnosticCode
      : null;
  const cursorVisible = asBool(rs.cursorVisible);

  const requested = payload?.policy?.requested ?? null;
  const resolved = payload?.policy?.resolved ?? null;

  const fullscreenReason =
    fullscreenDiagnosticCode === "FULLSCREEN_USER_ACTIVATION_REQUIRED"
      ? "user activation is required"
      : fullscreenDiagnosticCode === "FULLSCREEN_UNAVAILABLE"
        ? "Fullscreen API is unavailable"
        : fullscreenDiagnosticCode === "FULLSCREEN_REQUEST_FAILED"
          ? "the browser rejected the fullscreen request"
          : fullscreenActive
            ? null
            : "fullscreen has not been requested yet or is waiting for user activation";

  const fullscreenControl: DeviceRuntimeObservability["runtime"]["fullscreenControl"] =
    fullscreenActive
      ? "ACTIVE"
      : fullscreenStatus === "UNAVAILABLE" ||
          fullscreenDiagnosticCode === "FULLSCREEN_UNAVAILABLE"
        ? "UNAVAILABLE"
        : fullscreenDiagnosticCode === "FULLSCREEN_USER_ACTIVATION_REQUIRED"
          ? "REQUIRES USER ACTIVATION"
          : resolved?.presentation === "FULLSCREEN"
            ? "AVAILABLE"
            : null;

  const orientationCapability: DeviceRuntimeObservability["runtime"]["orientationCapability"] =
    orientationStatus === "UNAVAILABLE" &&
    orientationDiagnosticCode === "ORIENTATION_LOCK_UNAVAILABLE"
      ? "OBSERVATION"
      : orientationStatus === "LOCKED" ||
          orientationDiagnosticCode === "ORIENTATION_LOCK_ACTIVE"
        ? "LOCK"
        : orientationActual != null
          ? "OBSERVATION"
          : null;

  const orientationControl: DeviceRuntimeObservability["runtime"]["orientationControl"] =
    orientationStatus === "LOCKED"
      ? "LOCKED"
      : orientationDiagnosticCode === "ORIENTATION_REQUIRES_FULLSCREEN"
        ? "REQUIRES FULLSCREEN"
        : orientationDiagnosticCode === "ORIENTATION_LOCK_NOT_ALLOWED"
          ? "NOT ALLOWED"
          : orientationStatus === "UNAVAILABLE" ||
              orientationDiagnosticCode === "ORIENTATION_LOCK_UNAVAILABLE"
            ? "UNAVAILABLE"
            : resolved?.orientation === "LANDSCAPE" ||
                resolved?.orientation === "PORTRAIT"
              ? "AVAILABLE"
              : null;

  const derivedMismatch =
    resolved &&
    (resolved.presentation != null || resolved.orientation != null)
      ? diagnosePolicyVsActual({
          resolvedPresentation:
            (resolved.presentation as "FULLSCREEN" | "WINDOWED" | "AUTO") ??
            "AUTO",
          resolvedOrientation:
            (resolved.orientation as "LANDSCAPE" | "PORTRAIT" | "AUTO") ??
            "AUTO",
          fullscreenActive: fullscreenActive ?? false,
          orientationActual: (orientationActual as RuntimeOrientationActual) ??
            "UNKNOWN",
          fullscreenReason,
        })
      : [];

  const diagnostics = normalizeDiagnostics(
    payload?.diagnostics ?? null,
    derivedMismatch,
  );

  const contentId = currentContentId;
  const meta = params.contentMeta;
  const contentAvailable = Boolean(
    meta && contentId && meta.id === contentId,
  );

  const isLastReported = params.presence !== "ONLINE";

  const obs: DeviceRuntimeObservability = {
    presence: {
      status: params.presence,
      label: presenceToLabel(params.presence),
      lastSeenAt: params.lastSeenAt,
      backendHeartbeat:
        params.presence === "ONLINE" ? "CONNECTED" : "NOT_RECENT",
    },
    runtime: {
      isPlaying,
      currentContentId: contentId,
      currentManifestVersion,
      syncState:
        typeof rs.syncState === "string" ? rs.syncState : null,
      networkState:
        typeof rs.networkState === "string" ? rs.networkState : null,
      cursorVisible,
      fullscreenActive,
      fullscreenStatus,
      fullscreenDiagnosticCode,
      fullscreenControl,
      orientationActual,
      orientationStatus,
      orientationDiagnosticCode,
      orientationCapability,
      orientationControl,
      lastInputAt: typeof rs.lastInputAt === "number" ? rs.lastInputAt : null,
      lastInputClass:
        typeof rs.lastInputClass === "string" ? rs.lastInputClass : null,
      isLastReported,
    },
    policy: {
      policySource: payload?.policy?.policySource ?? null,
      requested,
      resolved,
    },
    actual: {
      fullscreenActive,
      orientationActual,
      cursorVisible,
      isPlaying,
    },
    content: {
      id: contentId,
      title: contentAvailable ? meta?.title ?? null : null,
      type: contentAvailable ? meta?.type ?? null : null,
      available: contentAvailable,
    },
    diagnostics,
    diagnosticCounts: {
      errors: diagnostics.filter((d) => d.severity === "ERROR").length,
      warnings: diagnostics.filter((d) => d.severity === "WARNING").length,
      info: diagnostics.filter((d) => d.severity === "INFO").length,
    },
    observedAt,
    stale,
    staleAgeMs,
  };

  assertNoAuthTokenExposure(obs as unknown as Record<string, unknown>);
  return obs;
}

/** Format relative age for UI (factual, no “health”). */
export function formatStaleAge(ms: number | null): string | null {
  if (ms == null) return null;
  if (ms < 1000) return "há <1 s";
  if (ms < 60_000) return `há ${Math.floor(ms / 1000)} s`;
  if (ms < 3_600_000) return `há ${Math.floor(ms / 60_000)} min`;
  return `há ${Math.floor(ms / 3_600_000)} h`;
}

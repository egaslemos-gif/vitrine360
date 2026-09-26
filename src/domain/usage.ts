/**
 * PLATFORM-IDENTITY-10F — Usage & Quota foundation (domain).
 *
 * Read-only / pure evaluation. No enforcement. No I/O in evaluateQuota.
 * Device count: PAIRED_NON_DISABLED (closed in PI-10 quota semantics).
 */

import type { EntitlementEnforcementType } from "@/domain/entitlements";

export const USAGE_SOURCES = [
  "DERIVED_RESOURCE",
  "DERIVED_STORAGE",
  "EVENT",
  "COUNTER",
] as const;
export type UsageSource = (typeof USAGE_SOURCES)[number];

export const USAGE_UNITS = ["COUNT", "BYTES"] as const;
export type UsageUnit = (typeof USAGE_UNITS)[number];

export const USAGE_METRIC_KEYS = [
  "devices.count",
  "contents.count",
  "playlists.count",
  "experiences.count",
  "storage.bytes",
] as const;
export type UsageMetricKey = (typeof USAGE_METRIC_KEYS)[number];

export function isUsageMetricKey(v: unknown): v is UsageMetricKey {
  return (
    typeof v === "string" &&
    (USAGE_METRIC_KEYS as readonly string[]).includes(v)
  );
}

/**
 * Device count modes for Usage.
 * Canonical production semantics: PAIRED_NON_DISABLED (PI-10 decision closure).
 * PROVISIONAL_* kept as alias for older tests / call sites.
 */
export const DEVICE_USAGE_COUNT_MODES = [
  "ALL_WITH_TENANT",
  "ACTIVE_ONLY",
  "PAIRED_NON_DISABLED",
  "PROVISIONAL_PAIRED_NON_DISABLED",
] as const;
export type DeviceUsageCountMode = (typeof DEVICE_USAGE_COUNT_MODES)[number];

/**
 * Closed decision: tenant_id set AND status != DISABLED.
 * See docs/PLATFORM-IDENTITY-10-QUOTA-SEMANTICS.md
 */
export const DEVICE_COUNT_MODE_CANONICAL: DeviceUsageCountMode =
  "PAIRED_NON_DISABLED";

/** @deprecated Use DEVICE_COUNT_MODE_CANONICAL — same SQL as PAIRED_NON_DISABLED. */
export const DEVICE_COUNT_MODE_PROVISIONAL: DeviceUsageCountMode =
  "PROVISIONAL_PAIRED_NON_DISABLED";

export type UsageSnapshot = {
  tenantId: string;
  metric: UsageMetricKey;
  value: number;
  unit: UsageUnit;
  source: UsageSource;
  resolvedAt: string;
  /** Present when metric uses provisional device semantics. */
  deviceCountMode?: DeviceUsageCountMode;
  semanticsNote?: string;
};

export type UsageResolveResult =
  | { status: "RESOLVED"; usage: UsageSnapshot }
  | {
      status: "TENANT_REQUIRED" | "UNKNOWN_METRIC" | "INVALID_TENANT";
      tenantId: string;
      metric?: string;
      message: string;
    };

export type QuotaEvaluateDecision =
  | "ALLOW"
  | "DENY"
  | "NEAR_LIMIT"
  | "EXCEEDED"
  | "INVALID";

export type QuotaEvaluateResult = {
  decision: QuotaEvaluateDecision;
  enforcementType: EntitlementEnforcementType;
  usage: number;
  limit: number;
  /** True when decision would block new allocation under HARD_LIMIT. */
  blocksAllocation: boolean;
  message: string;
};

/**
 * Pure quota evaluation. No DB, no TenantPlan, no mutation.
 *
 * HARD_LIMIT: usage < limit → ALLOW; usage >= limit → DENY (blocksAllocation).
 * SOFT_LIMIT: never blocks; NEAR_LIMIT when usage >= 80% of limit; EXCEEDED when usage >= limit.
 * FEATURE_GATE: not quantitative — INVALID if used here (use evaluateFeatureGate).
 */
export function evaluateQuota(input: {
  usage: number;
  limit: number;
  enforcementType: EntitlementEnforcementType;
  /** Optional soft near-limit ratio (0–1). Default 0.8. Not commercial policy. */
  nearLimitRatio?: number;
}): QuotaEvaluateResult {
  const { usage, limit, enforcementType } = input;
  const nearRatio =
    typeof input.nearLimitRatio === "number" &&
    Number.isFinite(input.nearLimitRatio) &&
    input.nearLimitRatio > 0 &&
    input.nearLimitRatio < 1
      ? input.nearLimitRatio
      : 0.8;

  if (
    !Number.isFinite(usage) ||
    !Number.isFinite(limit) ||
    !Number.isInteger(usage) ||
    !Number.isInteger(limit) ||
    usage < 0 ||
    limit < 0
  ) {
    return {
      decision: "INVALID",
      enforcementType,
      usage,
      limit,
      blocksAllocation: true,
      message: "usage and limit must be finite non-negative integers",
    };
  }

  if (enforcementType === "FEATURE_GATE") {
    return {
      decision: "INVALID",
      enforcementType,
      usage,
      limit,
      blocksAllocation: false,
      message: "FEATURE_GATE is not quantitative; use evaluateFeatureGate",
    };
  }

  if (enforcementType === "HARD_LIMIT") {
    if (usage < limit) {
      return {
        decision: "ALLOW",
        enforcementType,
        usage,
        limit,
        blocksAllocation: false,
        message: "usage below hard limit",
      };
    }
    return {
      decision: "DENY",
      enforcementType,
      usage,
      limit,
      blocksAllocation: true,
      message: "usage at or above hard limit",
    };
  }

  // SOFT_LIMIT — advisory only; never blocks in PI-10F
  if (usage >= limit) {
    return {
      decision: "EXCEEDED",
      enforcementType,
      usage,
      limit,
      blocksAllocation: false,
      message: "soft limit exceeded (non-blocking)",
    };
  }
  if (limit > 0 && usage / limit >= nearRatio) {
    return {
      decision: "NEAR_LIMIT",
      enforcementType,
      usage,
      limit,
      blocksAllocation: false,
      message: "approaching soft limit (non-blocking)",
    };
  }
  return {
    decision: "ALLOW",
    enforcementType,
    usage,
    limit,
    blocksAllocation: false,
    message: "usage within soft limit",
  };
}

export function unitForMetric(metric: UsageMetricKey): UsageUnit {
  return metric === "storage.bytes" ? "BYTES" : "COUNT";
}

export function sourceForMetric(metric: UsageMetricKey): UsageSource {
  return metric === "storage.bytes" ? "DERIVED_STORAGE" : "DERIVED_RESOURCE";
}

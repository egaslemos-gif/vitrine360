/**
 * PLATFORM-IDENTITY-10B/10C — Entitlements domain types, value validation,
 * and EffectiveEntitlements assembly (PI-10C).
 *
 * No enforcement of quotas/features (deferred to PI-10D).
 */

export const ENTITLEMENT_VALUE_TYPES = ["BOOLEAN", "INTEGER", "BYTES"] as const;
export type EntitlementValueType = (typeof ENTITLEMENT_VALUE_TYPES)[number];

export const ENTITLEMENT_ENFORCEMENT_TYPES = [
  "FEATURE_GATE",
  "HARD_LIMIT",
  "SOFT_LIMIT",
] as const;
export type EntitlementEnforcementType =
  (typeof ENTITLEMENT_ENFORCEMENT_TYPES)[number];

export const TENANT_PLAN_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type TenantPlanStatus = (typeof TENANT_PLAN_STATUSES)[number];

/** Technical compatibility plan — not a commercial SKU. */
export const COMPATIBILITY_PLAN_KEY = "compatibility_default";

export type ParsedEntitlementValue =
  | { ok: true; valueType: "BOOLEAN"; value: boolean; stored: string }
  | { ok: true; valueType: "INTEGER"; value: number; stored: string }
  | { ok: true; valueType: "BYTES"; value: number; stored: string }
  | { ok: false; error: string };

export function isEntitlementValueType(
  v: unknown,
): v is EntitlementValueType {
  return (
    typeof v === "string" &&
    (ENTITLEMENT_VALUE_TYPES as readonly string[]).includes(v)
  );
}

export function isEntitlementEnforcementType(
  v: unknown,
): v is EntitlementEnforcementType {
  return (
    typeof v === "string" &&
    (ENTITLEMENT_ENFORCEMENT_TYPES as readonly string[]).includes(v)
  );
}

export function isTenantPlanStatus(v: unknown): v is TenantPlanStatus {
  return (
    typeof v === "string" &&
    (TENANT_PLAN_STATUSES as readonly string[]).includes(v)
  );
}

/** Stable key: lowercase letter start, then [a-z0-9._-] */
export function isValidEntitlementKey(key: unknown): key is string {
  // Allow dotted namespaces and camelCase segments (e.g. storage.maxBytes).
  return typeof key === "string" && /^[a-z][a-zA-Z0-9._-]{0,127}$/.test(key);
}

export function isValidPlanKey(key: unknown): key is string {
  return typeof key === "string" && /^[a-z][a-z0-9._-]{0,127}$/.test(key);
}

/**
 * Parse & validate a stored entitlement value against its valueType.
 * TEXT persistence is allowed; domain is authoritative.
 */
export function parseEntitlementValue(
  valueType: EntitlementValueType,
  raw: unknown,
): ParsedEntitlementValue {
  if (raw === null || raw === undefined) {
    return { ok: false, error: "value required" };
  }
  if (typeof raw === "object") {
    return { ok: false, error: "value must not be an object or array" };
  }

  if (valueType === "BOOLEAN") {
    if (typeof raw === "boolean") {
      return {
        ok: true,
        valueType: "BOOLEAN",
        value: raw,
        stored: raw ? "true" : "false",
      };
    }
    if (typeof raw === "string") {
      const n = raw.trim().toLowerCase();
      if (n === "true" || n === "1") {
        return { ok: true, valueType: "BOOLEAN", value: true, stored: "true" };
      }
      if (n === "false" || n === "0") {
        return {
          ok: true,
          valueType: "BOOLEAN",
          value: false,
          stored: "false",
        };
      }
    }
    if (typeof raw === "number" && (raw === 0 || raw === 1)) {
      return {
        ok: true,
        valueType: "BOOLEAN",
        value: raw === 1,
        stored: raw === 1 ? "true" : "false",
      };
    }
    return { ok: false, error: "BOOLEAN value must be true or false" };
  }

  if (valueType === "INTEGER" || valueType === "BYTES") {
    let n: number;
    if (typeof raw === "number") {
      n = raw;
    } else if (typeof raw === "string") {
      const t = raw.trim();
      if (!/^-?\d+$/.test(t)) {
        return {
          ok: false,
          error: `${valueType} value must be an integer string`,
        };
      }
      n = Number(t);
    } else {
      return { ok: false, error: `${valueType} value must be an integer` };
    }
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return {
        ok: false,
        error: `${valueType} value must be a finite integer`,
      };
    }
    if (n < 0) {
      return { ok: false, error: `${valueType} value must be >= 0` };
    }
    return {
      ok: true,
      valueType,
      value: n,
      stored: String(n),
    };
  }

  return { ok: false, error: "unknown valueType" };
}

/**
 * PLATFORM-IDENTITY-10C — Effective entitlements domain contract.
 * Resolution only. No enforcement (PI-10D).
 */

export type EffectiveEntitlement = {
  key: string;
  value: boolean | number;
  valueType: EntitlementValueType;
  enforcementType: EntitlementEnforcementType;
  /** Normalized stored form (TEXT). */
  raw: string;
};

export type EffectiveEntitlements = {
  tenantId: string;
  planId: string;
  planKey: string;
  entitlements: EffectiveEntitlement[];
  resolvedAt: string;
};

export const ENTITLEMENT_RESOLVE_STATUSES = [
  "RESOLVED",
  "NO_ACTIVE_PLAN",
  "PLAN_NOT_FOUND",
  "INVALID_ENTITLEMENT",
  "DUPLICATE_ENTITLEMENT",
  "TENANT_NOT_FOUND",
  "MULTIPLE_ACTIVE_PLANS",
] as const;
export type EntitlementResolveStatus =
  (typeof ENTITLEMENT_RESOLVE_STATUSES)[number];

export type EntitlementResolveDiagnosticCode =
  | "NO_ACTIVE_PLAN"
  | "PLAN_NOT_FOUND"
  | "TENANT_NOT_FOUND"
  | "MULTIPLE_ACTIVE_PLANS"
  | "INACTIVE_DEFINITION_IGNORED"
  | "INVALID_VALUE"
  | "DUPLICATE_ENTITLEMENT_BINDING"
  | "INVALID_DEFINITION_META";

export type EntitlementResolveDiagnostic = {
  code: EntitlementResolveDiagnosticCode;
  /** Non-sensitive human-readable detail. */
  message: string;
  entitlementKey?: string;
  entitlementDefinitionId?: string;
};

export type PlanEntitlementBindingInput = {
  entitlementDefinitionId: string;
  key: string;
  valueType: string;
  enforcementType: string;
  active: boolean;
  rawValue: string;
};

/**
 * Pure assembly of EffectiveEntitlements from already-loaded bindings.
 * Deterministic: sorts by key; no DB I/O; no side effects.
 */
export function assembleEffectiveEntitlements(input: {
  tenantId: string;
  planId: string;
  planKey: string;
  bindings: PlanEntitlementBindingInput[];
  resolvedAt: string;
}):
  | {
      status: "RESOLVED";
      entitlements: EffectiveEntitlements;
      diagnostics: EntitlementResolveDiagnostic[];
    }
  | {
      status: "INVALID_ENTITLEMENT" | "DUPLICATE_ENTITLEMENT";
      tenantId: string;
      planId: string;
      planKey: string;
      diagnostics: EntitlementResolveDiagnostic[];
    } {
  const diagnostics: EntitlementResolveDiagnostic[] = [];
  const byDefId = new Map<string, PlanEntitlementBindingInput>();
  const byKey = new Map<string, PlanEntitlementBindingInput>();

  for (const b of input.bindings) {
    if (byDefId.has(b.entitlementDefinitionId)) {
      return {
        status: "DUPLICATE_ENTITLEMENT",
        tenantId: input.tenantId,
        planId: input.planId,
        planKey: input.planKey,
        diagnostics: [
          {
            code: "DUPLICATE_ENTITLEMENT_BINDING",
            message:
              "Duplicate PlanEntitlement binding for the same definition",
            entitlementDefinitionId: b.entitlementDefinitionId,
            entitlementKey: b.key,
          },
        ],
      };
    }
    byDefId.set(b.entitlementDefinitionId, b);

    if (!b.active) {
      diagnostics.push({
        code: "INACTIVE_DEFINITION_IGNORED",
        message: "Inactive EntitlementDefinition ignored in resolution",
        entitlementKey: b.key,
        entitlementDefinitionId: b.entitlementDefinitionId,
      });
      continue;
    }

    if (byKey.has(b.key)) {
      return {
        status: "DUPLICATE_ENTITLEMENT",
        tenantId: input.tenantId,
        planId: input.planId,
        planKey: input.planKey,
        diagnostics: [
          {
            code: "DUPLICATE_ENTITLEMENT_BINDING",
            message: "Duplicate entitlement key in plan bindings",
            entitlementKey: b.key,
            entitlementDefinitionId: b.entitlementDefinitionId,
          },
        ],
      };
    }
    byKey.set(b.key, b);
  }

  const entries: EffectiveEntitlement[] = [];
  for (const b of byKey.values()) {
    if (!isEntitlementValueType(b.valueType)) {
      return {
        status: "INVALID_ENTITLEMENT",
        tenantId: input.tenantId,
        planId: input.planId,
        planKey: input.planKey,
        diagnostics: [
          {
            code: "INVALID_DEFINITION_META",
            message: "EntitlementDefinition has invalid valueType",
            entitlementKey: b.key,
            entitlementDefinitionId: b.entitlementDefinitionId,
          },
        ],
      };
    }
    if (!isEntitlementEnforcementType(b.enforcementType)) {
      return {
        status: "INVALID_ENTITLEMENT",
        tenantId: input.tenantId,
        planId: input.planId,
        planKey: input.planKey,
        diagnostics: [
          {
            code: "INVALID_DEFINITION_META",
            message: "EntitlementDefinition has invalid enforcementType",
            entitlementKey: b.key,
            entitlementDefinitionId: b.entitlementDefinitionId,
          },
        ],
      };
    }

    const parsed = parseEntitlementValue(b.valueType, b.rawValue);
    if (!parsed.ok) {
      return {
        status: "INVALID_ENTITLEMENT",
        tenantId: input.tenantId,
        planId: input.planId,
        planKey: input.planKey,
        diagnostics: [
          {
            code: "INVALID_VALUE",
            message: parsed.error,
            entitlementKey: b.key,
            entitlementDefinitionId: b.entitlementDefinitionId,
          },
        ],
      };
    }

    entries.push({
      key: b.key,
      value: parsed.value,
      valueType: parsed.valueType,
      enforcementType: b.enforcementType,
      raw: parsed.stored,
    });
  }

  entries.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  return {
    status: "RESOLVED",
    entitlements: {
      tenantId: input.tenantId,
      planId: input.planId,
      planKey: input.planKey,
      entitlements: entries,
      resolvedAt: input.resolvedAt,
    },
    diagnostics,
  };
}

export type EntitlementResolveResult =
  | {
      status: "RESOLVED";
      entitlements: EffectiveEntitlements;
      diagnostics: EntitlementResolveDiagnostic[];
    }
  | {
      status: Exclude<EntitlementResolveStatus, "RESOLVED">;
      tenantId: string;
      planId?: string;
      planKey?: string;
      diagnostics: EntitlementResolveDiagnostic[];
    };

/** Pilot FEATURE_GATE key — PI-10D. */
export const DEVICES_ENABLED_KEY = "devices.enabled";

/** Quantitative HARD_LIMIT key — PI-10G. */
export const DEVICES_MAX_KEY = "devices.max";

/** Storage HARD_LIMIT key — PI-10J. */
export const STORAGE_MAX_KEY = "storage.maxBytes";

export const ENTITLEMENT_ENFORCE_DECISIONS = ["ALLOW", "DENY"] as const;
export type EntitlementEnforceDecision =
  (typeof ENTITLEMENT_ENFORCE_DECISIONS)[number];

export type EntitlementEnforceReason =
  | "FLAG_OFF"
  | "FEATURE_ENABLED"
  | "FEATURE_DISABLED"
  | "ENTITLEMENT_NOT_FOUND"
  | "NO_ACTIVE_PLAN"
  | "PLAN_NOT_FOUND"
  | "TENANT_NOT_FOUND"
  | "INVALID_ENTITLEMENT"
  | "DUPLICATE_ENTITLEMENT"
  | "MULTIPLE_ACTIVE_PLANS"
  | "INVALID_VALUE_TYPE"
  | "QUOTA_EXCEEDED";

export type EntitlementEnforceResult = {
  decision: EntitlementEnforceDecision;
  reason: EntitlementEnforceReason;
  entitlementKey: string;
  tenantId: string;
  operation?: string;
};

/**
 * Pure FEATURE_GATE evaluation against a resolved EffectiveEntitlements snapshot.
 * Fail-closed: missing / wrong type → DENY. Does not mutate input.
 */
export function evaluateFeatureGate(
  snapshot: EffectiveEntitlements,
  key: string,
  operation?: string,
): EntitlementEnforceResult {
  const entry = snapshot.entitlements.find((e) => e.key === key);
  if (!entry) {
    return {
      decision: "DENY",
      reason: "ENTITLEMENT_NOT_FOUND",
      entitlementKey: key,
      tenantId: snapshot.tenantId,
      operation,
    };
  }
  if (entry.valueType !== "BOOLEAN" || typeof entry.value !== "boolean") {
    return {
      decision: "DENY",
      reason: "INVALID_VALUE_TYPE",
      entitlementKey: key,
      tenantId: snapshot.tenantId,
      operation,
    };
  }
  if (entry.value === true) {
    return {
      decision: "ALLOW",
      reason: "FEATURE_ENABLED",
      entitlementKey: key,
      tenantId: snapshot.tenantId,
      operation,
    };
  }
  return {
    decision: "DENY",
    reason: "FEATURE_DISABLED",
    entitlementKey: key,
    tenantId: snapshot.tenantId,
    operation,
  };
}

/** Map resolve failure statuses to enforce DENY reasons (fail-closed). */
export function denyReasonFromResolveStatus(
  status: Exclude<EntitlementResolveStatus, "RESOLVED">,
): EntitlementEnforceReason {
  switch (status) {
    case "NO_ACTIVE_PLAN":
      return "NO_ACTIVE_PLAN";
    case "PLAN_NOT_FOUND":
      return "PLAN_NOT_FOUND";
    case "TENANT_NOT_FOUND":
      return "TENANT_NOT_FOUND";
    case "INVALID_ENTITLEMENT":
      return "INVALID_ENTITLEMENT";
    case "DUPLICATE_ENTITLEMENT":
      return "DUPLICATE_ENTITLEMENT";
    case "MULTIPLE_ACTIVE_PLANS":
      return "MULTIPLE_ACTIVE_PLANS";
    default:
      return "INVALID_ENTITLEMENT";
  }
}

/**
 * PLATFORM-IDENTITY-10B/10C/10D — Entitlements domain service.
 *
 * Persistence (10B), EffectiveEntitlements resolution (10C),
 * and centralized entitlement enforcement (10D). Internal boundary.
 * Resource APIs must not re-implement PlanEntitlement lookups.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  entitlementDefinitions,
  planEntitlements,
  plans,
  tenantPlans,
  tenants,
} from "@/db/schema";
import {
  assembleEffectiveEntitlements,
  COMPATIBILITY_PLAN_KEY,
  denyReasonFromResolveStatus,
  DEVICES_ENABLED_KEY,
  evaluateFeatureGate,
  isEntitlementEnforcementType,
  isEntitlementValueType,
  isTenantPlanStatus,
  isValidEntitlementKey,
  isValidPlanKey,
  parseEntitlementValue,
  type EntitlementEnforcementType,
  type EntitlementEnforceResult,
  type EntitlementResolveResult,
  type EntitlementValueType,
  type TenantPlanStatus,
} from "@/domain/entitlements";
import { isEntitlementsEnabled } from "@/lib/entitlements-flag";

export class EntitlementsError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "VALIDATION"
      | "NOT_FOUND"
      | "CONFLICT"
      | "DISABLED"
      | "FORBIDDEN" = "VALIDATION",
  ) {
    super(message);
    this.name = "EntitlementsError";
  }
}

/** Thrown when entitlement enforcement denies an operation (API → 403). */
export class EntitlementDeniedError extends Error {
  readonly code: "ENTITLEMENT_DENIED" | "QUOTA_EXCEEDED";
  constructor(
    public readonly entitlementKey: string,
    public readonly reason: string,
    public readonly status = 403,
    responseCode: "ENTITLEMENT_DENIED" | "QUOTA_EXCEEDED" = "ENTITLEMENT_DENIED",
  ) {
    super("Entitlement denied");
    this.name = "EntitlementDeniedError";
    this.code = responseCode;
  }
}

function assertInfraAvailable() {
  // Schema/seed may run with flag OFF; mutating catalogue ops for future
  // management may choose to require ON. Domain CRUD used by tests/seed
  // is allowed regardless — enforcement never happens in PI-10B.
  void isEntitlementsEnabled;
}

export async function createEntitlementDefinition(input: {
  key: string;
  name: string;
  description?: string | null;
  valueType: string;
  enforcementType: string;
  active?: boolean;
}) {
  assertInfraAvailable();
  if (!isValidEntitlementKey(input.key)) {
    throw new EntitlementsError("Invalid entitlement key", "VALIDATION");
  }
  if (!input.name?.trim()) {
    throw new EntitlementsError("name required", "VALIDATION");
  }
  if (!isEntitlementValueType(input.valueType)) {
    throw new EntitlementsError("Invalid valueType", "VALIDATION");
  }
  if (!isEntitlementEnforcementType(input.enforcementType)) {
    throw new EntitlementsError("Invalid enforcementType", "VALIDATION");
  }

  const [existing] = await db
    .select({ id: entitlementDefinitions.id })
    .from(entitlementDefinitions)
    .where(eq(entitlementDefinitions.key, input.key))
    .limit(1);
  if (existing) {
    throw new EntitlementsError("EntitlementDefinition key already exists", "CONFLICT");
  }

  const id = crypto.randomUUID();
  await db.insert(entitlementDefinitions).values({
    id,
    key: input.key,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    valueType: input.valueType as EntitlementValueType,
    enforcementType: input.enforcementType as EntitlementEnforcementType,
    active: input.active !== false,
  });
  const [row] = await db
    .select()
    .from(entitlementDefinitions)
    .where(eq(entitlementDefinitions.id, id))
    .limit(1);
  return row!;
}

export async function createPlan(input: {
  key: string;
  name: string;
  description?: string | null;
  active?: boolean;
}) {
  assertInfraAvailable();
  if (!isValidPlanKey(input.key)) {
    throw new EntitlementsError("Invalid plan key", "VALIDATION");
  }
  if (!input.name?.trim()) {
    throw new EntitlementsError("name required", "VALIDATION");
  }

  const [existing] = await db
    .select({ id: plans.id })
    .from(plans)
    .where(eq(plans.key, input.key))
    .limit(1);
  if (existing) {
    throw new EntitlementsError("Plan key already exists", "CONFLICT");
  }

  const id = crypto.randomUUID();
  await db.insert(plans).values({
    id,
    key: input.key,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    active: input.active !== false,
  });
  const [row] = await db.select().from(plans).where(eq(plans.id, id)).limit(1);
  return row!;
}

export async function createPlanEntitlement(input: {
  planId: string;
  entitlementDefinitionId: string;
  value: unknown;
}) {
  assertInfraAvailable();
  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, input.planId))
    .limit(1);
  if (!plan) throw new EntitlementsError("Plan not found", "NOT_FOUND");

  const [def] = await db
    .select()
    .from(entitlementDefinitions)
    .where(eq(entitlementDefinitions.id, input.entitlementDefinitionId))
    .limit(1);
  if (!def) {
    throw new EntitlementsError("EntitlementDefinition not found", "NOT_FOUND");
  }
  if (!isEntitlementValueType(def.valueType)) {
    throw new EntitlementsError("Definition has invalid valueType", "VALIDATION");
  }

  const parsed = parseEntitlementValue(def.valueType, input.value);
  if (!parsed.ok) {
    throw new EntitlementsError(parsed.error, "VALIDATION");
  }

  const [dup] = await db
    .select({ id: planEntitlements.id })
    .from(planEntitlements)
    .where(
      and(
        eq(planEntitlements.planId, input.planId),
        eq(
          planEntitlements.entitlementDefinitionId,
          input.entitlementDefinitionId,
        ),
      ),
    )
    .limit(1);
  if (dup) {
    throw new EntitlementsError(
      "PlanEntitlement already exists for this plan and definition",
      "CONFLICT",
    );
  }

  const id = crypto.randomUUID();
  await db.insert(planEntitlements).values({
    id,
    planId: input.planId,
    entitlementDefinitionId: input.entitlementDefinitionId,
    value: parsed.stored,
  });
  const [row] = await db
    .select()
    .from(planEntitlements)
    .where(eq(planEntitlements.id, id))
    .limit(1);
  return row!;
}

export async function createTenantPlan(input: {
  tenantId: string;
  planId: string;
  status?: TenantPlanStatus;
  startsAt?: string;
  endsAt?: string | null;
}) {
  assertInfraAvailable();
  const status: TenantPlanStatus = input.status ?? "ACTIVE";
  if (!isTenantPlanStatus(status)) {
    throw new EntitlementsError("Invalid TenantPlan status", "VALIDATION");
  }

  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.id, input.tenantId))
    .limit(1);
  if (!tenant) throw new EntitlementsError("Tenant not found", "NOT_FOUND");

  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, input.planId))
    .limit(1);
  if (!plan) throw new EntitlementsError("Plan not found", "NOT_FOUND");
  if (!plan.active && status === "ACTIVE") {
    throw new EntitlementsError(
      "Cannot assign inactive Plan as ACTIVE TenantPlan",
      "VALIDATION",
    );
  }

  if (status === "ACTIVE") {
    const [active] = await db
      .select({ id: tenantPlans.id })
      .from(tenantPlans)
      .where(
        and(
          eq(tenantPlans.tenantId, input.tenantId),
          eq(tenantPlans.status, "ACTIVE"),
        ),
      )
      .limit(1);
    if (active) {
      throw new EntitlementsError(
        "Tenant already has an ACTIVE TenantPlan",
        "CONFLICT",
      );
    }
  }

  const id = crypto.randomUUID();
  await db.insert(tenantPlans).values({
    id,
    tenantId: input.tenantId,
    planId: input.planId,
    status,
    startsAt: input.startsAt,
    endsAt: input.endsAt ?? null,
  });
  const [row] = await db
    .select()
    .from(tenantPlans)
    .where(eq(tenantPlans.id, id))
    .limit(1);
  return row!;
}

export async function getTenantPlanForTenant(
  tenantId: string,
  status: TenantPlanStatus = "ACTIVE",
) {
  const [row] = await db
    .select()
    .from(tenantPlans)
    .where(
      and(eq(tenantPlans.tenantId, tenantId), eq(tenantPlans.status, status)),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Idempotent technical seed: compatibility plan + devices.enabled=true.
 * Preserves current behaviour when enforcement is later enabled for tenants
 * that hold this plan. Does NOT invent commercial Free/Pro/Enterprise plans.
 * Does NOT introduce devices.max / quotas.
 */
export async function seedCompatibilityPlan(): Promise<{
  planId: string;
  created: boolean;
}> {
  const [existing] = await db
    .select()
    .from(plans)
    .where(eq(plans.key, COMPATIBILITY_PLAN_KEY))
    .limit(1);

  let planId: string;
  let created = false;
  if (existing) {
    planId = existing.id;
  } else {
    const plan = await createPlan({
      key: COMPATIBILITY_PLAN_KEY,
      name: "Compatibility Default",
      description:
        "DEFAULT PLAN = COMPATIBILITY PLAN. Technical only — preserves existing tenant behaviour until commercial entitlements are decided. Not a Free/Pro/Enterprise SKU.",
      active: true,
    });
    planId = plan.id;
    created = true;
  }

  await ensureDevicesEnabledOnPlan(planId);
  return { planId, created };
}

/** Ensure devices.enabled FEATURE_GATE exists and is true on the given plan. */
async function ensureDevicesEnabledOnPlan(planId: string) {
  let [def] = await db
    .select()
    .from(entitlementDefinitions)
    .where(eq(entitlementDefinitions.key, DEVICES_ENABLED_KEY))
    .limit(1);
  if (!def) {
    def = await createEntitlementDefinition({
      key: DEVICES_ENABLED_KEY,
      name: "Devices Enabled",
      description:
        "FEATURE_GATE: whether the tenant may pair/create devices (PI-10D pilot). Not a quota.",
      valueType: "BOOLEAN",
      enforcementType: "FEATURE_GATE",
      active: true,
    });
  }

  const [binding] = await db
    .select({ id: planEntitlements.id })
    .from(planEntitlements)
    .where(
      and(
        eq(planEntitlements.planId, planId),
        eq(planEntitlements.entitlementDefinitionId, def.id),
      ),
    )
    .limit(1);
  if (!binding) {
    await createPlanEntitlement({
      planId,
      entitlementDefinitionId: def.id,
      value: true,
    });
  }
}

/**
 * Soft-deactivate Plan (prefer over hard delete). Rejects if ACTIVE TenantPlans exist.
 */
export async function deactivatePlan(planId: string) {
  const [plan] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
  if (!plan) throw new EntitlementsError("Plan not found", "NOT_FOUND");

  const [activeBinding] = await db
    .select({ id: tenantPlans.id })
    .from(tenantPlans)
    .where(
      and(eq(tenantPlans.planId, planId), eq(tenantPlans.status, "ACTIVE")),
    )
    .limit(1);
  if (activeBinding) {
    throw new EntitlementsError(
      "Cannot deactivate Plan with ACTIVE TenantPlan bindings",
      "CONFLICT",
    );
  }

  await db
    .update(plans)
    .set({ active: false, updatedAt: new Date().toISOString() })
    .where(eq(plans.id, planId));
}

/**
 * Soft-deactivate EntitlementDefinition. Rejects if bound to any PlanEntitlement
 * when force is false — prefer inactive flag while bindings remain for history.
 */
export async function deactivateEntitlementDefinition(definitionId: string) {
  const [def] = await db
    .select()
    .from(entitlementDefinitions)
    .where(eq(entitlementDefinitions.id, definitionId))
    .limit(1);
  if (!def) {
    throw new EntitlementsError("EntitlementDefinition not found", "NOT_FOUND");
  }
  await db
    .update(entitlementDefinitions)
    .set({ active: false, updatedAt: new Date().toISOString() })
    .where(eq(entitlementDefinitions.id, definitionId));
}

/**
 * PLATFORM-IDENTITY-10C — Read-only EffectiveEntitlements resolver.
 *
 * Source of truth: DB (TenantPlan ACTIVE → Plan → PlanEntitlement → Definition).
 * Does not mutate state, assign plans, check RBAC / session / tenant status, or enforce quotas.
 * Does not fall back to compatibility_default when no ACTIVE TenantPlan exists.
 *
 * Optional `now` makes `resolvedAt` injectable for deterministic tests.
 */
export async function resolveEffectiveEntitlements(
  tenantId: string,
  now: Date = new Date(),
): Promise<EntitlementResolveResult> {
  void isEntitlementsEnabled; // available for later phases; resolution itself is pure

  if (!tenantId || typeof tenantId !== "string") {
    return {
      status: "TENANT_NOT_FOUND",
      tenantId: String(tenantId ?? ""),
      diagnostics: [
        {
          code: "TENANT_NOT_FOUND",
          message: "tenantId required",
        },
      ],
    };
  }

  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!tenant) {
    return {
      status: "TENANT_NOT_FOUND",
      tenantId,
      diagnostics: [
        {
          code: "TENANT_NOT_FOUND",
          message: "Tenant not found",
        },
      ],
    };
  }

  const activePlans = await db
    .select()
    .from(tenantPlans)
    .where(
      and(eq(tenantPlans.tenantId, tenantId), eq(tenantPlans.status, "ACTIVE")),
    );

  if (activePlans.length === 0) {
    return {
      status: "NO_ACTIVE_PLAN",
      tenantId,
      diagnostics: [
        {
          code: "NO_ACTIVE_PLAN",
          message: "Tenant has no ACTIVE TenantPlan",
        },
      ],
    };
  }

  if (activePlans.length > 1) {
    return {
      status: "MULTIPLE_ACTIVE_PLANS",
      tenantId,
      diagnostics: [
        {
          code: "MULTIPLE_ACTIVE_PLANS",
          message: "Tenant has more than one ACTIVE TenantPlan",
        },
      ],
    };
  }

  const tenantPlan = activePlans[0]!;
  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, tenantPlan.planId))
    .limit(1);
  if (!plan) {
    return {
      status: "PLAN_NOT_FOUND",
      tenantId,
      planId: tenantPlan.planId,
      diagnostics: [
        {
          code: "PLAN_NOT_FOUND",
          message: "Plan referenced by ACTIVE TenantPlan was not found",
        },
      ],
    };
  }

  const rows = await db
    .select({
      entitlementDefinitionId: planEntitlements.entitlementDefinitionId,
      rawValue: planEntitlements.value,
      key: entitlementDefinitions.key,
      valueType: entitlementDefinitions.valueType,
      enforcementType: entitlementDefinitions.enforcementType,
      active: entitlementDefinitions.active,
    })
    .from(planEntitlements)
    .innerJoin(
      entitlementDefinitions,
      eq(
        planEntitlements.entitlementDefinitionId,
        entitlementDefinitions.id,
      ),
    )
    .where(eq(planEntitlements.planId, plan.id));

  return assembleEffectiveEntitlements({
    tenantId,
    planId: plan.id,
    planKey: plan.key,
    bindings: rows.map((r) => ({
      entitlementDefinitionId: r.entitlementDefinitionId,
      key: r.key,
      valueType: r.valueType,
      enforcementType: r.enforcementType,
      active: r.active,
      rawValue: r.rawValue,
    })),
    resolvedAt: now.toISOString(),
  });
}

/**
 * PLATFORM-IDENTITY-10D — Centralized entitlement enforcement.
 *
 * Consumes resolveEffectiveEntitlements (PI-10C). Does not query PlanEntitlement
 * directly. Does not mutate DB. Does not check RBAC / session / tenant status /
 * commercial SaaS providers / quota counters.
 *
 * When ENTITLEMENTS_ENABLED is OFF → ALLOW (legacy behaviour preserved).
 * When ON → fail-closed FEATURE_GATE evaluation.
 */
export async function enforceEntitlement(input: {
  tenantId: string;
  key: string;
  operation?: string;
}): Promise<EntitlementEnforceResult> {
  const { tenantId, key, operation } = input;

  if (!isEntitlementsEnabled()) {
    return {
      decision: "ALLOW",
      reason: "FLAG_OFF",
      entitlementKey: key,
      tenantId,
      operation,
    };
  }

  const resolved = await resolveEffectiveEntitlements(tenantId);
  if (resolved.status !== "RESOLVED") {
    return {
      decision: "DENY",
      reason: denyReasonFromResolveStatus(resolved.status),
      entitlementKey: key,
      tenantId,
      operation,
    };
  }

  return evaluateFeatureGate(resolved.entitlements, key, operation);
}

/**
 * Assert devices.enabled for tenant-scoped device pairing/creation.
 * Throws EntitlementDeniedError on DENY (HTTP 403 via handleApiError).
 */
export async function assertDevicesEnabled(
  tenantId: string,
  operation = "device.pair",
): Promise<EntitlementEnforceResult> {
  const result = await enforceEntitlement({
    tenantId,
    key: DEVICES_ENABLED_KEY,
    operation,
  });
  if (result.decision === "DENY") {
    throw new EntitlementDeniedError(DEVICES_ENABLED_KEY, result.reason);
  }
  return result;
}

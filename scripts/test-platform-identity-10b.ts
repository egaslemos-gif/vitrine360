/**
 * PLATFORM-IDENTITY-10B — Entitlements schema & domain suite.
 * PI10B-SCHEMA / DOMAIN / VALUE / TENANT / PLAN / SEED / FLAG / REGRESSION
 */
import assert from "node:assert/strict";
import { config } from "dotenv";
import { and, eq, sql } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";

config({ path: ".env.local" });
config({ path: ".env" });

type Result = { id: string; ok: boolean; detail?: string };
const results: Result[] = [];

function record(id: string, ok: boolean, detail?: string) {
  results.push({ id, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark} ${id}${detail ? ` — ${detail}` : ""}`);
}

function assertPass(id: string, cond: boolean, detail?: string) {
  record(id, cond, detail);
  if (!cond) throw new Error(`${id} failed${detail ? `: ${detail}` : ""}`);
}

async function main() {
  const originalFlag = process.env.ENTITLEMENTS_ENABLED;
  delete process.env.ENTITLEMENTS_ENABLED;

  const {
    isEntitlementsEnabled,
    resolveEntitlementsFlagFromTrustedEnvOnly,
  } = await import("../src/lib/entitlements-flag");
  const { db, ensureSchema, schema } = await import("../src/db");
  const { createTenant } = await import("../src/services/tenants");
  const {
    COMPATIBILITY_PLAN_KEY,
    parseEntitlementValue,
    isEntitlementValueType,
    isEntitlementEnforcementType,
  } = await import("../src/domain/entitlements");
  const entitlements = await import("../src/services/entitlements");
  const { EntitlementsError } = entitlements;

  // --- FLAG ---
  assertPass(
    "PI10B-FLAG-01",
    isEntitlementsEnabled() === false &&
      isEntitlementsEnabled({}) === false &&
      isEntitlementsEnabled({ ENTITLEMENTS_ENABLED: "" }) === false &&
      isEntitlementsEnabled({ ENTITLEMENTS_ENABLED: "false" }) === false,
    "undefined/empty/false → OFF",
  );
  assertPass(
    "PI10B-FLAG-02",
    isEntitlementsEnabled({ ENTITLEMENTS_ENABLED: "true" }) === true &&
      isEntitlementsEnabled({ ENTITLEMENTS_ENABLED: "1" }) === true,
    "true/1 → ON",
  );
  assertPass(
    "PI10B-FLAG-03",
    resolveEntitlementsFlagFromTrustedEnvOnly("true", {
      ENTITLEMENTS_ENABLED: "false",
    }) === false,
    "request-derived override ignored (fail-closed)",
  );

  // --- SCHEMA ---
  await ensureSchema();
  const tableNames = (
    await db.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name IN (
        'entitlement_definitions','plans','plan_entitlements','tenant_plans'
      )`,
    )
  ).map((r) => r.name);
  assertPass(
    "PI10B-SCHEMA-01",
    tableNames.includes("entitlement_definitions") &&
      tableNames.includes("plans") &&
      tableNames.includes("plan_entitlements") &&
      tableNames.includes("tenant_plans"),
    `tables=${tableNames.join(",")}`,
  );

  const planCols = await db.all<{ name: string }>(
    sql`PRAGMA table_info(plans)`,
  );
  const planColNames = planCols.map((c) => c.name);
  assertPass(
    "PI10B-SCHEMA-02",
    !planColNames.includes("tenant_id") &&
      !planColNames.includes("price") &&
      !planColNames.includes("currency"),
    "Plan has no tenant_id / price / currency",
  );

  const migrationPath = path.join(
    process.cwd(),
    "drizzle",
    "0007_entitlements.sql",
  );
  assertPass(
    "PI10B-SCHEMA-03",
    fs.existsSync(migrationPath),
    "drizzle/0007_entitlements.sql present",
  );

  // --- DOMAIN / VALUE ---
  assertPass(
    "PI10B-VALUE-01",
    parseEntitlementValue("BOOLEAN", "true").ok === true &&
      parseEntitlementValue("BOOLEAN", false).ok === true,
    "BOOLEAN valid",
  );
  assertPass(
    "PI10B-VALUE-02",
    parseEntitlementValue("BOOLEAN", "maybe").ok === false,
    "BOOLEAN invalid",
  );
  assertPass(
    "PI10B-VALUE-03",
    parseEntitlementValue("INTEGER", "10").ok === true &&
      (parseEntitlementValue("INTEGER", "10") as { value: number }).value === 10,
    "INTEGER valid",
  );
  assertPass(
    "PI10B-VALUE-04",
    parseEntitlementValue("INTEGER", "10.5").ok === false &&
      parseEntitlementValue("INTEGER", "abc").ok === false &&
      parseEntitlementValue("INTEGER", NaN).ok === false,
    "INTEGER invalid",
  );
  assertPass(
    "PI10B-VALUE-05",
    parseEntitlementValue("BYTES", 0).ok === true,
    "BYTES valid",
  );
  assertPass(
    "PI10B-VALUE-06",
    parseEntitlementValue("BYTES", -1).ok === false,
    "BYTES negative reject",
  );
  assertPass(
    "PI10B-DOMAIN-01",
    isEntitlementValueType("BOOLEAN") &&
      isEntitlementValueType("INTEGER") &&
      isEntitlementValueType("BYTES") &&
      !isEntitlementValueType("ENUM"),
    "valueType enum + ENUM deferred",
  );
  assertPass(
    "PI10B-DOMAIN-02",
    isEntitlementEnforcementType("FEATURE_GATE") &&
      isEntitlementEnforcementType("HARD_LIMIT") &&
      isEntitlementEnforcementType("SOFT_LIMIT"),
    "enforcementType enum",
  );

  // --- PLAN / DEFINITION CRUD ---
  const suffix = Date.now().toString(36);
  const def = await entitlements.createEntitlementDefinition({
    key: `test.feature.${suffix}`,
    name: "Test Feature",
    valueType: "BOOLEAN",
    enforcementType: "FEATURE_GATE",
  });
  assertPass("PI10B-PLAN-01", Boolean(def?.id), "create Definition");

  let dupDef = false;
  try {
    await entitlements.createEntitlementDefinition({
      key: def.key,
      name: "Dup",
      valueType: "BOOLEAN",
      enforcementType: "FEATURE_GATE",
    });
  } catch (e) {
    dupDef = e instanceof EntitlementsError && e.code === "CONFLICT";
  }
  assertPass("PI10B-PLAN-02", dupDef, "duplicate Definition key → reject");

  const plan = await entitlements.createPlan({
    key: `test.plan.${suffix}`,
    name: "Test Plan",
  });
  assertPass("PI10B-PLAN-03", Boolean(plan?.id), "create Plan");

  let dupPlan = false;
  try {
    await entitlements.createPlan({ key: plan.key, name: "Dup" });
  } catch (e) {
    dupPlan = e instanceof EntitlementsError && e.code === "CONFLICT";
  }
  assertPass("PI10B-PLAN-04", dupPlan, "duplicate Plan key → reject");

  const pe = await entitlements.createPlanEntitlement({
    planId: plan.id,
    entitlementDefinitionId: def.id,
    value: true,
  });
  assertPass(
    "PI10B-PLAN-05",
    pe.value === "true",
    "create PlanEntitlement BOOLEAN",
  );

  let dupPe = false;
  try {
    await entitlements.createPlanEntitlement({
      planId: plan.id,
      entitlementDefinitionId: def.id,
      value: false,
    });
  } catch (e) {
    dupPe = e instanceof EntitlementsError && e.code === "CONFLICT";
  }
  assertPass("PI10B-PLAN-06", dupPe, "duplicate PlanEntitlement → reject");

  let badValue = false;
  const intDef = await entitlements.createEntitlementDefinition({
    key: `test.limit.${suffix}`,
    name: "Test Limit",
    valueType: "INTEGER",
    enforcementType: "HARD_LIMIT",
  });
  try {
    await entitlements.createPlanEntitlement({
      planId: plan.id,
      entitlementDefinitionId: intDef.id,
      value: "10.5",
    });
  } catch (e) {
    badValue = e instanceof EntitlementsError && e.code === "VALIDATION";
  }
  assertPass("PI10B-PLAN-07", badValue, "INTEGER 10.5 → reject");

  // --- TENANT isolation ---
  const tenantAId = await createTenant({
    name: `PI10B A ${suffix}`,
    slug: `pi10b-a-${suffix}`,
  });
  const tenantBId = await createTenant({
    name: `PI10B B ${suffix}`,
    slug: `pi10b-b-${suffix}`,
  });

  const tpA = await entitlements.createTenantPlan({
    tenantId: tenantAId,
    planId: plan.id,
    status: "ACTIVE",
  });
  assertPass("PI10B-TENANT-01", Boolean(tpA?.id), "TenantPlan válido");

  let twoActive = false;
  try {
    await entitlements.createTenantPlan({
      tenantId: tenantAId,
      planId: plan.id,
      status: "ACTIVE",
    });
  } catch (e) {
    twoActive = e instanceof EntitlementsError && e.code === "CONFLICT";
  }
  assertPass(
    "PI10B-TENANT-02",
    twoActive,
    "dois ACTIVE mesmo tenant → reject",
  );

  const tpB = await entitlements.createTenantPlan({
    tenantId: tenantBId,
    planId: plan.id,
    status: "ACTIVE",
  });
  const forA = await entitlements.getTenantPlanForTenant(tenantAId);
  const forB = await entitlements.getTenantPlanForTenant(tenantBId);
  assertPass(
    "PI10B-TENANT-03",
    forA?.id === tpA.id && forB?.id === tpB.id && forA?.id !== forB?.id,
    "Tenant A isolado de Tenant B",
  );
  assertPass(
    "PI10B-TENANT-04",
    forA?.tenantId === tenantAId && forB?.tenantId === tenantBId,
    "TenantPlan referencia tenant correto",
  );

  // Plan is global catalogue (no tenant_id) — both tenants can bind same plan
  assertPass(
    "PI10B-TENANT-05",
    tpA.planId === tpB.planId && tpA.planId === plan.id,
    "Plan global acessível como catálogo",
  );

  // --- SEED ---
  const s1 = await entitlements.seedCompatibilityPlan();
  const s2 = await entitlements.seedCompatibilityPlan();
  assertPass(
    "PI10B-SEED-01",
    s1.planId === s2.planId && s2.created === false,
    "seed idempotente",
  );
  const [compat] = await db
    .select()
    .from(schema.plans)
    .where(eq(schema.plans.key, COMPATIBILITY_PLAN_KEY))
    .limit(1);
  assertPass(
    "PI10B-SEED-02",
    Boolean(compat) &&
      (compat!.description ?? "").includes("COMPATIBILITY"),
    "DEFAULT PLAN = COMPATIBILITY PLAN",
  );

  // Compatibility plan may bind devices.enabled=true (PI-10D pilot FEATURE_GATE)
  // but must not invent commercial quotas (devices.max, storage caps, etc.).
  const compatBindings = await db
    .select({
      value: schema.planEntitlements.value,
      key: schema.entitlementDefinitions.key,
      valueType: schema.entitlementDefinitions.valueType,
      enforcementType: schema.entitlementDefinitions.enforcementType,
    })
    .from(schema.planEntitlements)
    .innerJoin(
      schema.entitlementDefinitions,
      eq(
        schema.planEntitlements.entitlementDefinitionId,
        schema.entitlementDefinitions.id,
      ),
    )
    .where(eq(schema.planEntitlements.planId, compat!.id));
  const onlyCompatGates = compatBindings.every(
    (b) =>
      b.key === "devices.enabled" &&
      b.valueType === "BOOLEAN" &&
      b.enforcementType === "FEATURE_GATE" &&
      b.value === "true",
  );
  assertPass(
    "PI10B-SEED-03",
    compatBindings.length === 0 || onlyCompatGates,
    "compatibility plan has no artificial quota bindings",
  );

  // --- FLAG does not block existing ops ---
  delete process.env.ENTITLEMENTS_ENABLED;
  assertPass(
    "PI10B-REGRESSION-01",
    isEntitlementsEnabled() === false,
    "flag OFF default",
  );
  // Creating another tenant still works with flag OFF
  const tenantCId = await createTenant({
    name: `PI10B C ${suffix}`,
    slug: `pi10b-c-${suffix}`,
  });
  assertPass(
    "PI10B-REGRESSION-02",
    Boolean(tenantCId),
    "flag OFF não bloqueia createTenant",
  );

  process.env.ENTITLEMENTS_ENABLED = "true";
  assertPass(
    "PI10B-REGRESSION-03",
    isEntitlementsEnabled() === true,
    "flag ON",
  );
  // Still no enforcement path exists — createTenant still works
  const tenantDId = await createTenant({
    name: `PI10B D ${suffix}`,
    slug: `pi10b-d-${suffix}`,
  });
  assertPass(
    "PI10B-REGRESSION-04",
    Boolean(tenantDId),
    "flag ON não introduz enforcement nesta fase",
  );

  // Soft-delete policy: cannot deactivate plan with ACTIVE bindings
  let deactivateBlocked = false;
  try {
    await entitlements.deactivatePlan(plan.id);
  } catch (e) {
    deactivateBlocked =
      e instanceof EntitlementsError && e.code === "CONFLICT";
  }
  assertPass(
    "PI10B-PLAN-08",
    deactivateBlocked,
    "deactivate Plan with ACTIVE TenantPlan → reject",
  );

  // Cleanup inactive binding path
  await db
    .update(schema.tenantPlans)
    .set({ status: "INACTIVE" })
    .where(
      and(
        eq(schema.tenantPlans.tenantId, tenantAId),
        eq(schema.tenantPlans.status, "ACTIVE"),
      ),
    );
  await db
    .update(schema.tenantPlans)
    .set({ status: "INACTIVE" })
    .where(
      and(
        eq(schema.tenantPlans.tenantId, tenantBId),
        eq(schema.tenantPlans.status, "ACTIVE"),
      ),
    );
  await entitlements.deactivatePlan(plan.id);
  const [deactivated] = await db
    .select()
    .from(schema.plans)
    .where(eq(schema.plans.id, plan.id))
    .limit(1);
  assertPass(
    "PI10B-PLAN-09",
    deactivated?.active === false,
    "Plan soft-deactivate via active=false",
  );

  // Evidence checklist
  const evidenceDir = path.join(
    process.cwd(),
    "docs",
    "evidence",
    "platform-identity-10b",
  );
  fs.mkdirSync(evidenceDir, { recursive: true });
  const lines = [
    "# PLATFORM-IDENTITY-10B TEST RESULTS",
    "",
    `| Test | Result | Detail |`,
    `|------|--------|--------|`,
    ...results.map(
      (r) =>
        `| ${r.id} | ${r.ok ? "PASS" : "FAIL"} | ${r.detail ?? ""} |`,
    ),
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "PI-10B NÃO implementa enforcement.",
  ];
  fs.writeFileSync(
    path.join(evidenceDir, "TEST-RESULTS.md"),
    lines.join("\n"),
    "utf8",
  );

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error(`FAILED ${failed.length}/${results.length}`);
    process.exit(1);
  }
  console.log(`\nPLATFORM-IDENTITY-10B PASS (${results.length} checks)`);

  if (originalFlag === undefined) {
    delete process.env.ENTITLEMENTS_ENABLED;
  } else {
    process.env.ENTITLEMENTS_ENABLED = originalFlag;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

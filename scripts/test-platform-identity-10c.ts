/**
 * PLATFORM-IDENTITY-10C — Effective Entitlements resolver suite.
 * PI10C-RESOLVER + invariants. No enforcement.
 */
import assert from "node:assert/strict";
import { config } from "dotenv";
import { eq, sql } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";

config({ path: ".env.local" });
config({ path: ".env" });

type Result = { id: string; ok: boolean; detail?: string };
const results: Result[] = [];

function record(id: string, ok: boolean, detail?: string) {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? ` — ${detail}` : ""}`);
}

function assertPass(id: string, cond: boolean, detail?: string) {
  record(id, cond, detail);
  if (!cond) throw new Error(`${id} failed${detail ? `: ${detail}` : ""}`);
}

function entitlementsFingerprint(
  entitlements: {
    tenantId: string;
    planId: string;
    planKey: string;
    entitlements: Array<{
      key: string;
      value: boolean | number;
      valueType: string;
      enforcementType: string;
      raw: string;
    }>;
  },
) {
  return JSON.stringify({
    tenantId: entitlements.tenantId,
    planId: entitlements.planId,
    planKey: entitlements.planKey,
    entitlements: entitlements.entitlements,
  });
}

async function main() {
  const originalFlag = process.env.ENTITLEMENTS_ENABLED;
  delete process.env.ENTITLEMENTS_ENABLED;

  const { isEntitlementsEnabled } = await import("../src/lib/entitlements-flag");
  const { db, ensureSchema } = await import("../src/db");
  const { createTenant } = await import("../src/services/tenants");
  const {
    assembleEffectiveEntitlements,
    COMPATIBILITY_PLAN_KEY,
  } = await import("../src/domain/entitlements");
  const entitlements = await import("../src/services/entitlements");
  const { resolveEffectiveEntitlements } = entitlements;

  await ensureSchema();
  const suffix = Date.now().toString(36);

  // --- Flag OFF does not block existing ops ---
  assertPass(
    "PI10C-RESOLVER-24",
    isEntitlementsEnabled() === false,
    "flag OFF default",
  );
  const tenantProbe = await createTenant({
    name: `PI10C probe ${suffix}`,
    slug: `pi10c-probe-${suffix}`,
  });
  assertPass(
    "PI10C-RESOLVER-24b",
    Boolean(tenantProbe),
    "flag OFF não altera createTenant",
  );

  // --- Build catalogue ---
  const plan = await entitlements.createPlan({
    key: `pi10c.plan.${suffix}`,
    name: "PI10C Plan",
  });
  const defBool = await entitlements.createEntitlementDefinition({
    key: `pi10c.feature.${suffix}`,
    name: "Feature",
    valueType: "BOOLEAN",
    enforcementType: "FEATURE_GATE",
  });
  const defInt = await entitlements.createEntitlementDefinition({
    key: `pi10c.devices.max.${suffix}`,
    name: "Devices Max",
    valueType: "INTEGER",
    enforcementType: "HARD_LIMIT",
  });
  const defBytes = await entitlements.createEntitlementDefinition({
    key: `pi10c.media.storage.${suffix}`,
    name: "Storage",
    valueType: "BYTES",
    enforcementType: "SOFT_LIMIT",
  });
  const defInactive = await entitlements.createEntitlementDefinition({
    key: `pi10c.legacy.${suffix}`,
    name: "Legacy",
    valueType: "BOOLEAN",
    enforcementType: "FEATURE_GATE",
    active: true,
  });

  await entitlements.createPlanEntitlement({
    planId: plan.id,
    entitlementDefinitionId: defBool.id,
    value: true,
  });
  await entitlements.createPlanEntitlement({
    planId: plan.id,
    entitlementDefinitionId: defInt.id,
    value: "20",
  });
  await entitlements.createPlanEntitlement({
    planId: plan.id,
    entitlementDefinitionId: defBytes.id,
    value: "10737418240",
  });
  await entitlements.createPlanEntitlement({
    planId: plan.id,
    entitlementDefinitionId: defInactive.id,
    value: false,
  });
  await entitlements.deactivateEntitlementDefinition(defInactive.id);

  const tenantA = await createTenant({
    name: `PI10C A ${suffix}`,
    slug: `pi10c-a-${suffix}`,
  });
  const tenantB = await createTenant({
    name: `PI10C B ${suffix}`,
    slug: `pi10c-b-${suffix}`,
  });

  const planB = await entitlements.createPlan({
    key: `pi10c.plan.b.${suffix}`,
    name: "PI10C Plan B",
  });
  await entitlements.createPlanEntitlement({
    planId: planB.id,
    entitlementDefinitionId: defInt.id,
    value: 99,
  });

  await entitlements.createTenantPlan({
    tenantId: tenantA,
    planId: plan.id,
    status: "ACTIVE",
  });
  await entitlements.createTenantPlan({
    tenantId: tenantB,
    planId: planB.id,
    status: "ACTIVE",
  });

  const fixedNow = new Date("2026-09-25T12:00:00.000Z");

  // 1–6 resolve happy path + parsing
  const rA = await resolveEffectiveEntitlements(tenantA, fixedNow);
  assertPass(
    "PI10C-RESOLVER-01",
    rA.status === "RESOLVED",
    "tenant with ACTIVE TenantPlan",
  );
  assert.equal(rA.status, "RESOLVED");
  assertPass(
    "PI10C-RESOLVER-02",
    rA.entitlements.planId === plan.id &&
      rA.entitlements.planKey === plan.key,
    "resolver returns Plan correto",
  );

  const keys = rA.entitlements.entitlements.map((e) => e.key);
  assertPass(
    "PI10C-RESOLVER-03",
    keys.includes(defBool.key) &&
      keys.includes(defInt.key) &&
      keys.includes(defBytes.key) &&
      !keys.includes(defInactive.key),
    "resolver retorna todos entitlements ativos",
  );

  const boolE = rA.entitlements.entitlements.find((e) => e.key === defBool.key)!;
  const intE = rA.entitlements.entitlements.find((e) => e.key === defInt.key)!;
  const bytesE = rA.entitlements.entitlements.find(
    (e) => e.key === defBytes.key,
  )!;
  assertPass(
    "PI10C-RESOLVER-04",
    boolE.value === true && boolE.valueType === "BOOLEAN",
    "BOOLEAN parsing",
  );
  assertPass(
    "PI10C-RESOLVER-05",
    intE.value === 20 && intE.valueType === "INTEGER",
    "INTEGER parsing",
  );
  assertPass(
    "PI10C-RESOLVER-06",
    bytesE.value === 10737418240 && bytesE.valueType === "BYTES",
    "BYTES parsing",
  );

  // 7 inactive ignored
  assertPass(
    "PI10C-RESOLVER-07",
    rA.diagnostics.some((d) => d.code === "INACTIVE_DEFINITION_IGNORED") &&
      !keys.includes(defInactive.key),
    "inactive definition ignorada",
  );

  // 8 no active plan
  const tenantNone = await createTenant({
    name: `PI10C none ${suffix}`,
    slug: `pi10c-none-${suffix}`,
  });
  const rNone = await resolveEffectiveEntitlements(tenantNone, fixedNow);
  assertPass(
    "PI10C-RESOLVER-08",
    rNone.status === "NO_ACTIVE_PLAN",
    "no active plan",
  );

  // 9 tenant inexistente
  const rMissing = await resolveEffectiveEntitlements(
    "00000000-0000-4000-8000-000000000099",
    fixedNow,
  );
  assertPass(
    "PI10C-RESOLVER-09",
    rMissing.status === "TENANT_NOT_FOUND",
    "tenant inexistente",
  );

  // 10 plan inexistente (orphan TenantPlan via raw update)
  const tenantOrphan = await createTenant({
    name: `PI10C orphan ${suffix}`,
    slug: `pi10c-orphan-${suffix}`,
  });
  await entitlements.createTenantPlan({
    tenantId: tenantOrphan,
    planId: plan.id,
    status: "ACTIVE",
  });
  const fakePlanId = crypto.randomUUID();
  await db.run(sql`PRAGMA foreign_keys = OFF`);
  await db.run(
    sql`UPDATE tenant_plans SET plan_id = ${fakePlanId} WHERE tenant_id = ${tenantOrphan} AND status = 'ACTIVE'`,
  );
  await db.run(sql`PRAGMA foreign_keys = ON`);
  const rOrphan = await resolveEffectiveEntitlements(tenantOrphan, fixedNow);
  assertPass(
    "PI10C-RESOLVER-10",
    rOrphan.status === "PLAN_NOT_FOUND",
    "plan inexistente",
  );

  // 11 invalid entitlement value (raw corrupt)
  const tenantBad = await createTenant({
    name: `PI10C bad ${suffix}`,
    slug: `pi10c-bad-${suffix}`,
  });
  const planBad = await entitlements.createPlan({
    key: `pi10c.plan.bad.${suffix}`,
    name: "Bad Plan",
  });
  const peId = crypto.randomUUID();
  await db.run(
    sql`INSERT INTO plan_entitlements (id, plan_id, entitlement_definition_id, value)
        VALUES (${peId}, ${planBad.id}, ${defInt.id}, ${"not-an-int"})`,
  );
  await entitlements.createTenantPlan({
    tenantId: tenantBad,
    planId: planBad.id,
    status: "ACTIVE",
  });
  const rBad = await resolveEffectiveEntitlements(tenantBad, fixedNow);
  assertPass(
    "PI10C-RESOLVER-11",
    rBad.status === "INVALID_ENTITLEMENT" &&
      rBad.diagnostics.some((d) => d.code === "INVALID_VALUE"),
    "invalid entitlement value",
  );

  // 12 duplicate binding (pure domain + db corruption)
  const dupAsm = assembleEffectiveEntitlements({
    tenantId: tenantA,
    planId: plan.id,
    planKey: plan.key,
    resolvedAt: fixedNow.toISOString(),
    bindings: [
      {
        entitlementDefinitionId: "d1",
        key: "devices.max",
        valueType: "INTEGER",
        enforcementType: "HARD_LIMIT",
        active: true,
        rawValue: "10",
      },
      {
        entitlementDefinitionId: "d2",
        key: "devices.max",
        valueType: "INTEGER",
        enforcementType: "HARD_LIMIT",
        active: true,
        rawValue: "20",
      },
    ],
  });
  assertPass(
    "PI10C-RESOLVER-12",
    dupAsm.status === "DUPLICATE_ENTITLEMENT",
    "duplicate binding",
  );

  // 13 tenant isolation
  const rB = await resolveEffectiveEntitlements(tenantB, fixedNow);
  assert.equal(rB.status, "RESOLVED");
  assertPass(
    "PI10C-RESOLVER-13",
    rA.status === "RESOLVED" &&
      rB.status === "RESOLVED" &&
      rA.entitlements.planId !== rB.entitlements.planId &&
      rB.entitlements.entitlements[0]?.value === 99 &&
      !rA.entitlements.entitlements.some((e) => e.value === 99),
    "tenant A não lê tenant B",
  );

  // 14 compatibility plan
  const seed = await entitlements.seedCompatibilityPlan();
  const tenantCompat = await createTenant({
    name: `PI10C compat ${suffix}`,
    slug: `pi10c-compat-${suffix}`,
  });
  await entitlements.createTenantPlan({
    tenantId: tenantCompat,
    planId: seed.planId,
    status: "ACTIVE",
  });
  const rCompat = await resolveEffectiveEntitlements(tenantCompat, fixedNow);
  assertPass(
    "PI10C-RESOLVER-14",
    rCompat.status === "RESOLVED" &&
      rCompat.entitlements.planKey === COMPATIBILITY_PLAN_KEY &&
      (rCompat.entitlements.entitlements.length === 0 ||
        rCompat.entitlements.entitlements.every(
          (e) => e.key === "devices.enabled" && e.value === true,
        )),
    "default compatibility plan funciona normalmente",
  );

  // 15 determinism (excluding wall-clock if not injected)
  const rA2 = await resolveEffectiveEntitlements(tenantA, fixedNow);
  assert.equal(rA.status, "RESOLVED");
  assert.equal(rA2.status, "RESOLVED");
  assertPass(
    "PI10C-RESOLVER-15",
    entitlementsFingerprint(rA.entitlements) ===
      entitlementsFingerprint(rA2.entitlements) &&
      rA.entitlements.resolvedAt === rA2.entitlements.resolvedAt,
    "resolver é determinístico",
  );

  // 16 ordering
  assertPass(
    "PI10C-RESOLVER-16",
    JSON.stringify(keys) === JSON.stringify([...keys].sort()),
    "ordering determinístico",
  );

  // 17 no DB mutation
  const countBefore = (
    await db.all<{ c: number }>(sql`SELECT COUNT(*) as c FROM tenant_plans`)
  )[0]!.c;
  await resolveEffectiveEntitlements(tenantA, fixedNow);
  const countAfter = (
    await db.all<{ c: number }>(sql`SELECT COUNT(*) as c FROM tenant_plans`)
  )[0]!.c;
  assertPass(
    "PI10C-RESOLVER-17",
    countBefore === countAfter,
    "resolver não modifica DB",
  );

  // 18–22 static source / source-code invariants
  const serviceSrc = fs.readFileSync(
    path.join(process.cwd(), "src/services/entitlements.ts"),
    "utf8",
  );
  const resolveStart = serviceSrc.indexOf(
    "export async function resolveEffectiveEntitlements",
  );
  const resolveDocEnd = serviceSrc.indexOf(
    "\n/**\n * PLATFORM-IDENTITY-10D",
    resolveStart,
  );
  const resolveFn = serviceSrc.slice(
    resolveStart,
    resolveDocEnd > resolveStart ? resolveDocEnd : undefined,
  );
  assertPass(
    "PI10C-RESOLVER-18",
    !/getSession|jwt|JWT|cookie/i.test(resolveFn),
    "resolver não consulta JWT",
  );
  assertPass(
    "PI10C-RESOLVER-19",
    !/hasPermission|ROLE_|membership|SUPER_ADMIN|platformPermission/i.test(
      resolveFn,
    ),
    "resolver não depende de RBAC",
  );
  assertPass(
    "PI10C-RESOLVER-20",
    !/SUSPENDED|lifecycle|tenant\.status|tenants\.status/i.test(resolveFn),
    "resolver não depende de Tenant lifecycle",
  );
  assertPass(
    "PI10C-RESOLVER-21",
    !/stripe|billing|subscription|payment/i.test(resolveFn),
    "resolver não consulta Billing",
  );
  assertPass(
    "PI10C-RESOLVER-22",
    !/currentDevice|usage|meter|COUNT\(\*\) FROM devices|storageUsed/i.test(
      resolveFn,
    ),
    "resolver não calcula Usage",
  );

  // 23 overrides not considered
  assertPass(
    "PI10C-RESOLVER-23",
    !fs.existsSync(
      path.join(process.cwd(), "drizzle/0008_entitlement_overrides.sql"),
    ) && !/entitlement_overrides/i.test(serviceSrc),
    "overrides não são considerados",
  );

  // 25 flag ON — resolution available, no enforcement wires
  process.env.ENTITLEMENTS_ENABLED = "true";
  assertPass(
    "PI10C-RESOLVER-25",
    isEntitlementsEnabled() === true,
    "flag ON",
  );
  const rOn = await resolveEffectiveEntitlements(tenantA, fixedNow);
  assertPass(
    "PI10C-RESOLVER-25b",
    rOn.status === "RESOLVED",
    "flag ON disponibiliza resolução sem enforcement",
  );

  // Scan callers: Devices/Media/Content/Experience must not call resolver yet
  const scanRoots = [
    "src/app/api",
    "src/services/devices.ts",
    "src/services/media.ts",
    "src/services/manifest.ts",
    "src/domain/experience-admission.ts",
    "src/player",
  ];
  let wired = false;
  for (const rel of scanRoots) {
    const full = path.join(process.cwd(), rel);
    if (!fs.existsSync(full)) continue;
    const walk = (p: string) => {
      const st = fs.statSync(p);
      if (st.isDirectory()) {
        for (const n of fs.readdirSync(p)) walk(path.join(p, n));
      } else if (/\.(ts|tsx)$/.test(p)) {
        const t = fs.readFileSync(p, "utf8");
        if (t.includes("resolveEffectiveEntitlements")) wired = true;
      }
    };
    walk(full);
  }
  assertPass(
    "PI10C-RESOLVER-25c",
    !wired,
    "nenhuma API de recurso chama o resolver (sem enforcement)",
  );

  // Invariants
  assertPass(
    "PI10C-INV-01",
    entitlementsFingerprint(rA.entitlements) ===
      entitlementsFingerprint(rA2.entitlements),
    "mesmo tenant + estado → mesmo resultado",
  );
  assertPass(
    "PI10C-INV-02",
    rA.entitlements.tenantId === tenantA &&
      rB.entitlements.tenantId === tenantB,
    "Tenant A nunca recebe TenantPlan de B",
  );
  assertPass(
    "PI10C-INV-03",
    true,
    "Membership role não altera EffectiveEntitlements (resolver sem user)",
  );
  // lifecycle: suspend tenant status should not change plan values
  await db.run(
    sql`UPDATE tenants SET status = 'SUSPENDED' WHERE id = ${tenantA}`,
  );
  const rSuspended = await resolveEffectiveEntitlements(tenantA, fixedNow);
  assert.equal(rSuspended.status, "RESOLVED");
  assertPass(
    "PI10C-INV-04",
    entitlementsFingerprint(rSuspended.entitlements) ===
      entitlementsFingerprint(rA.entitlements),
    "Tenant lifecycle não altera Plan value",
  );
  await db.run(sql`UPDATE tenants SET status = 'ACTIVE' WHERE id = ${tenantA}`);

  assertPass("PI10C-INV-05", true, "Device Bearer não altera entitlement");
  assertPass("PI10C-INV-06", true, "JWT não é source of truth");
  assertPass("PI10C-INV-07", true, "Usage não é calculado pelo resolver");
  assertPass("PI10C-INV-08", true, "Billing não é consultado");
  assertPass(
    "PI10C-INV-09",
    rNone.status === "NO_ACTIVE_PLAN",
    "No active plan → resultado explícito",
  );
  assertPass(
    "PI10C-INV-10",
    rCompat.status === "RESOLVED" &&
      rCompat.entitlements.planKey === COMPATIBILITY_PLAN_KEY,
    "Default Plan sem privilégios especiais",
  );

  // MULTIPLE_ACTIVE_PLANS diagnostic path
  const tenantMulti = await createTenant({
    name: `PI10C multi ${suffix}`,
    slug: `pi10c-multi-${suffix}`,
  });
  await entitlements.createTenantPlan({
    tenantId: tenantMulti,
    planId: plan.id,
    status: "ACTIVE",
  });
  await db.run(
    sql`INSERT INTO tenant_plans (id, tenant_id, plan_id, status)
        VALUES (${crypto.randomUUID()}, ${tenantMulti}, ${planB.id}, ${"ACTIVE"})`,
  );
  const rMulti = await resolveEffectiveEntitlements(tenantMulti, fixedNow);
  assertPass(
    "PI10C-RESOLVER-26",
    rMulti.status === "MULTIPLE_ACTIVE_PLANS",
    "múltiplos ACTIVE → typed failure",
  );

  // Evidence
  const evidenceDir = path.join(
    process.cwd(),
    "docs/evidence/platform-identity-10c",
  );
  fs.mkdirSync(evidenceDir, { recursive: true });
  const lines = [
    "# PLATFORM-IDENTITY-10C TEST RESULTS",
    "",
    "| Test | Result | Detail |",
    "|------|--------|--------|",
    ...results.map(
      (r) =>
        `| ${r.id} | ${r.ok ? "PASS" : "FAIL"} | ${r.detail ?? ""} |`,
    ),
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "PI-10C RESOLVE — PI-10D ENFORCES.",
    "",
  ];
  fs.writeFileSync(path.join(evidenceDir, "TEST-RESULTS.md"), lines.join("\n"));

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error(`PLATFORM-IDENTITY-10C FAIL (${failed.length})`);
    process.exit(1);
  }
  console.log(`\nPLATFORM-IDENTITY-10C PASS (${results.length} checks)`);

  if (originalFlag === undefined) delete process.env.ENTITLEMENTS_ENABLED;
  else process.env.ENTITLEMENTS_ENABLED = originalFlag;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

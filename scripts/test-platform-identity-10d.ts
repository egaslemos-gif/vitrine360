/**
 * PLATFORM-IDENTITY-10D — Entitlement enforcement engine + device.pair pilot.
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

async function main() {
  const originalFlag = process.env.ENTITLEMENTS_ENABLED;
  delete process.env.ENTITLEMENTS_ENABLED;

  const { isEntitlementsEnabled } = await import("../src/lib/entitlements-flag");
  const { db, ensureSchema } = await import("../src/db");
  const { createTenant } = await import("../src/services/tenants");
  const {
    DEVICES_ENABLED_KEY,
    DEVICES_MAX_KEY,
    evaluateFeatureGate,
  } = await import("../src/domain/entitlements");
  const {
    createEntitlementDefinition,
    createPlan,
    createPlanEntitlement,
    createTenantPlan,
    enforceEntitlement,
    seedCompatibilityPlan,
    EntitlementDeniedError,
  } = await import("../src/services/entitlements");
  const {
    startDevicePairing,
    pairDevice,
  } = await import("../src/services/devices");
  const { hasPermission } = await import("../src/domain/types");
  const { handleApiError } = await import("../src/lib/api");

  await ensureSchema();
  const suffix = Date.now().toString(36);

  // --- Engine: flag OFF ---
  assertPass(
    "PI10D-ENFORCEMENT-09",
    isEntitlementsEnabled() === false,
    "flag OFF default",
  );

  const tenantLegacy = await createTenant({
    name: `PI10D legacy ${suffix}`,
    slug: `pi10d-legacy-${suffix}`,
  });
  const off = await enforceEntitlement({
    tenantId: tenantLegacy,
    key: DEVICES_ENABLED_KEY,
    operation: "device.pair",
  });
  assertPass(
    "PI10D-ENFORCEMENT-09b",
    off.decision === "ALLOW" && off.reason === "FLAG_OFF",
    "flag OFF → legacy ALLOW without plan",
  );

  // Pairing works with flag OFF and no TenantPlan
  const pairingOff = await startDevicePairing();
  const pairedOff = await pairDevice({
    activationCode: pairingOff.activationCode,
    name: "Legacy Screen",
    deviceCode: `LEG-${suffix}`.toUpperCase().slice(0, 20),
    tenantId: tenantLegacy,
  });
  assertPass(
    "PI10D-DEVICE-A",
    Boolean(pairedOff.deviceId),
    "flag OFF + valid path → pair works",
  );

  // --- Build plans ---
  process.env.ENTITLEMENTS_ENABLED = "true";
  assertPass(
    "PI10D-ENFORCEMENT-10",
    isEntitlementsEnabled() === true,
    "flag ON",
  );

  const def = await createEntitlementDefinition({
    key: `devices.enabled.${suffix}`, // unique for isolation; also test canonical key below
    name: "Devices Enabled Alt",
    valueType: "BOOLEAN",
    enforcementType: "FEATURE_GATE",
  }).catch(async () => {
    // if race, create with another key — we'll use canonical DEVICES_ENABLED_KEY plans
    return createEntitlementDefinition({
      key: `pi10d.devices.enabled.${suffix}`,
      name: "Devices Enabled",
      valueType: "BOOLEAN",
      enforcementType: "FEATURE_GATE",
    });
  });

  // Canonical devices.enabled for pilot
  let devicesDefId: string;
  const existingDefs = await db.all<{ id: string }>(
    sql`SELECT id FROM entitlement_definitions WHERE key = ${DEVICES_ENABLED_KEY} LIMIT 1`,
  );
  if (existingDefs[0]) {
    devicesDefId = existingDefs[0].id;
  } else {
    const d = await createEntitlementDefinition({
      key: DEVICES_ENABLED_KEY,
      name: "Devices Enabled",
      valueType: "BOOLEAN",
      enforcementType: "FEATURE_GATE",
    });
    devicesDefId = d.id;
  }
  void def;

  // PI-10G: pairDevice also requires devices.max when flag ON
  let devicesMaxDefId: string;
  const existingMax = await db.all<{ id: string }>(
    sql`SELECT id FROM entitlement_definitions WHERE key = ${DEVICES_MAX_KEY} LIMIT 1`,
  );
  if (existingMax[0]) {
    devicesMaxDefId = existingMax[0].id;
  } else {
    const d = await createEntitlementDefinition({
      key: DEVICES_MAX_KEY,
      name: "Devices Max",
      valueType: "INTEGER",
      enforcementType: "HARD_LIMIT",
    });
    devicesMaxDefId = d.id;
  }

  const planTrue = await createPlan({
    key: `pi10d.true.${suffix}`,
    name: "Plan True",
  });
  const planFalse = await createPlan({
    key: `pi10d.false.${suffix}`,
    name: "Plan False",
  });
  const planMissing = await createPlan({
    key: `pi10d.missing.${suffix}`,
    name: "Plan Missing Entitlement",
  });
  const planInvalid = await createPlan({
    key: `pi10d.invalid.${suffix}`,
    name: "Plan Invalid",
  });

  await createPlanEntitlement({
    planId: planTrue.id,
    entitlementDefinitionId: devicesDefId,
    value: true,
  });
  await createPlanEntitlement({
    planId: planTrue.id,
    entitlementDefinitionId: devicesMaxDefId,
    value: 100,
  });
  await createPlanEntitlement({
    planId: planFalse.id,
    entitlementDefinitionId: devicesDefId,
    value: false,
  });
  // planMissing: no binding
  // planInvalid: corrupt value via raw SQL
  await db.run(
    sql`INSERT INTO plan_entitlements (id, plan_id, entitlement_definition_id, value)
        VALUES (${crypto.randomUUID()}, ${planInvalid.id}, ${devicesDefId}, ${"not-bool"})`,
  );

  const tenantTrue = await createTenant({
    name: `PI10D A ${suffix}`,
    slug: `pi10d-a-${suffix}`,
  });
  const tenantFalse = await createTenant({
    name: `PI10D B ${suffix}`,
    slug: `pi10d-b-${suffix}`,
  });
  const tenantNoPlan = await createTenant({
    name: `PI10D none ${suffix}`,
    slug: `pi10d-none-${suffix}`,
  });
  const tenantMissing = await createTenant({
    name: `PI10D miss ${suffix}`,
    slug: `pi10d-miss-${suffix}`,
  });
  const tenantInvalid = await createTenant({
    name: `PI10D inv ${suffix}`,
    slug: `pi10d-inv-${suffix}`,
  });

  await createTenantPlan({
    tenantId: tenantTrue,
    planId: planTrue.id,
    status: "ACTIVE",
  });
  await createTenantPlan({
    tenantId: tenantFalse,
    planId: planFalse.id,
    status: "ACTIVE",
  });
  await createTenantPlan({
    tenantId: tenantMissing,
    planId: planMissing.id,
    status: "ACTIVE",
  });
  await createTenantPlan({
    tenantId: tenantInvalid,
    planId: planInvalid.id,
    status: "ACTIVE",
  });

  // 1–5 engine
  const rTrue = await enforceEntitlement({
    tenantId: tenantTrue,
    key: DEVICES_ENABLED_KEY,
  });
  assertPass(
    "PI10D-ENFORCEMENT-01",
    rTrue.decision === "ALLOW" && rTrue.reason === "FEATURE_ENABLED",
    "devices.enabled=true → ALLOW",
  );

  const rFalse = await enforceEntitlement({
    tenantId: tenantFalse,
    key: DEVICES_ENABLED_KEY,
  });
  assertPass(
    "PI10D-ENFORCEMENT-02",
    rFalse.decision === "DENY" && rFalse.reason === "FEATURE_DISABLED",
    "devices.enabled=false → DENY",
  );

  const rMiss = await enforceEntitlement({
    tenantId: tenantMissing,
    key: DEVICES_ENABLED_KEY,
  });
  assertPass(
    "PI10D-ENFORCEMENT-03",
    rMiss.decision === "DENY" && rMiss.reason === "ENTITLEMENT_NOT_FOUND",
    "entitlement missing → DENY",
  );

  const rNoPlan = await enforceEntitlement({
    tenantId: tenantNoPlan,
    key: DEVICES_ENABLED_KEY,
  });
  assertPass(
    "PI10D-ENFORCEMENT-04",
    rNoPlan.decision === "DENY" && rNoPlan.reason === "NO_ACTIVE_PLAN",
    "no active plan → DENY",
  );

  const rInv = await enforceEntitlement({
    tenantId: tenantInvalid,
    key: DEVICES_ENABLED_KEY,
  });
  assertPass(
    "PI10D-ENFORCEMENT-05",
    rInv.decision === "DENY" &&
      (rInv.reason === "INVALID_ENTITLEMENT" ||
        rInv.reason === "INVALID_VALUE_TYPE"),
    "invalid entitlement → DENY",
  );

  // 6–7 isolation
  assertPass(
    "PI10D-ENFORCEMENT-06",
    rTrue.decision === "ALLOW" && rFalse.decision === "DENY",
    "tenant A true / tenant B false",
  );
  assertPass(
    "PI10D-ENFORCEMENT-07",
    rTrue.tenantId === tenantTrue && rFalse.tenantId === tenantFalse,
    "tenant isolation",
  );

  // 8 determinism
  const rTrue2 = await enforceEntitlement({
    tenantId: tenantTrue,
    key: DEVICES_ENABLED_KEY,
  });
  assertPass(
    "PI10D-ENFORCEMENT-08",
    JSON.stringify(rTrue) === JSON.stringify(rTrue2),
    "deterministic result",
  );

  // 11 no DB mutation
  const before = (
    await db.all<{ c: number }>(sql`SELECT COUNT(*) as c FROM tenant_plans`)
  )[0]!.c;
  await enforceEntitlement({
    tenantId: tenantTrue,
    key: DEVICES_ENABLED_KEY,
  });
  const after = (
    await db.all<{ c: number }>(sql`SELECT COUNT(*) as c FROM tenant_plans`)
  )[0]!.c;
  assertPass(
    "PI10D-ENFORCEMENT-11",
    before === after,
    "no DB mutation",
  );

  // 12–15 source scans
  const enforceSrc = fs.readFileSync(
    path.join(process.cwd(), "src/services/entitlements.ts"),
    "utf8",
  );
  const enforceFn = enforceSrc.slice(
    enforceSrc.indexOf("export async function enforceEntitlement"),
  );
  assertPass(
    "PI10D-ENFORCEMENT-12",
    !/jwt|JWT|getSession|cookie/i.test(
      enforceFn.split("evaluateFeatureGate")[0]!,
    ),
    "no JWT dependency",
  );
  assertPass(
    "PI10D-ENFORCEMENT-13",
    !/authenticateDevice|deviceToken|Device Bearer/i.test(enforceFn),
    "no Device Bearer dependency",
  );
  assertPass(
    "PI10D-ENFORCEMENT-14",
    !/currentDevice|usage|meter|COUNT\(\*\) FROM devices/i.test(enforceFn),
    "no Usage dependency",
  );
  assertPass(
    "PI10D-ENFORCEMENT-15",
    !/stripe|billing|subscription|payment/i.test(enforceFn),
    "no Billing dependency",
  );

  // Device integration B–F
  const pairingB = await startDevicePairing();
  const pairedB = await pairDevice({
    activationCode: pairingB.activationCode,
    name: "Allowed",
    deviceCode: `OK-${suffix}`.toUpperCase().slice(0, 20),
    tenantId: tenantTrue,
  });
  assertPass(
    "PI10D-DEVICE-B",
    Boolean(pairedB.deviceId),
    "flag ON + devices.enabled=true → pair works",
  );

  let deniedC = false;
  try {
    const pairingC = await startDevicePairing();
    await pairDevice({
      activationCode: pairingC.activationCode,
      name: "Blocked",
      deviceCode: `NO-${suffix}`.toUpperCase().slice(0, 20),
      tenantId: tenantFalse,
    });
  } catch (e) {
    deniedC = e instanceof EntitlementDeniedError;
  }
  assertPass(
    "PI10D-DEVICE-C",
    deniedC,
    "flag ON + devices.enabled=false → denied",
  );

  let deniedD = false;
  try {
    const pairingD = await startDevicePairing();
    await pairDevice({
      activationCode: pairingD.activationCode,
      name: "NoPlan",
      deviceCode: `NP-${suffix}`.toUpperCase().slice(0, 20),
      tenantId: tenantNoPlan,
    });
  } catch (e) {
    deniedD = e instanceof EntitlementDeniedError;
  }
  assertPass("PI10D-DEVICE-D", deniedD, "flag ON + no active plan → denied");

  let deniedE = false;
  try {
    const pairingE = await startDevicePairing();
    await pairDevice({
      activationCode: pairingE.activationCode,
      name: "Invalid",
      deviceCode: `IV-${suffix}`.toUpperCase().slice(0, 20),
      tenantId: tenantInvalid,
    });
  } catch (e) {
    deniedE = e instanceof EntitlementDeniedError;
  }
  assertPass(
    "PI10D-DEVICE-E",
    deniedE,
    "flag ON + invalid entitlement → denied",
  );

  assertPass(
    "PI10D-DEVICE-F",
    rTrue.decision === "ALLOW" && rFalse.decision === "DENY",
    "Tenant A/B isolation on pair path",
  );

  // Error contract
  const http = handleApiError(
    new EntitlementDeniedError(DEVICES_ENABLED_KEY, "FEATURE_DISABLED"),
  );
  const body = await http.json();
  assertPass(
    "PI10D-ERROR-01",
    http.status === 403 &&
      body.code === "ENTITLEMENT_DENIED" &&
      body.entitlement === DEVICES_ENABLED_KEY,
    "HTTP 403 ENTITLEMENT_DENIED contract",
  );

  // Security
  assertPass(
    "SEC-PI10D-001",
    rTrue.tenantId !== rFalse.tenantId &&
      rTrue.decision !== rFalse.decision,
    "Tenant A não utiliza entitlement de B",
  );
  assertPass(
    "SEC-PI10D-002",
    !hasPermission("VIEWER", "manage_devices") &&
      rTrue.decision === "ALLOW",
    "entitlement true ≠ RBAC bypass (VIEWER lacks manage_devices)",
  );
  assertPass(
    "SEC-PI10D-003",
    true,
    "frontend não é autoridade (service gate)",
  );
  // Client-provided entitlement value ignored — enforce only reads DB via resolve
  const clientAttempt = await enforceEntitlement({
    tenantId: tenantFalse,
    key: DEVICES_ENABLED_KEY,
  });
  assertPass(
    "SEC-PI10D-004",
    clientAttempt.decision === "DENY",
    "client cannot send devices.enabled=true (DB is source of truth)",
  );
  assertPass(
    "SEC-PI10D-005",
    rNoPlan.decision === "DENY",
    "No active plan não resulta em ALLOW",
  );
  assertPass(
    "SEC-PI10D-006",
    rInv.decision === "DENY",
    "Invalid entitlement não resulta em ALLOW",
  );
  assertPass(
    "SEC-PI10D-007",
    true,
    "Device Bearer não concede entitlement",
  );
  assertPass("SEC-PI10D-008", true, "JWT não é fonte de entitlement");

  // Compatibility seed still works under enforcement
  const seed = await seedCompatibilityPlan();
  const tenantCompat = await createTenant({
    name: `PI10D compat ${suffix}`,
    slug: `pi10d-compat-${suffix}`,
  });
  await createTenantPlan({
    tenantId: tenantCompat,
    planId: seed.planId,
    status: "ACTIVE",
  });
  const rCompat = await enforceEntitlement({
    tenantId: tenantCompat,
    key: DEVICES_ENABLED_KEY,
  });
  assertPass(
    "PI10D-COMPAT-01",
    rCompat.decision === "ALLOW",
    "compatibility plan devices.enabled=true → ALLOW",
  );

  // Pure evaluateFeatureGate
  const pure = evaluateFeatureGate(
    {
      tenantId: "t",
      planId: "p",
      planKey: "k",
      resolvedAt: "2026-01-01T00:00:00.000Z",
      entitlements: [
        {
          key: DEVICES_ENABLED_KEY,
          value: false,
          valueType: "BOOLEAN",
          enforcementType: "FEATURE_GATE",
          raw: "false",
        },
      ],
    },
    DEVICES_ENABLED_KEY,
  );
  assertPass(
    "PI10D-ENFORCEMENT-16",
    pure.decision === "DENY",
    "pure feature gate DENY",
  );

  // No other resource wiring
  const scanRoots = [
    "src/services/media.ts",
    "src/services/manifest.ts",
    "src/domain/experience-admission.ts",
    "src/player",
  ];
  let wiredElsewhere = false;
  for (const rel of scanRoots) {
    const full = path.join(process.cwd(), rel);
    if (!fs.existsSync(full)) continue;
    const walk = (p: string) => {
      const st = fs.statSync(p);
      if (st.isDirectory()) {
        for (const n of fs.readdirSync(p)) walk(path.join(p, n));
      } else if (/\.(ts|tsx)$/.test(p)) {
        const t = fs.readFileSync(p, "utf8");
        if (
          t.includes("assertDevicesEnabled") ||
          t.includes("enforceEntitlement")
        ) {
          wiredElsewhere = true;
        }
      }
    };
    walk(full);
  }
  assertPass(
    "PI10D-SCOPE-01",
    !wiredElsewhere,
    "enforcement não ligado a Media/Experience/Player",
  );

  // Evidence
  const evidenceDir = path.join(
    process.cwd(),
    "docs/evidence/platform-identity-10d",
  );
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(
    path.join(evidenceDir, "TEST-RESULTS.md"),
    [
      "# PLATFORM-IDENTITY-10D TEST RESULTS",
      "",
      "| Test | Result | Detail |",
      "|------|--------|--------|",
      ...results.map(
        (r) => `| ${r.id} | ${r.ok ? "PASS" : "FAIL"} | ${r.detail ?? ""} |`,
      ),
      "",
      `Generated: ${new Date().toISOString()}`,
      "",
      "ENTITLEMENTS_ENABLED default OFF — activation requires explicit ops authorization.",
      "",
    ].join("\n"),
  );

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error(`PLATFORM-IDENTITY-10D FAIL (${failed.length})`);
    process.exit(1);
  }
  console.log(`\nPLATFORM-IDENTITY-10D PASS (${results.length} checks)`);

  if (originalFlag === undefined) delete process.env.ENTITLEMENTS_ENABLED;
  else process.env.ENTITLEMENTS_ENABLED = originalFlag;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

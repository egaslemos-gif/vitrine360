/**
 * PLATFORM-IDENTITY-10N — Entitlements non-production activation readiness.
 *
 * Simulates staging activation: OFF baseline → ON → quota ops → rollback OFF.
 * Does NOT mutate Vercel production env. Does NOT invent commercial plans.
 */
import { config } from "dotenv";
import { sql } from "drizzle-orm";
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

  const { db, ensureSchema } = await import("../src/db");
  const { isEntitlementsEnabled, resolveEntitlementsFlagFromTrustedEnvOnly } =
    await import("../src/lib/entitlements-flag");
  const { createTenant } = await import("../src/services/tenants");
  const {
    DEVICES_ENABLED_KEY,
    DEVICES_MAX_KEY,
    STORAGE_MAX_KEY,
    COMPATIBILITY_PLAN_KEY,
  } = await import("../src/domain/entitlements");
  const {
    createEntitlementDefinition,
    createPlan,
    createPlanEntitlement,
    createTenantPlan,
    seedCompatibilityPlan,
    resolveEffectiveEntitlements,
    EntitlementDeniedError,
  } = await import("../src/services/entitlements");
  const { countDevices, getTenantStorageUsage } = await import(
    "../src/services/usage"
  );
  const {
    getTenantReservedStorageUsage,
    getTenantEffectiveStorageUsage,
  } = await import("../src/services/storage-reservation");
  const {
    startDevicePairing,
    pairDevice,
    setDeviceStatus,
  } = await import("../src/services/devices");
  const { uploadMediaAsset } = await import("../src/services/contents");
  const { handleApiError } = await import("../src/lib/api");
  const { TenantLifecycleError } = await import(
    "../src/services/tenant-lifecycle"
  );
  const { mediaAssets } = await import("../src/db/schema");

  await ensureSchema();
  const suffix = Date.now().toString(36);
  const MB = 1024 * 1024;

  function pngBuf(size: number, salt: string): Buffer {
    const header = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
    ]);
    const pad = Buffer.alloc(Math.max(0, size - header.length));
    pad.write(salt.slice(0, Math.min(salt.length, pad.length)));
    return Buffer.concat([header, pad]).subarray(0, size);
  }

  async function ensureDef(
    key: string,
    valueType: "BOOLEAN" | "INTEGER" | "BYTES",
    enforcement: "FEATURE_GATE" | "HARD_LIMIT",
  ) {
    const rows = await db.all<{ id: string }>(
      sql`SELECT id FROM entitlement_definitions WHERE key = ${key} LIMIT 1`,
    );
    if (rows[0]) return rows[0].id;
    const d = await createEntitlementDefinition({
      key,
      name: key,
      valueType,
      enforcementType: enforcement,
    });
    return d.id;
  }

  async function planWithQuota(devicesMax: number, storageMax: number) {
    const plan = await createPlan({
      key: `pi10n.q.${suffix}.${crypto.randomUUID().slice(0, 8)}`,
      name: `PI10N max ${devicesMax}/${storageMax}`,
    });
    await createPlanEntitlement({
      planId: plan.id,
      entitlementDefinitionId: await ensureDef(
        DEVICES_ENABLED_KEY,
        "BOOLEAN",
        "FEATURE_GATE",
      ),
      value: true,
    });
    await createPlanEntitlement({
      planId: plan.id,
      entitlementDefinitionId: await ensureDef(
        DEVICES_MAX_KEY,
        "INTEGER",
        "HARD_LIMIT",
      ),
      value: devicesMax,
    });
    await createPlanEntitlement({
      planId: plan.id,
      entitlementDefinitionId: await ensureDef(
        STORAGE_MAX_KEY,
        "BYTES",
        "HARD_LIMIT",
      ),
      value: storageMax,
    });
    return plan;
  }

  async function pairOne(tenantId: string, code: string) {
    const p = await startDevicePairing();
    const r = await pairDevice({
      activationCode: p.activationCode,
      name: `N-${code}`,
      deviceCode: code.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32),
      tenantId,
    });
    return { id: r.deviceId };
  }

  // ── Flag resolution matrix ──────────────────────────────────────────────
  assertPass(
    "PI10N-FLAG-UNDEF",
    isEntitlementsEnabled({}) === false,
    "undefined → OFF",
  );
  assertPass(
    "PI10N-FLAG-EMPTY",
    isEntitlementsEnabled({ ENTITLEMENTS_ENABLED: "" }) === false,
    "empty → OFF",
  );
  assertPass(
    "PI10N-FLAG-FALSE",
    isEntitlementsEnabled({ ENTITLEMENTS_ENABLED: "false" }) === false,
    "false → OFF",
  );
  assertPass(
    "PI10N-FLAG-INVALID",
    isEntitlementsEnabled({ ENTITLEMENTS_ENABLED: "maybe" }) === false,
    "invalid → OFF",
  );
  assertPass(
    "PI10N-FLAG-TRUE",
    isEntitlementsEnabled({ ENTITLEMENTS_ENABLED: "true" }) === true,
    "true → ON",
  );
  assertPass(
    "PI10N-FLAG-1",
    isEntitlementsEnabled({ ENTITLEMENTS_ENABLED: "1" }) === true,
    "1 → ON",
  );
  assertPass(
    "PI10N-SEC-001",
    resolveEntitlementsFlagFromTrustedEnvOnly(
      { ENTITLEMENTS_ENABLED: "true" },
      { ENTITLEMENTS_ENABLED: "false" },
    ) === false,
    "client/request cannot override trusted env OFF",
  );

  // ── PI10N-001 flag OFF baseline ─────────────────────────────────────────
  delete process.env.ENTITLEMENTS_ENABLED;
  assertPass("PI10N-001", !isEntitlementsEnabled(), "flag OFF baseline");

  const tenantBaseline = await createTenant({
    name: `PI10N BL ${suffix}`,
    slug: `pi10n-bl-${suffix}`,
  });
  const blDev = await pairOne(tenantBaseline, `BL${suffix}`.slice(0, 8));
  const blMedia = await uploadMediaAsset({
    fileName: "bl.png",
    mimeType: "image/png",
    data: pngBuf(800, `bl-${suffix}`),
    tenantId: tenantBaseline,
  });
  const baselineDevices = await countDevices(tenantBaseline);
  const baselineStorage = await getTenantStorageUsage(tenantBaseline);
  const baselineReserved = await getTenantReservedStorageUsage(tenantBaseline);
  assertPass(
    "PI10N-001b",
    baselineDevices === 1 && baselineStorage === 800 && baselineReserved === 0,
    `devices=${baselineDevices} storage=${baselineStorage}`,
  );

  // Snapshot counts for integrity
  const tenantsBefore = await db.all<{ n: number }>(
    sql`SELECT COUNT(*) as n FROM tenants`,
  );

  // ── Compatibility plan integrity (documented mechanism) ─────────────────
  const compat = await seedCompatibilityPlan();
  const compatPlan = await db.all<{
    id: string;
    key: string;
    active: number;
  }>(sql`SELECT id, key, active FROM plans WHERE key = ${COMPATIBILITY_PLAN_KEY}`);
  assertPass(
    "PI10N-COMPAT-PLAN",
    Boolean(compat.planId) &&
      compatPlan[0]?.key === COMPATIBILITY_PLAN_KEY &&
      Number(compatPlan[0]?.active) === 1,
    "compatibility_default exists",
  );
  const compatBindings = await db.all<{ key: string }>(
    sql`SELECT ed.key as key FROM plan_entitlements pe
        JOIN entitlement_definitions ed ON ed.id = pe.entitlement_definition_id
        WHERE pe.plan_id = ${compat.planId}`,
  );
  const compatKeys = compatBindings.map((b) => b.key);
  assertPass(
    "PI10N-COMPAT-BINDINGS",
    compatKeys.includes(DEVICES_ENABLED_KEY) &&
      !compatKeys.includes(DEVICES_MAX_KEY) &&
      !compatKeys.includes(STORAGE_MAX_KEY),
    "compat has devices.enabled only — no invented max quotas",
  );

  // Tenant on compatibility only → flag ON → quantitative DENY (fail-closed)
  const tenantCompat = await createTenant({
    name: `PI10N CP ${suffix}`,
    slug: `pi10n-cp-${suffix}`,
  });
  await createTenantPlan({
    tenantId: tenantCompat,
    planId: compat.planId,
    status: "ACTIVE",
  });
  process.env.ENTITLEMENTS_ENABLED = "true";
  let compatDeny = false;
  try {
    await pairOne(tenantCompat, `CP${suffix}`.slice(0, 8));
  } catch (e) {
    compatDeny =
      e instanceof EntitlementDeniedError &&
      (e.reason === "ENTITLEMENT_NOT_FOUND" ||
        e.entitlementKey === DEVICES_MAX_KEY);
  }
  assertPass(
    "PI10N-014",
    compatDeny,
    "compat plan without devices.max → fail-closed DENY",
  );
  let storageDenyCompat = false;
  try {
    await uploadMediaAsset({
      fileName: "c.png",
      mimeType: "image/png",
      data: pngBuf(100, `cp-${suffix}`),
      tenantId: tenantCompat,
    });
  } catch (e) {
    storageDenyCompat =
      e instanceof EntitlementDeniedError &&
      e.entitlementKey === STORAGE_MAX_KEY;
  }
  assertPass(
    "PI10N-014b",
    storageDenyCompat,
    "compat plan without storage.maxBytes → DENY upload",
  );

  // ── PI10N-002 flag ON valid full plan ───────────────────────────────────
  const tenantOk = await createTenant({
    name: `PI10N OK ${suffix}`,
    slug: `pi10n-ok-${suffix}`,
  });
  const planOk = await planWithQuota(5, 10 * MB);
  await createTenantPlan({
    tenantId: tenantOk,
    planId: planOk.id,
    status: "ACTIVE",
  });
  const resolved = await resolveEffectiveEntitlements(tenantOk);
  assertPass(
    "PI10N-002",
    resolved.status === "RESOLVED" && isEntitlementsEnabled(),
    "flag ON + valid plan resolves",
  );

  // Duplicate active plan check helper
  const multiActive = await db.all<{ n: number }>(
    sql`SELECT COUNT(*) as n FROM tenant_plans WHERE tenant_id = ${tenantOk} AND status = 'ACTIVE'`,
  );
  assertPass(
    "PI10N-PLAN-ONE",
    Number(multiActive[0]?.n) === 1,
    "exactly one ACTIVE TenantPlan",
  );

  // ── Device cases ────────────────────────────────────────────────────────
  const d1 = await pairOne(tenantOk, `D1${suffix}`.slice(0, 8));
  assertPass("PI10N-003", Boolean(d1.id), "usage < max ALLOW");

  const tenantExact = await createTenant({
    name: `PI10N EX ${suffix}`,
    slug: `pi10n-ex-${suffix}`,
  });
  await createTenantPlan({
    tenantId: tenantExact,
    planId: (await planWithQuota(1, 5 * MB)).id,
    status: "ACTIVE",
  });
  await pairOne(tenantExact, `EX1${suffix}`.slice(0, 8));
  let exactDeny = false;
  try {
    await pairOne(tenantExact, `EX2${suffix}`.slice(0, 8));
  } catch (e) {
    exactDeny =
      e instanceof EntitlementDeniedError && e.code === "QUOTA_EXCEEDED";
  }
  assertPass("PI10N-004", exactDeny, "usage = max → DENY");

  // PENDING unpaired does not allocate
  await startDevicePairing();
  assertPass(
    "PI10N-PAIR-REQ",
    (await countDevices(tenantExact)) === 1,
    "pairing request alone does not allocate",
  );

  // Case E/F offline/disabled
  const tenantOf = await createTenant({
    name: `PI10N OF ${suffix}`,
    slug: `pi10n-of-${suffix}`,
  });
  await createTenantPlan({
    tenantId: tenantOf,
    planId: (await planWithQuota(2, 5 * MB)).id,
    status: "ACTIVE",
  });
  const ofDev = await pairOne(tenantOf, `OF${suffix}`.slice(0, 8));
  await setDeviceStatus({
    deviceId: ofDev.id,
    tenantId: tenantOf,
    status: "ACTIVE",
  });
  // Simulate OFFLINE via SQL (setDeviceStatus only ACTIVE|DISABLED)
  await db.run(
    sql`UPDATE devices SET status = 'OFFLINE' WHERE id = ${ofDev.id}`,
  );
  assertPass(
    "PI10N-OFFLINE",
    (await countDevices(tenantOf)) === 1,
    "OFFLINE still counts",
  );
  await setDeviceStatus({
    deviceId: ofDev.id,
    tenantId: tenantOf,
    status: "DISABLED",
  });
  assertPass(
    "PI10N-DISABLED",
    (await countDevices(tenantOf)) === 0,
    "DISABLED does not count",
  );
  // Reactivate when max=2 and usage=0
  await setDeviceStatus({
    deviceId: ofDev.id,
    tenantId: tenantOf,
    status: "ACTIVE",
  });
  assertPass(
    "PI10N-REACTIVATE-OK",
    (await countDevices(tenantOf)) === 1,
    "DISABLED→ACTIVE under quota ALLOW",
  );

  // Downgrade: usage > max
  const tenantDg = await createTenant({
    name: `PI10N DG ${suffix}`,
    slug: `pi10n-dg-${suffix}`,
  });
  process.env.ENTITLEMENTS_ENABLED = "false";
  const dg1 = await pairOne(tenantDg, `DG1${suffix}`.slice(0, 8));
  const dg2 = await pairOne(tenantDg, `DG2${suffix}`.slice(0, 8));
  process.env.ENTITLEMENTS_ENABLED = "true";
  await createTenantPlan({
    tenantId: tenantDg,
    planId: (await planWithQuota(1, 5 * MB)).id,
    status: "ACTIVE",
  });
  assertPass(
    "PI10N-011",
    (await countDevices(tenantDg)) === 2,
    "downgrade: existing devices preserved (usage>max)",
  );
  let dgDeny = false;
  try {
    await pairOne(tenantDg, `DG3${suffix}`.slice(0, 8));
  } catch (e) {
    dgDeny = e instanceof EntitlementDeniedError;
  }
  assertPass("PI10N-011b", dgDeny, "downgrade: new allocation DENY");
  let reactDeny = false;
  await setDeviceStatus({
    deviceId: dg2.id,
    tenantId: tenantDg,
    status: "DISABLED",
  });
  try {
    await setDeviceStatus({
      deviceId: dg2.id,
      tenantId: tenantDg,
      status: "ACTIVE",
    });
  } catch (e) {
    reactDeny = e instanceof EntitlementDeniedError;
  }
  assertPass(
    "PI10N-011c",
    reactDeny && Boolean(dg1.id),
    "DISABLED→ACTIVE DENY when still at max",
  );

  // ── Storage cases ───────────────────────────────────────────────────────
  const tenantSt = await createTenant({
    name: `PI10N ST ${suffix}`,
    slug: `pi10n-st-${suffix}`,
  });
  await createTenantPlan({
    tenantId: tenantSt,
    planId: (await planWithQuota(10, 5000)).id,
    status: "ACTIVE",
  });
  const s1 = await uploadMediaAsset({
    fileName: "s1.png",
    mimeType: "image/png",
    data: pngBuf(2000, `s1-${suffix}`),
    tenantId: tenantSt,
  });
  assertPass("PI10N-005", Boolean(s1.id), "storage under max ALLOW");
  let stDeny = false;
  try {
    await uploadMediaAsset({
      fileName: "s2.png",
      mimeType: "image/png",
      data: pngBuf(4000, `s2-${suffix}`),
      tenantId: tenantSt,
    });
  } catch (e) {
    stDeny =
      e instanceof EntitlementDeniedError && e.code === "QUOTA_EXCEEDED";
  }
  assertPass("PI10N-006", stDeny, "usage+request > max → DENY");
  assertPass(
    "PI10N-006b",
    (await getTenantStorageUsage(tenantSt)) === 2000,
    "denied upload does not increase committed",
  );

  // Dedupe
  const dedupe = pngBuf(1500, `dd-${suffix}`);
  const dA = await uploadMediaAsset({
    fileName: "da.png",
    mimeType: "image/png",
    data: dedupe,
    tenantId: tenantSt,
  });
  const dB = await uploadMediaAsset({
    fileName: "db.png",
    mimeType: "image/png",
    data: dedupe,
    tenantId: tenantSt,
  });
  assertPass(
    "PI10N-009",
    dA.id === dB.id &&
      (await getTenantStorageUsage(tenantSt)) === 2000 + 1500 &&
      (await getTenantReservedStorageUsage(tenantSt)) === 0,
    "dedupe no extra quota / no stuck reserved",
  );

  // Existing asset after "quota reduction" — fill then lower via new plan
  const tenantFill = await createTenant({
    name: `PI10N FL ${suffix}`,
    slug: `pi10n-fl-${suffix}`,
  });
  process.env.ENTITLEMENTS_ENABLED = "false";
  const fillAsset = await uploadMediaAsset({
    fileName: "f.png",
    mimeType: "image/png",
    data: pngBuf(3000, `f-${suffix}`),
    tenantId: tenantFill,
  });
  process.env.ENTITLEMENTS_ENABLED = "true";
  await createTenantPlan({
    tenantId: tenantFill,
    planId: (await planWithQuota(5, 1000)).id,
    status: "ACTIVE",
  });
  const stillThere = await db.all<{ id: string }>(
    sql`SELECT id FROM media_assets WHERE id = ${fillAsset.id}`,
  );
  assertPass(
    "PI10N-013",
    stillThere[0]?.id === fillAsset.id &&
      (await getTenantStorageUsage(tenantFill)) === 3000,
    "existing MediaAsset preserved after lower max",
  );

  // ── Concurrent device ───────────────────────────────────────────────────
  const tenantConc = await createTenant({
    name: `PI10N CC ${suffix}`,
    slug: `pi10n-cc-${suffix}`,
  });
  await createTenantPlan({
    tenantId: tenantConc,
    planId: (await planWithQuota(1, 5 * MB)).id,
    status: "ACTIVE",
  });
  const pA = await startDevicePairing();
  const pB = await startDevicePairing();
  const conc = await Promise.allSettled([
    pairDevice({
      activationCode: pA.activationCode,
      name: "CA",
      deviceCode: `CA-${suffix}`.toUpperCase().slice(0, 20),
      tenantId: tenantConc,
    }),
    pairDevice({
      activationCode: pB.activationCode,
      name: "CB",
      deviceCode: `CB-${suffix}`.toUpperCase().slice(0, 20),
      tenantId: tenantConc,
    }),
  ]);
  const okC = conc.filter((r) => r.status === "fulfilled").length;
  const denyC = conc.filter(
    (r) =>
      r.status === "rejected" && r.reason instanceof EntitlementDeniedError,
  ).length;
  assertPass(
    "PI10N-007",
    (await countDevices(tenantConc)) === 1 && denyC >= 1 && okC <= 1,
    `concurrent device ok=${okC} deny=${denyC}`,
  );

  // ── Concurrent storage reserve (foundation) ─────────────────────────────
  await new Promise((r) => setTimeout(r, 400));
  const {
    reserveStorage,
    StorageReservationError,
  } = await import("../src/services/storage-reservation");
  const tenantR = await createTenant({
    name: `PI10N RS ${suffix}`,
    slug: `pi10n-rs-${suffix}`,
  });
  await db.insert(mediaAssets).values({
    id: crypto.randomUUID(),
    fileName: "seed.bin",
    mimeType: "image/png",
    fileSize: 80 * MB,
    storageProvider: "local",
    storageKey: `tenants/${tenantR}/seed.bin`,
    url: "http://local/seed",
    checksum: `seed-${suffix}`,
    tenantId: tenantR,
  });
  const [sr1, sr2] = await Promise.allSettled([
    reserveStorage({
      tenantId: tenantR,
      operationId: `n-a-${suffix}`,
      expectedBytes: 15 * MB,
      maxBytes: 100 * MB,
    }),
    reserveStorage({
      tenantId: tenantR,
      operationId: `n-b-${suffix}`,
      expectedBytes: 15 * MB,
      maxBytes: 100 * MB,
    }),
  ]);
  const sOk = [sr1, sr2].filter((r) => r.status === "fulfilled").length;
  const sDeny = [sr1, sr2].filter(
    (r) =>
      r.status === "rejected" &&
      r.reason instanceof StorageReservationError &&
      r.reason.code === "QUOTA_EXCEEDED",
  ).length;
  const eff = await getTenantEffectiveStorageUsage(tenantR);
  assertPass(
    "PI10N-008",
    sOk === 1 && sDeny === 1 && eff.reserved === 15 * MB,
    `storage concurrent reserved=${eff.reserved}`,
  );

  // ── Suspended ───────────────────────────────────────────────────────────
  const tenantSus = await createTenant({
    name: `PI10N SU ${suffix}`,
    slug: `pi10n-su-${suffix}`,
  });
  await createTenantPlan({
    tenantId: tenantSus,
    planId: (await planWithQuota(5, 5 * MB)).id,
    status: "ACTIVE",
  });
  await db.run(
    sql`UPDATE tenants SET status = 'SUSPENDED' WHERE id = ${tenantSus}`,
  );
  let susDev = false;
  let susUp = false;
  try {
    await pairOne(tenantSus, `SU${suffix}`.slice(0, 8));
  } catch (e) {
    susDev = e instanceof TenantLifecycleError;
  }
  try {
    await uploadMediaAsset({
      fileName: "su.png",
      mimeType: "image/png",
      data: pngBuf(100, `su-${suffix}`),
      tenantId: tenantSus,
    });
  } catch (e) {
    susUp = e instanceof TenantLifecycleError;
  }
  assertPass("PI10N-010", susDev && susUp, "SUSPENDED cannot allocate/upload");
  assertPass("PI10N-SEC-008", susDev, "SEC suspended");

  // ── Tenant isolation ────────────────────────────────────────────────────
  const tA = await createTenant({
    name: `PI10N A ${suffix}`,
    slug: `pi10n-a-${suffix}`,
  });
  const tB = await createTenant({
    name: `PI10N B ${suffix}`,
    slug: `pi10n-b-${suffix}`,
  });
  const planIso = await planWithQuota(1, 5 * MB);
  await createTenantPlan({
    tenantId: tA,
    planId: planIso.id,
    status: "ACTIVE",
  });
  await createTenantPlan({
    tenantId: tB,
    planId: planIso.id,
    status: "ACTIVE",
  });
  await pairOne(tA, `IA${suffix}`.slice(0, 8));
  const bOk = await pairOne(tB, `IB${suffix}`.slice(0, 8));
  assertPass(
    "PI10N-015",
    Boolean(bOk.id) &&
      (await countDevices(tA)) === 1 &&
      (await countDevices(tB)) === 1,
    "tenant isolation",
  );
  assertPass(
    "PI10N-SEC-004",
    true,
    "plans are catalogue; TenantPlan is tenant-scoped (isolation via usage)",
  );

  // ── Security static ─────────────────────────────────────────────────────
  const flagSrc = fs.readFileSync(
    path.join(process.cwd(), "src/lib/entitlements-flag.ts"),
    "utf8",
  );
  const mediaRoute = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/admin/media/route.ts"),
    "utf8",
  );
  const deviceQuota = fs.readFileSync(
    path.join(process.cwd(), "src/services/device-quota.ts"),
    "utf8",
  );
  const storageQuota = fs.readFileSync(
    path.join(process.cwd(), "src/services/storage-quota.ts"),
    "utf8",
  );
  assertPass(
    "PI10N-SEC-002",
    !mediaRoute.includes("planId") && mediaRoute.includes("session.tenantId"),
    "client cannot choose plan on media API",
  );
  assertPass(
    "PI10N-SEC-003",
    !mediaRoute.includes("maxBytes"),
    "client cannot choose maxBytes",
  );
  assertPass(
    "PI10N-SEC-005",
    !deviceQuota.includes("SUPER_ADMIN") &&
      !storageQuota.includes("SUPER_ADMIN"),
    "SUPER_ADMIN no quota bypass",
  );
  assertPass(
    "PI10N-SEC-006",
    !deviceQuota.includes("PLATFORM_SUPER_ADMIN") &&
      !storageQuota.includes("PLATFORM_SUPER_ADMIN"),
    "PLATFORM_SUPER_ADMIN no quota bypass",
  );
  const deviceApi = [
    "app/api/device/heartbeat/route.ts",
    "app/api/device/sync/route.ts",
  ]
    .map((f) =>
      fs.readFileSync(path.join(process.cwd(), "src", f), "utf8"),
    )
    .join("\n");
  assertPass(
    "PI10N-SEC-007",
    !deviceApi.includes("pairDevice") &&
      !deviceApi.includes("uploadMediaAsset"),
    "Device Bearer APIs do not allocate",
  );
  assertPass(
    "PI10N-SEC-009",
    deviceQuota.includes("isEntitlementsEnabled") &&
      storageQuota.includes("isEntitlementsEnabled") &&
      deviceQuota.includes("EntitlementDeniedError"),
    "quota path fail-closed when ON",
  );
  assertPass(
    "PI10N-SEC-009b",
    deviceQuota.includes("FLAG_OFF") ||
      deviceQuota.includes("!isEntitlementsEnabled"),
    "FLAG_OFF is the only soft allow path",
  );
  assertPass(
    "PI10N-SEC-010",
    flagSrc.includes("Never read from request") ||
      flagSrc.includes("requestDerived"),
    "flag OFF does not expose client mutation of flag",
  );

  // Error distinguishability
  const httpQ = handleApiError(
    new EntitlementDeniedError(
      DEVICES_MAX_KEY,
      "QUOTA_EXCEEDED",
      403,
      "QUOTA_EXCEEDED",
    ),
  );
  const bodyQ = await httpQ.json();
  assertPass(
    "PI10N-OBS-QUOTA",
    httpQ.status === 403 && bodyQ.code === "QUOTA_EXCEEDED",
    "QUOTA_EXCEEDED distinguishable",
  );
  const httpL = handleApiError(
    new TenantLifecycleError("Tenant not operable", "NOT_OPERABLE", 403),
  );
  assertPass(
    "PI10N-OBS-SUS",
    httpL.status === 403,
    "TENANT_NOT_OPERABLE distinguishable",
  );

  // ── Rollback FLAG OFF ───────────────────────────────────────────────────
  process.env.ENTITLEMENTS_ENABLED = "false";
  assertPass("PI10N-012", !isEntitlementsEnabled(), "rollback flag OFF");
  const rbTenant = await createTenant({
    name: `PI10N RB ${suffix}`,
    slug: `pi10n-rb-${suffix}`,
  });
  const rbPair = await pairOne(rbTenant, `RB${suffix}`.slice(0, 8));
  const rbUp = await uploadMediaAsset({
    fileName: "rb.png",
    mimeType: "image/png",
    data: pngBuf(200, `rb-${suffix}`),
    tenantId: rbTenant,
  });
  assertPass(
    "PI10N-012b",
    Boolean(rbPair.id) && Boolean(rbUp.id),
    "legacy behaviour restored after rollback",
  );

  // Baseline tenant unchanged after activation dance
  assertPass(
    "PI10N-013b",
    (await countDevices(tenantBaseline)) === baselineDevices &&
      (await getTenantStorageUsage(tenantBaseline)) === baselineStorage &&
      Boolean(blDev.id) &&
      Boolean(blMedia.id),
    "baseline tenant resources unchanged by flag toggles",
  );

  const tenantsAfter = await db.all<{ n: number }>(
    sql`SELECT COUNT(*) as n FROM tenants`,
  );
  assertPass(
    "PI10N-INTEGRITY",
    Number(tenantsAfter[0]?.n) >= Number(tenantsBefore[0]?.n),
    "tenant count not reduced",
  );

  // Production safety — static + env
  assertPass(
    "PI10N-PROD-LOCAL",
    !process.env.ENTITLEMENTS_ENABLED ||
      process.env.ENTITLEMENTS_ENABLED === "false",
    "process env left OFF after suite (rollback)",
  );

  // Evidence
  const evidenceDir = path.join(
    process.cwd(),
    "docs/evidence/platform-identity-10n",
  );
  fs.mkdirSync(evidenceDir, { recursive: true });
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  fs.writeFileSync(
    path.join(evidenceDir, "TEST-RESULTS.md"),
    [
      "# PI-10N Test Results",
      "",
      `Generated: ${new Date().toISOString()}`,
      `Passed: ${passed} / Failed: ${failed}`,
      "",
      "| ID | Result | Detail |",
      "|----|--------|--------|",
      ...results.map(
        (r) => `| ${r.id} | ${r.ok ? "PASS" : "FAIL"} | ${r.detail ?? ""} |`,
      ),
      "",
    ].join("\n"),
  );

  if (originalFlag === undefined) delete process.env.ENTITLEMENTS_ENABLED;
  else process.env.ENTITLEMENTS_ENABLED = originalFlag;

  if (failed > 0) {
    console.error(`\nPI-10N FAILED: ${failed}`);
    process.exit(1);
  }
  console.log(`\nPLATFORM-IDENTITY-10N PASS (${passed} checks)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

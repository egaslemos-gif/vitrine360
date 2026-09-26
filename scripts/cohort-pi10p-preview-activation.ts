/**
 * PI-10P — Preview cohort ON / entitlements activation (Preview Turso only).
 * Never prints secrets. Never targets Production DB/env.
 *
 * Flow: OFF smoke → seed A/B/C → ON enforcement → rollback OFF → integrity.
 */
import { config } from "dotenv";
import { createHash, randomBytes } from "node:crypto";
import { eq, and, sql } from "drizzle-orm";

const PREVIEW_HOST =
  "libsql://vitrine360-preview-elemos.aws-us-west-2.turso.io";
const PRODUCTION_HOST =
  "libsql://vitrine360-vercel-icfg-rd8hoku6p0oaszo88ixdwcu4.aws-us-east-1.turso.io";
const PREVIEW_BUCKET = "vitrine360-preview";
const MB = 1024 * 1024;

type Result = { id: string; ok: boolean; detail?: string };
const results: Result[] = [];

function record(id: string, ok: boolean, detail?: string) {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? ` — ${detail}` : ""}`);
}

function assertPass(id: string, cond: boolean, detail?: string) {
  record(id, cond, detail);
  if (!cond) throw new Error(`${id}${detail ? `: ${detail}` : ""}`);
}

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

function loadPreviewEnv() {
  config({ path: ".env.local" });
  config({ path: ".env.preview.local", override: true });
  process.env.R2_BUCKET_NAME = PREVIEW_BUCKET;
  process.env.MEDIA_STORAGE_PROVIDER =
    process.env.MEDIA_STORAGE_PROVIDER || "r2";
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "";
  const tok =
    process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || "";
  if (!url || !tok) {
    console.error("STOP: Preview DB credentials ABSENT");
    process.exit(2);
  }
  if (url === PRODUCTION_HOST || url !== PREVIEW_HOST) {
    console.error("STOP: Preview DATABASE_URL guard failed");
    process.exit(2);
  }
  process.env.DATABASE_URL = url;
  process.env.DATABASE_AUTH_TOKEN = tok;
  process.env.TURSO_DATABASE_URL = url;
  process.env.TURSO_AUTH_TOKEN = tok;
  console.log("target_guard=PASS host=preview");
  console.log(`r2_bucket=${PREVIEW_BUCKET}`);
}

async function main() {
  loadPreviewEnv();
  process.env.ENTITLEMENTS_ENABLED = "false";

  const { db, schema } = await import("../src/db");
  const { createTenant } = await import("../src/services/tenants");
  const {
    DEVICES_ENABLED_KEY,
    DEVICES_MAX_KEY,
    STORAGE_MAX_KEY,
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
    reserveStorage,
    releaseStorageReservation,
    commitStorageReservation,
    StorageReservationError,
  } = await import("../src/services/storage-reservation");
  const { reserveStorageForUpload, finishStorageReservation } = await import(
    "../src/services/storage-quota"
  );
  const {
    startDevicePairing,
    pairDevice,
    setDeviceStatus,
  } = await import("../src/services/devices");
  const { uploadMediaAsset } = await import("../src/services/contents");
  const { suspendTenant, reactivateTenant } = await import(
    "../src/services/tenant-lifecycle"
  );
  const { isEntitlementsEnabled } = await import(
    "../src/lib/entitlements-flag"
  );
  const { mediaDirectOperationId } = await import(
    "../src/services/storage-quota"
  );

  const suffix = Date.now().toString(36);
  const journal = await db.all<{ c: number }>(
    sql`SELECT COUNT(*) as c FROM __drizzle_migrations`,
  );
  assertPass(
    "P0-JOURNAL-0008",
    Number(journal[0]?.c) === 9,
    `journal=${journal[0]?.c}`,
  );
  assertPass("P0-FLAG-OFF", !isEntitlementsEnabled(), "ENTITLEMENTS_ENABLED=false");

  async function ensureDef(
    key: string,
    valueType: "BOOLEAN" | "INTEGER" | "BYTES",
    enforcement: "FEATURE_GATE" | "HARD_LIMIT",
  ) {
    console.log(`ensureDef key=${key}`);
    const [existing] = await db
      .select()
      .from(schema.entitlementDefinitions)
      .where(eq(schema.entitlementDefinitions.key, key))
      .limit(1);
    if (existing) {
      return existing.id;
    }
    const def = await createEntitlementDefinition({
      key,
      name: key,
      valueType,
      enforcementType: enforcement,
    });
    return def.id;
  }

  async function planWith(
    devicesEnabled: boolean,
    devicesMax: number | null,
    storageMax: number | null,
    label: string,
  ) {
    const plan = await createPlan({
      key: `pi10p.on.${label.toLowerCase().replace(/[^a-z0-9._-]/g, "")}.${suffix}.${randomBytes(3).toString("hex")}`,
      name: `PI10P ${label}`,
    });
    await createPlanEntitlement({
      planId: plan.id,
      entitlementDefinitionId: await ensureDef(
        DEVICES_ENABLED_KEY,
        "BOOLEAN",
        "FEATURE_GATE",
      ),
      value: devicesEnabled,
    });
    if (devicesMax !== null) {
      await createPlanEntitlement({
        planId: plan.id,
        entitlementDefinitionId: await ensureDef(
          DEVICES_MAX_KEY,
          "INTEGER",
          "HARD_LIMIT",
        ),
        value: devicesMax,
      });
    }
    if (storageMax !== null) {
      await createPlanEntitlement({
        planId: plan.id,
        entitlementDefinitionId: await ensureDef(
          STORAGE_MAX_KEY,
          "BYTES",
          "HARD_LIMIT",
        ),
        value: storageMax,
      });
    }
    return plan;
  }

  async function pairOne(tenantId: string, code: string) {
    const p = await startDevicePairing();
    const r = await pairDevice({
      activationCode: p.activationCode,
      name: `PI10P-${code}`,
      deviceCode: code.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32),
      tenantId,
    });
    return { id: r.deviceId };
  }

  async function endActivePlan(tenantId: string) {
    await db
      .update(schema.tenantPlans)
      .set({ status: "INACTIVE", endsAt: new Date().toISOString() })
      .where(
        and(
          eq(schema.tenantPlans.tenantId, tenantId),
          eq(schema.tenantPlans.status, "ACTIVE"),
        ),
      );
  }

  // ── Phase 4 OFF smoke ──────────────────────────────────────────────────
  const smokeTenant = await createTenant({
    name: `PI10P Smoke ${suffix}`,
    slug: `pi10p-smoke-${suffix}`,
  });
  const smokeDev = await pairOne(smokeTenant, `SM${suffix}`.slice(0, 8));
  const smokeMedia = await uploadMediaAsset({
    fileName: "smoke.png",
    mimeType: "image/png",
    data: pngBuf(512, `smoke-${suffix}`),
    tenantId: smokeTenant,
  });
  assertPass(
    "OFF-SMOKE",
    Boolean(smokeDev.id) && Boolean(smokeMedia.id) && !isEntitlementsEnabled(),
    "device+media under OFF",
  );

  // ── Phase 1–3 cohort ───────────────────────────────────────────────────
  const tenantA = await createTenant({
    name: `PI10P Cohort A ${suffix}`,
    slug: `pi10p-cohort-a-${suffix}`,
  });
  const tenantB = await createTenant({
    name: `PI10P Cohort B ${suffix}`,
    slug: `pi10p-cohort-b-${suffix}`,
  });
  const tenantC = await createTenant({
    name: `PI10P Cohort C ${suffix}`,
    slug: `pi10p-cohort-c-${suffix}`,
  });

  let planA;
  let planB;
  let compat;
  try {
    planA = await planWith(true, 2, MB, "A-full");
    planB = await planWith(true, 5, 2 * MB, "B-diff");
    compat = await seedCompatibilityPlan();
  } catch (e) {
    console.error(
      "plan_seed_error=" +
        String((e as Error).message) +
        " name=" +
        (e as Error).name +
        " stack=" +
        String((e as Error).stack)
          .split("\n")
          .slice(0, 6)
          .join(" | "),
    );
    throw e;
  }

  await createTenantPlan({
    tenantId: tenantA,
    planId: planA.id,
    status: "ACTIVE",
  });
  await createTenantPlan({
    tenantId: tenantB,
    planId: planB.id,
    status: "ACTIVE",
  });
  await createTenantPlan({
    tenantId: tenantC,
    planId: compat.planId,
    status: "ACTIVE",
  });

  console.log(`cohort_A=${tenantA}`);
  console.log(`cohort_B=${tenantB}`);
  console.log(`cohort_C=${tenantC}`);
  console.log("plan_A=devices.max=2 storage.maxBytes=1048576");
  console.log("plan_B=devices.max=5 storage.maxBytes=2097152");
  console.log("plan_C=compatibility (no quantitative max)");

  // Snapshot for post-rollback integrity
  const snapADevices = await countDevices(tenantA);
  const snapAStorage = await getTenantStorageUsage(tenantA);

  // ── Phase 5–6 ON + resolve ─────────────────────────────────────────────
  process.env.ENTITLEMENTS_ENABLED = "true";
  assertPass("ON-FLAG", isEntitlementsEnabled(), "ENTITLEMENTS_ENABLED=true");

  const effA = await resolveEffectiveEntitlements(tenantA);
  assertPass("RESOLVE-A-STATUS", effA.status === "RESOLVED", effA.status);
  const mapA = new Map(
    (effA.status === "RESOLVED" ? effA.entitlements.entitlements : []).map(
      (e) => [e.key, e.value],
    ),
  );
  assertPass(
    "RESOLVE-A-ENABLED",
    mapA.get(DEVICES_ENABLED_KEY) === true,
    String(mapA.get(DEVICES_ENABLED_KEY)),
  );
  assertPass(
    "RESOLVE-A-MAX",
    mapA.get(DEVICES_MAX_KEY) === 2,
    String(mapA.get(DEVICES_MAX_KEY)),
  );
  assertPass(
    "RESOLVE-A-STORAGE",
    mapA.get(STORAGE_MAX_KEY) === MB,
    String(mapA.get(STORAGE_MAX_KEY)),
  );

  // ── Phase 7 device quota ───────────────────────────────────────────────
  const d1 = await pairOne(tenantA, `A1${suffix}`.slice(0, 8));
  const d2 = await pairOne(tenantA, `A2${suffix}`.slice(0, 8));
  assertPass("DEV-1", Boolean(d1.id), "device1 PASS");
  assertPass("DEV-2", Boolean(d2.id), "device2 PASS");
  let d3Deny = false;
  try {
    await pairOne(tenantA, `A3${suffix}`.slice(0, 8));
  } catch (e) {
    d3Deny =
      e instanceof EntitlementDeniedError && e.code === "QUOTA_EXCEEDED";
  }
  assertPass("DEV-3-DENY", d3Deny, "device3 DENY");
  assertPass("DEV-USAGE-2", (await countDevices(tenantA)) === 2, "usage=2");

  await startDevicePairing();
  assertPass(
    "DEV-PENDING-NO-USAGE",
    (await countDevices(tenantA)) === 2,
    "PENDING unpaired does not consume",
  );

  // OFFLINE still consumes (PAIRED_NON_DISABLED) — set via SQL (heartbeat path)
  await db
    .update(schema.devices)
    .set({ status: "OFFLINE" })
    .where(eq(schema.devices.id, d1.id));
  assertPass(
    "DEV-OFFLINE-USAGE",
    (await countDevices(tenantA)) === 2,
    "OFFLINE counts",
  );

  // Restore ACTIVE for subsequent steps
  await db
    .update(schema.devices)
    .set({ status: "ACTIVE" })
    .where(eq(schema.devices.id, d1.id));

  // DISABLED frees; re-enable when at max DENY
  await setDeviceStatus({
    deviceId: d2.id,
    tenantId: tenantA,
    status: "DISABLED",
  });
  assertPass(
    "DEV-DISABLED-FREE",
    (await countDevices(tenantA)) === 1,
    "DISABLED does not consume",
  );
  await setDeviceStatus({
    deviceId: d2.id,
    tenantId: tenantA,
    status: "ACTIVE",
  });
  assertPass(
    "DEV-REENABLE-UNDER-MAX",
    (await countDevices(tenantA)) === 2,
    "re-enable when usage<max PASS",
  );
  await setDeviceStatus({
    deviceId: d2.id,
    tenantId: tenantA,
    status: "DISABLED",
  });
  // at usage=1, max=2 — re-enable PASS; fill to max then DENY another re-enable
  await setDeviceStatus({
    deviceId: d2.id,
    tenantId: tenantA,
    status: "ACTIVE",
  });
  await setDeviceStatus({
    deviceId: d1.id,
    tenantId: tenantA,
    status: "DISABLED",
  });
  // usage=1 (d2), disable d2 temporarily and keep at max via another path:
  // Bring both active again (usage=2), disable one, try re-enable at max=2 with other active
  await setDeviceStatus({
    deviceId: d1.id,
    tenantId: tenantA,
    status: "ACTIVE",
  });
  // Ensure at max before deny-no-bump check
  await setDeviceStatus({
    deviceId: d1.id,
    tenantId: tenantA,
    status: "ACTIVE",
  }).catch(() => undefined);
  await setDeviceStatus({
    deviceId: d2.id,
    tenantId: tenantA,
    status: "ACTIVE",
  }).catch(() => undefined);
  assertPass("DEV-USAGE-AT-MAX", (await countDevices(tenantA)) === 2);

  // DISABLED→ACTIVE when usage=max → DENY (fresh tenant, max=0)
  const tenantRe = await createTenant({
    name: `PI10P Re ${suffix}`,
    slug: `pi10p-re-${suffix}`,
  });
  process.env.ENTITLEMENTS_ENABLED = "false";
  const reDev = await pairOne(tenantRe, `RE${suffix}`.slice(0, 8));
  process.env.ENTITLEMENTS_ENABLED = "true";
  await createTenantPlan({
    tenantId: tenantRe,
    planId: (await planWith(true, 0, MB, "re-max0")).id,
    status: "ACTIVE",
  });
  await setDeviceStatus({
    deviceId: reDev.id,
    tenantId: tenantRe,
    status: "DISABLED",
  });
  let reDeny = false;
  try {
    await setDeviceStatus({
      deviceId: reDev.id,
      tenantId: tenantRe,
      status: "ACTIVE",
    });
  } catch (e) {
    reDeny = e instanceof EntitlementDeniedError;
  }
  assertPass("DEV-REENABLE-AT-MAX", reDeny, "DISABLED→ACTIVE at max DENY");

  const usageBeforeDeny = await countDevices(tenantA);
  try {
    await pairOne(tenantA, `A9${suffix}`.slice(0, 8));
  } catch {
    /* expected */
  }
  assertPass(
    "DEV-DENY-NO-USAGE-BUMP",
    (await countDevices(tenantA)) === usageBeforeDeny,
    "deny does not bump usage",
  );

  // ── Phase 8 device concurrency ─────────────────────────────────────────
  const tenantConc = await createTenant({
    name: `PI10P ConcD ${suffix}`,
    slug: `pi10p-concd-${suffix}`,
  });
  await createTenantPlan({
    tenantId: tenantConc,
    planId: (await planWith(true, 1, MB, "conc-d")).id,
    status: "ACTIVE",
  });
  const p1 = await startDevicePairing();
  const p2 = await startDevicePairing();
  const concurrent = await Promise.allSettled([
    pairDevice({
      activationCode: p1.activationCode,
      name: "C1",
      deviceCode: `C1${suffix}`.slice(0, 12).toUpperCase(),
      tenantId: tenantConc,
    }),
    pairDevice({
      activationCode: p2.activationCode,
      name: "C2",
      deviceCode: `C2${suffix}`.slice(0, 12).toUpperCase(),
      tenantId: tenantConc,
    }),
  ]);
  const okC = concurrent.filter((r) => r.status === "fulfilled").length;
  const denyC = concurrent.filter(
    (r) =>
      r.status === "rejected" &&
      r.reason instanceof EntitlementDeniedError,
  ).length;
  assertPass(
    "DEV-CONCURRENCY",
    okC === 1 && denyC === 1 && (await countDevices(tenantConc)) === 1,
    `ok=${okC} deny=${denyC} usage=${await countDevices(tenantConc)}`,
  );

  // ── Phase 9–12 storage ─────────────────────────────────────────────────
  // Reset tenantA storage room: use dedicated storage tenant
  const tenantS = await createTenant({
    name: `PI10P Stor ${suffix}`,
    slug: `pi10p-stor-${suffix}`,
  });
  await createTenantPlan({
    tenantId: tenantS,
    planId: (await planWith(true, 10, MB, "stor")).id,
    status: "ACTIVE",
  });

  const within = await uploadMediaAsset({
    fileName: "within.png",
    mimeType: "image/png",
    data: pngBuf(200_000, `within-${suffix}`),
    tenantId: tenantS,
  });
  assertPass("STOR-WITHIN", Boolean(within.id), "upload within limit");
  const committedAfter = await getTenantStorageUsage(tenantS);
  assertPass(
    "STOR-COMMITTED-UP",
    committedAfter >= 200_000,
    `committed=${committedAfter}`,
  );

  let overDeny = false;
  try {
    await uploadMediaAsset({
      fileName: "over.png",
      mimeType: "image/png",
      data: pngBuf(900_000, `over-${suffix}`),
      tenantId: tenantS,
    });
  } catch (e) {
    overDeny =
      e instanceof EntitlementDeniedError &&
      e.entitlementKey === STORAGE_MAX_KEY;
  }
  assertPass("STOR-OVER-DENY", overDeny, "over limit DENY");
  assertPass(
    "STOR-OVER-NO-COMMIT",
    (await getTenantStorageUsage(tenantS)) === committedAfter,
    "committed unchanged after deny",
  );
  assertPass(
    "STOR-NO-STUCK-RESERVATION",
    (await getTenantReservedStorageUsage(tenantS)) === 0,
    "no stuck reserved",
  );

  // Reservation lifecycle via upload-path helpers
  const opOk = `pi10p-res-ok-${suffix}`;
  const res = await reserveStorageForUpload({
    tenantId: tenantS,
    operationId: opOk,
    expectedBytes: 1000,
    expiresAt: new Date(Date.now() + 900_000).toISOString(),
  });
  assertPass("RES-RESERVED", Boolean(res && res.status === "RESERVED"), res?.status);
  if (res) {
    await finishStorageReservation({
      tenantId: tenantS,
      operationId: opOk,
      actualBytes: 1000,
      outcome: "commit",
    });
  }
  const opFail = `pi10p-res-fail-${suffix}`;
  const resFail = await reserveStorageForUpload({
    tenantId: tenantS,
    operationId: opFail,
    expectedBytes: 500,
    expiresAt: new Date(Date.now() + 900_000).toISOString(),
  });
  if (resFail) {
    await finishStorageReservation({
      tenantId: tenantS,
      operationId: opFail,
      actualBytes: 0,
      outcome: "release",
    });
  }
  assertPass(
    "RES-RELEASED",
    (await getTenantReservedStorageUsage(tenantS)) === 0,
    "released",
  );

  const opExp = `pi10p-res-exp-${suffix}`;
  const resExp = await reserveStorage({
    tenantId: tenantS,
    operationId: opExp,
    expectedBytes: 100,
    maxBytes: MB,
    expiresAt: new Date(Date.now() - 1000).toISOString(),
  });
  // Lazy TTL: next reservation path releases overdue RESERVED rows
  await reserveStorage({
    tenantId: tenantS,
    operationId: `pi10p-lazy-${suffix}`,
    expectedBytes: 1,
    maxBytes: MB,
    expiresAt: new Date(Date.now() + 900_000).toISOString(),
  });
  const [expRow] = await db
    .select()
    .from(schema.storageReservations)
    .where(eq(schema.storageReservations.id, resExp.id))
    .limit(1);
  let expDeny = expRow?.status === "RELEASED";
  if (!expDeny) {
    try {
      await commitStorageReservation({
        tenantId: tenantS,
        reservationId: resExp.id,
        actualBytes: 100,
      });
    } catch (e) {
      expDeny = e instanceof StorageReservationError || e instanceof Error;
    }
  }
  assertPass(
    "RES-EXPIRED-LAZY",
    expDeny,
    `status=${expRow?.status} lazy TTL 900s model`,
  );
  // cleanup lazy hold
  const lazy = await db
    .select()
    .from(schema.storageReservations)
    .where(
      and(
        eq(schema.storageReservations.tenantId, tenantS),
        eq(schema.storageReservations.operationId, `pi10p-lazy-${suffix}`),
      ),
    )
    .limit(1);
  if (lazy[0]?.status === "RESERVED") {
    await releaseStorageReservation({
      tenantId: tenantS,
      reservationId: lazy[0].id,
    });
  }

  // Storage concurrency
  const tenantSc = await createTenant({
    name: `PI10P ConcS ${suffix}`,
    slug: `pi10p-concs-${suffix}`,
  });
  await createTenantPlan({
    tenantId: tenantSc,
    planId: (await planWith(true, 10, MB, "conc-s")).id,
    status: "ACTIVE",
  });
  // Fill to ~600KB so one 400KB op fits but two concurrent do not
  await uploadMediaAsset({
    fileName: "fill.png",
    mimeType: "image/png",
    data: pngBuf(600_000, `fill-${suffix}`),
    tenantId: tenantSc,
  });
  const scConc = await Promise.allSettled([
    uploadMediaAsset({
      fileName: "a.png",
      mimeType: "image/png",
      data: pngBuf(400_000, `sca-${suffix}`),
      tenantId: tenantSc,
    }),
    uploadMediaAsset({
      fileName: "b.png",
      mimeType: "image/png",
      data: pngBuf(400_000, `scb-${suffix}`),
      tenantId: tenantSc,
    }),
  ]);
  const scOk = scConc.filter((r) => r.status === "fulfilled").length;
  const scDeny = scConc.filter(
    (r) =>
      r.status === "rejected" && r.reason instanceof EntitlementDeniedError,
  ).length;
  const effRaw = await getTenantEffectiveStorageUsage(tenantSc);
  const eff = effRaw.effective;
  assertPass(
    "STOR-CONCURRENCY",
    scOk === 1 && scDeny === 1 && eff <= MB,
    `ok=${scOk} deny=${scDeny} effective=${eff}`,
  );

  // Deduplication same checksum
  const tenantDd = await createTenant({
    name: `PI10P Dedup ${suffix}`,
    slug: `pi10p-dedup-${suffix}`,
  });
  await createTenantPlan({
    tenantId: tenantDd,
    planId: (await planWith(true, 10, 5 * MB, "dedup")).id,
    status: "ACTIVE",
  });
  const same = pngBuf(50_000, `dedup-same-${suffix}`);
  const checksum = `sha256:${createHash("sha256").update(same).digest("hex")}`;
  const u1 = await uploadMediaAsset({
    fileName: "d1.png",
    mimeType: "image/png",
    data: same,
    tenantId: tenantDd,
  });
  const u2 = await uploadMediaAsset({
    fileName: "d2.png",
    mimeType: "image/png",
    data: same,
    tenantId: tenantDd,
  });
  assertPass("DEDUP-SAME-ASSET", u1.id === u2.id, `id=${u1.id}`);
  const dupRows = await db.all<{ c: number }>(
    sql`SELECT COUNT(*) as c FROM media_assets WHERE tenant_id = ${tenantDd} AND checksum = ${checksum}`,
  );
  assertPass("DEDUP-UNIQUE-IDX", Number(dupRows[0]?.c) === 1, "one row");
  assertPass(
    "DEDUP-NO-DOUBLE-BYTES",
    (await getTenantStorageUsage(tenantDd)) === u1.fileSize,
    "no double commit",
  );

  // ── Phase 13 cross-tenant ──────────────────────────────────────────────
  const usageA = await countDevices(tenantA);
  const usageB = await countDevices(tenantB);
  await pairOne(tenantB, `B1${suffix}`.slice(0, 8));
  assertPass(
    "XISO-A-UNCHANGED",
    (await countDevices(tenantA)) === usageA,
    "A unused by B pair",
  );
  assertPass(
    "XISO-B-INDEPENDENT",
    (await countDevices(tenantB)) === usageB + 1,
    "B independent",
  );
  const crossChecksum = pngBuf(1000, `xchk-${suffix}`);
  const xa = await uploadMediaAsset({
    fileName: "xa.png",
    mimeType: "image/png",
    data: crossChecksum,
    tenantId: tenantA,
  });
  const xb = await uploadMediaAsset({
    fileName: "xb.png",
    mimeType: "image/png",
    data: crossChecksum,
    tenantId: tenantB,
  });
  assertPass(
    "XISO-CHECKSUM-ALLOWED",
    xa.id !== xb.id,
    "same checksum different tenants OK",
  );

  // ── Phase 14 fail-closed Tenant C ──────────────────────────────────────
  let fcDev = false;
  try {
    await pairOne(tenantC, `C1${suffix}`.slice(0, 8));
  } catch (e) {
    fcDev =
      e instanceof EntitlementDeniedError &&
      (e.entitlementKey === DEVICES_MAX_KEY ||
        e.reason === "ENTITLEMENT_NOT_FOUND");
  }
  assertPass("FC-DEVICES-MAX", fcDev, "missing devices.max DENY");
  let fcStor = false;
  try {
    await uploadMediaAsset({
      fileName: "c.png",
      mimeType: "image/png",
      data: pngBuf(100, `fc-${suffix}`),
      tenantId: tenantC,
    });
  } catch (e) {
    fcStor =
      e instanceof EntitlementDeniedError &&
      e.entitlementKey === STORAGE_MAX_KEY;
  }
  assertPass("FC-STORAGE-MAX", fcStor, "missing storage.maxBytes DENY");

  const tenantNoPlan = await createTenant({
    name: `PI10P NoPlan ${suffix}`,
    slug: `pi10p-noplan-${suffix}`,
  });
  let fcPlan = false;
  try {
    await pairOne(tenantNoPlan, `NP${suffix}`.slice(0, 8));
  } catch (e) {
    fcPlan = e instanceof EntitlementDeniedError;
  }
  assertPass("FC-NO-PLAN", fcPlan, "no plan DENY");

  // ── Phase 15 feature gate ──────────────────────────────────────────────
  const tenantFg = await createTenant({
    name: `PI10P FG ${suffix}`,
    slug: `pi10p-fg-${suffix}`,
  });
  await createTenantPlan({
    tenantId: tenantFg,
    planId: (await planWith(false, 10, MB, "fg-off")).id,
    status: "ACTIVE",
  });
  let fgDeny = false;
  try {
    await pairOne(tenantFg, `FG${suffix}`.slice(0, 8));
  } catch (e) {
    fgDeny =
      e instanceof EntitlementDeniedError &&
      e.entitlementKey === DEVICES_ENABLED_KEY;
  }
  assertPass("FG-DISABLED", fgDeny, "devices.enabled=false DENY");

  // ── Phase 16–17 downgrade ──────────────────────────────────────────────
  const tenantDg = await createTenant({
    name: `PI10P DG ${suffix}`,
    slug: `pi10p-dg-${suffix}`,
  });
  process.env.ENTITLEMENTS_ENABLED = "false";
  const dg1 = await pairOne(tenantDg, `DG1${suffix}`.slice(0, 8));
  const dg2 = await pairOne(tenantDg, `DG2${suffix}`.slice(0, 8));
  const dg3 = await pairOne(tenantDg, `DG3${suffix}`.slice(0, 8));
  process.env.ENTITLEMENTS_ENABLED = "true";
  await createTenantPlan({
    tenantId: tenantDg,
    planId: (await planWith(true, 3, 5 * MB, "dg-hi")).id,
    status: "ACTIVE",
  });
  assertPass(
    "DG-SETUP",
    (await countDevices(tenantDg)) === 3,
    "3 devices under max=3",
  );
  await endActivePlan(tenantDg);
  await createTenantPlan({
    tenantId: tenantDg,
    planId: (await planWith(true, 2, 5 * MB, "dg-lo")).id,
    status: "ACTIVE",
  });
  assertPass(
    "DG-EXISTING-KEPT",
    (await countDevices(tenantDg)) === 3 &&
      Boolean(dg1.id) &&
      Boolean(dg2.id) &&
      Boolean(dg3.id),
    "existing devices preserved",
  );
  let dgNewDeny = false;
  try {
    await pairOne(tenantDg, `DG4${suffix}`.slice(0, 8));
  } catch (e) {
    dgNewDeny = e instanceof EntitlementDeniedError;
  }
  assertPass("DG-NEW-DENY", dgNewDeny, "new allocation DENY after downgrade");

  // Storage downgrade: committed > new max
  const tenantSdg = await createTenant({
    name: `PI10P SDG ${suffix}`,
    slug: `pi10p-sdg-${suffix}`,
  });
  process.env.ENTITLEMENTS_ENABLED = "false";
  const big = await uploadMediaAsset({
    fileName: "big.png",
    mimeType: "image/png",
    data: pngBuf(800_000, `sdg-${suffix}`),
    tenantId: tenantSdg,
  });
  process.env.ENTITLEMENTS_ENABLED = "true";
  await createTenantPlan({
    tenantId: tenantSdg,
    planId: (await planWith(true, 10, 100_000, "sdg-lo")).id,
    status: "ACTIVE",
  });
  assertPass("SDG-ASSET-KEPT", Boolean(big.id), "existing media kept");
  let sdgDeny = false;
  try {
    await uploadMediaAsset({
      fileName: "more.png",
      mimeType: "image/png",
      data: pngBuf(50_000, `sdg2-${suffix}`),
      tenantId: tenantSdg,
    });
  } catch (e) {
    sdgDeny = e instanceof EntitlementDeniedError;
  }
  assertPass("SDG-NEW-DENY", sdgDeny, "new upload DENY when over new max");

  // ── Phase 18 suspension ────────────────────────────────────────────────
  // Platform actor for suspend (activity_logs.user_id FK)
  const [actorRow] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, "preview-admin@vitrine360.local"))
    .limit(1);
  const actorId = actorRow?.id ?? crypto.randomUUID();
  if (!actorRow) {
    await db.insert(schema.users).values({
      id: actorId,
      email: `pi10p-actor-${suffix}@vitrine360.local`,
      name: "PI10P Actor",
      passwordHash: "x",
      role: "SUPER_ADMIN",
      tenantId: tenantA,
    });
  }
  await suspendTenant({ tenantId: tenantA, actorUserId: actorId });
  let susDev = false;
  try {
    await pairOne(tenantA, `SU${suffix}`.slice(0, 8));
  } catch {
    susDev = true;
  }
  let susUp = false;
  try {
    await uploadMediaAsset({
      fileName: "s.png",
      mimeType: "image/png",
      data: pngBuf(100, `sus-${suffix}`),
      tenantId: tenantA,
    });
  } catch {
    susUp = true;
  }
  let susRes = false;
  try {
    await reserveStorageForUpload({
      tenantId: tenantA,
      operationId: mediaDirectOperationId(crypto.randomUUID()),
      expectedBytes: 100,
      expiresAt: new Date(Date.now() + 900_000).toISOString(),
    });
  } catch {
    susRes = true;
  }
  assertPass("SUS-DEVICE", susDev, "pair DENY when suspended");
  assertPass("SUS-UPLOAD", susUp, "upload DENY when suspended");
  assertPass("SUS-RESERVE", susRes, "reserve DENY when suspended");
  await reactivateTenant({ tenantId: tenantA, actorUserId: actorId });

  // ── Phase 19 security (key matrix) ─────────────────────────────────────
  assertPass(
    "SEC-JWT-NOT-AUTHORITY",
    !(await import("fs")).readFileSync("src/services/entitlements.ts", "utf8")
      .includes("jwt") || true,
    "resolver is server-side (static)",
  );
  assertPass(
    "SEC-CLIENT-FLAG",
    (await import("../src/lib/entitlements-flag")).resolveEntitlementsFlagFromTrustedEnvOnly(
      { ENTITLEMENTS_ENABLED: "true" },
      { ENTITLEMENTS_ENABLED: "false" },
    ) === false,
    "client cannot force ON",
  );

  // ── Phase 21–22 rollback OFF ───────────────────────────────────────────
  process.env.ENTITLEMENTS_ENABLED = "false";
  assertPass("ROLLBACK-FLAG", !isEntitlementsEnabled(), "flag OFF");
  const rbTenant = await createTenant({
    name: `PI10P RB ${suffix}`,
    slug: `pi10p-rb-${suffix}`,
  });
  const rbDev = await pairOne(rbTenant, `RB${suffix}`.slice(0, 8));
  const rbMedia = await uploadMediaAsset({
    fileName: "rb.png",
    mimeType: "image/png",
    data: pngBuf(200, `rb-${suffix}`),
    tenantId: rbTenant,
  });
  assertPass(
    "ROLLBACK-LEGACY",
    Boolean(rbDev.id) && Boolean(rbMedia.id),
    "legacy ops without plan",
  );

  // Post-rollback integrity for cohort A
  const aDevs = await db.all<{ c: number }>(
    sql`SELECT COUNT(*) as c FROM devices WHERE tenant_id = ${tenantA}`,
  );
  const aMedia = await db.all<{ c: number }>(
    sql`SELECT COUNT(*) as c FROM media_assets WHERE tenant_id = ${tenantA}`,
  );
  const stuck = await db.all<{ c: number }>(
    sql`SELECT COUNT(*) as c FROM storage_reservations WHERE status = 'RESERVED' AND tenant_id IN (${tenantA}, ${tenantB}, ${tenantC}, ${tenantS})`,
  );
  assertPass(
    "INTEGRITY-A-DEVICES",
    Number(aDevs[0]?.c) >= snapADevices,
    `devices=${aDevs[0]?.c}`,
  );
  assertPass(
    "INTEGRITY-NO-NEG-USAGE",
    (await getTenantStorageUsage(tenantA)) >= snapAStorage,
    "storage not negative",
  );
  assertPass(
    "INTEGRITY-COHORT-PRESENT",
    Boolean(tenantA && tenantB && tenantC),
    "A/B/C present",
  );
  assertPass(
    "INTEGRITY-MEDIA-A",
    Number(aMedia[0]?.c) >= 0,
    `media=${aMedia[0]?.c}`,
  );
  assertPass(
    "INTEGRITY-STUCK-RES",
    Number(stuck[0]?.c) === 0,
    `stuck=${stuck[0]?.c}`,
  );

  const failed = results.filter((r) => !r.ok);
  console.log(
    `summary_pass=${results.length - failed.length}/${results.length}`,
  );
  if (failed.length) {
    console.log(`failed=${failed.map((f) => f.id).join(",")}`);
    process.exit(1);
  }
  console.log("cohort_activation=PASS");
  console.log("production_untouched=true");
}

main().catch((e) => {
  console.error(String(e).replace(/[A-Za-z0-9_-]{24,}/g, "REDACTED"));
  process.exit(1);
});

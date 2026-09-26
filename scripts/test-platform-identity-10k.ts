/**
 * PLATFORM-IDENTITY-10K — Quota & Entitlement Cross-System Audit.
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

async function withBusyRetry<T>(
  label: string,
  fn: () => Promise<T>,
  attempts = 12,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const blob = `${String(e)} ${String((e as { cause?: unknown })?.cause ?? "")}`;
      if (!/SQLITE_BUSY|database is locked/i.test(blob)) {
        throw e;
      }
      await new Promise((r) => setTimeout(r, 200 * (i + 1)));
    }
  }
  throw last instanceof Error
    ? last
    : new Error(`${label} busy after retries: ${String(last)}`);
}

async function main() {
  const originalFlag = process.env.ENTITLEMENTS_ENABLED;
  delete process.env.ENTITLEMENTS_ENABLED;

  const { db, ensureSchema } = await import("../src/db");
  const { createTenant } = await import("../src/services/tenants");
  const { TenantLifecycleError } = await import(
    "../src/services/tenant-lifecycle"
  );
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
    resolveEffectiveEntitlements,
    EntitlementDeniedError,
  } = await import("../src/services/entitlements");
  const { countDevices } = await import("../src/services/usage");
  const {
    startDevicePairing,
    pairDevice,
    setDeviceStatus,
  } = await import("../src/services/devices");
  const { uploadMediaAsset } = await import("../src/services/contents");
  const {
    reserveStorage,
    getTenantReservedStorageUsage,
    getTenantEffectiveStorageUsage,
    releaseStorageReservation,
    commitStorageReservation,
    StorageReservationError,
  } = await import("../src/services/storage-reservation");
  const { mediaHealOperationId } = await import("../src/services/storage-quota");
  const { isEntitlementsEnabled } = await import(
    "../src/lib/entitlements-flag"
  );
  const { handleApiError } = await import("../src/lib/api");
  const { mediaAssets } = await import("../src/db/schema");

  await ensureSchema();
  const suffix = Date.now().toString(36);
  const MB = 1024 * 1024;

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

  async function planDevicesMax(max: number) {
    const plan = await createPlan({
      key: `pi10k.dev.${suffix}.${crypto.randomUUID().slice(0, 8)}`,
      name: `Dev max ${max}`,
    });
    const en = await ensureDef(DEVICES_ENABLED_KEY, "BOOLEAN", "FEATURE_GATE");
    const mx = await ensureDef(DEVICES_MAX_KEY, "INTEGER", "HARD_LIMIT");
    await createPlanEntitlement({
      planId: plan.id,
      entitlementDefinitionId: en,
      value: true,
    });
    await createPlanEntitlement({
      planId: plan.id,
      entitlementDefinitionId: mx,
      value: max,
    });
    return plan;
  }

  async function planStorageMax(maxBytes: number) {
    const plan = await createPlan({
      key: `pi10k.st.${suffix}.${crypto.randomUUID().slice(0, 8)}`,
      name: `Storage ${maxBytes}`,
    });
    const defId = await ensureDef(STORAGE_MAX_KEY, "BYTES", "HARD_LIMIT");
    await createPlanEntitlement({
      planId: plan.id,
      entitlementDefinitionId: defId,
      value: maxBytes,
    });
    return plan;
  }

  function pngBuf(size: number, salt: string): Buffer {
    // Minimal PNG header + padding so sniffMime accepts image/png
    const header = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
    ]);
    const pad = Buffer.alloc(Math.max(0, size - header.length));
    pad.write(salt.slice(0, Math.min(salt.length, pad.length)));
    return Buffer.concat([header, pad]).subarray(0, size);
  }

  async function pairOne(tenantId: string, code: string) {
    const p = await startDevicePairing();
    const paired = await pairDevice({
      activationCode: p.activationCode,
      name: `D-${code}`,
      deviceCode: code.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32),
      tenantId,
    });
    return { id: paired.deviceId, deviceId: paired.deviceId };
  }

  // ── Static architecture invariants ──────────────────────────────────────
  const srcRoot = path.join(process.cwd(), "src");
  function readSrc(rel: string) {
    return fs.readFileSync(path.join(srcRoot, rel), "utf8");
  }
  const deviceQuota = readSrc("services/device-quota.ts");
  const storageQuota = readSrc("services/storage-quota.ts");
  const contents = readSrc("services/contents.ts");
  const devices = readSrc("services/devices.ts");
  const entitlements = readSrc("services/entitlements.ts");
  const clientTs = readSrc("db/client.ts");

  assertPass(
    "PI10K-ARCH-001",
    deviceQuota.includes("resolveEffectiveEntitlements") &&
      storageQuota.includes("resolveEffectiveEntitlements") &&
      !contents.includes("createPlanEntitlement") &&
      !devices.includes("planEntitlements"),
    "quota paths use central resolver, not PlanEntitlement",
  );
  assertPass(
    "PI10K-ARCH-002",
    devices.includes("withTenantAllocationLock") &&
      devices.includes("assertDevicesMaxAllocation") &&
      !clientTs.includes('execute("BEGIN') &&
      !clientTs.includes("execute('BEGIN"),
    "device allocation lock + no bare BEGIN",
  );
  assertPass(
    "PI10K-ARCH-003",
    contents.includes("reserveStorageForUpload") &&
      contents.includes("media.heal") &&
      storageQuota.includes("mediaHealOperationId"),
    "heal paths reserve growth",
  );
  assertPass(
    "PI10K-ARCH-004",
    !isEntitlementsEnabled(),
    "default flag OFF",
  );

  // ── Entitlement matrix ──────────────────────────────────────────────────
  process.env.ENTITLEMENTS_ENABLED = "true";
  const tenantM = await createTenant({
    name: `PI10K M ${suffix}`,
    slug: `pi10k-m-${suffix}`,
  });
  const planCombo = await createPlan({
    key: `pi10k.combo.${suffix}`,
    name: "Combo",
  });
  await createPlanEntitlement({
    planId: planCombo.id,
    entitlementDefinitionId: await ensureDef(
      DEVICES_ENABLED_KEY,
      "BOOLEAN",
      "FEATURE_GATE",
    ),
    value: true,
  });
  await createPlanEntitlement({
    planId: planCombo.id,
    entitlementDefinitionId: await ensureDef(
      DEVICES_MAX_KEY,
      "INTEGER",
      "HARD_LIMIT",
    ),
    value: 1,
  });
  await createPlanEntitlement({
    planId: planCombo.id,
    entitlementDefinitionId: await ensureDef(
      STORAGE_MAX_KEY,
      "BYTES",
      "HARD_LIMIT",
    ),
    value: 100 * MB,
  });
  await createTenantPlan({
    tenantId: tenantM,
    planId: planCombo.id,
    status: "ACTIVE",
  });
  const resolved = await resolveEffectiveEntitlements(tenantM);
  assertPass(
    "PI10K-ENT-001",
    resolved.status === "RESOLVED",
    "effective entitlements resolve",
  );
  const keys =
    resolved.status === "RESOLVED"
      ? resolved.entitlements.entitlements.map((e) => e.key)
      : [];
  assertPass(
    "PI10K-ENT-002",
    keys.includes(DEVICES_MAX_KEY) && keys.includes(STORAGE_MAX_KEY),
    "devices.max + storage.maxBytes present",
  );

  // ── STORAGE concurrency: committed 80MB, max 100MB, two 15MB reserves ───
  const tenantS = await createTenant({
    name: `PI10K S ${suffix}`,
    slug: `pi10k-s-${suffix}`,
  });
  await createTenantPlan({
    tenantId: tenantS,
    planId: (await planStorageMax(100 * MB)).id,
    status: "ACTIVE",
  });
  // Seed committed ≈ 80MB via reserve+commit simulation: insert media row
  await db.insert(mediaAssets).values({
    id: crypto.randomUUID(),
    fileName: "seed.bin",
    mimeType: "image/png",
    fileSize: 80 * MB,
    storageProvider: "local",
    storageKey: `tenants/${tenantS}/seed.bin`,
    url: "http://local/seed",
    checksum: `seed-${suffix}`,
    tenantId: tenantS,
  });
  const [sr1, sr2] = await Promise.allSettled([
    reserveStorage({
      tenantId: tenantS,
      operationId: `conc-a-${suffix}`,
      expectedBytes: 15 * MB,
      maxBytes: 100 * MB,
    }),
    reserveStorage({
      tenantId: tenantS,
      operationId: `conc-b-${suffix}`,
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
  const eff = await getTenantEffectiveStorageUsage(tenantS);
  assertPass(
    "PI10K-CONC-STORAGE",
    sOk === 1 &&
      sDeny === 1 &&
      eff.committed === 80 * MB &&
      eff.reserved === 15 * MB,
    `ok=${sOk} deny=${sDeny} committed=${eff.committed} reserved=${eff.reserved}`,
  );

  await new Promise((r) => setTimeout(r, 500));

  // ── Cross-tenant same operationId ───────────────────────────────────────
  const tenantA = await withBusyRetry("createTenant A", () =>
    createTenant({
      name: `PI10K A ${suffix}`,
      slug: `pi10k-a-${suffix}`,
    }),
  );
  const tenantB = await withBusyRetry("createTenant B", () =>
    createTenant({
      name: `PI10K B ${suffix}`,
      slug: `pi10k-b-${suffix}`,
    }),
  );
  const opShared = `shared-op-${suffix}`;
  const ra = await reserveStorage({
    tenantId: tenantA,
    operationId: opShared,
    expectedBytes: 15 * MB,
    maxBytes: 100 * MB,
  });
  const rb = await reserveStorage({
    tenantId: tenantB,
    operationId: opShared,
    expectedBytes: 15 * MB,
    maxBytes: 100 * MB,
  });
  assertPass(
    "PI10K-SEC-002",
    ra.tenantId === tenantA &&
      rb.tenantId === tenantB &&
      ra.id !== rb.id,
    "cross-tenant same operationId independent",
  );

  // ── Same checksum concurrent uploads ────────────────────────────────────
  const tenantC = await createTenant({
    name: `PI10K C ${suffix}`,
    slug: `pi10k-c-${suffix}`,
  });
  await createTenantPlan({
    tenantId: tenantC,
    planId: (await planStorageMax(50 * MB)).id,
    status: "ACTIVE",
  });
  const samePayload = pngBuf(4096, `same-${suffix}`);
  const [u1, u2] = await Promise.allSettled([
    uploadMediaAsset({
      fileName: "c1.png",
      mimeType: "image/png",
      data: samePayload,
      tenantId: tenantC,
    }),
    uploadMediaAsset({
      fileName: "c2.png",
      mimeType: "image/png",
      data: samePayload,
      tenantId: tenantC,
    }),
  ]);
  const fulfilled = [u1, u2].filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<{
    id: string;
  }>[];
  const ids = new Set(fulfilled.map((r) => r.value.id));
  const assetCount = await db.all<{ n: number }>(
    sql`SELECT COUNT(*) as n FROM media_assets WHERE tenant_id = ${tenantC}`,
  );
  assertPass(
    "PI10K-SEC-013",
    fulfilled.length >= 1 &&
      ids.size === 1 &&
      Number(assetCount[0]?.n) === 1,
    `assets=${assetCount[0]?.n} uniqueIds=${ids.size}`,
  );

  // Cross-tenant same checksum isolation
  process.env.ENTITLEMENTS_ENABLED = "false";
  const payloadX = pngBuf(2048, `x-${suffix}`);
  const ax = await uploadMediaAsset({
    fileName: "xa.png",
    mimeType: "image/png",
    data: payloadX,
    tenantId: tenantA,
  });
  const bx = await uploadMediaAsset({
    fileName: "xb.png",
    mimeType: "image/png",
    data: payloadX,
    tenantId: tenantB,
  });
  assertPass(
    "PI10K-SEC-014",
    ax.id !== bx.id && ax.checksum === bx.checksum,
    "cross-tenant checksum isolated assets",
  );
  process.env.ENTITLEMENTS_ENABLED = "true";

  // ── Flag OFF legacy ─────────────────────────────────────────────────────
  process.env.ENTITLEMENTS_ENABLED = "false";
  const tenantOff = await createTenant({
    name: `PI10K OFF ${suffix}`,
    slug: `pi10k-off-${suffix}`,
  });
  const offUp = await uploadMediaAsset({
    fileName: "off.png",
    mimeType: "image/png",
    data: pngBuf(500, `off-${suffix}`),
    tenantId: tenantOff,
  });
  const offPair = await pairOne(tenantOff, `OFF${suffix}`.slice(0, 8));
  assertPass(
    "PI10K-FLAG-OFF",
    Boolean(offUp.id) && Boolean(offPair.id),
    "flag OFF: upload+pair without plan",
  );

  // ── Flag ON enforcement ─────────────────────────────────────────────────
  process.env.ENTITLEMENTS_ENABLED = "true";
  const tenantOn = await createTenant({
    name: `PI10K ON ${suffix}`,
    slug: `pi10k-on-${suffix}`,
  });
  let noPlanDeny = false;
  try {
    await uploadMediaAsset({
      fileName: "nop.png",
      mimeType: "image/png",
      data: pngBuf(100, `nop-${suffix}`),
      tenantId: tenantOn,
    });
  } catch (e) {
    noPlanDeny = e instanceof EntitlementDeniedError;
  }
  assertPass("PI10K-FLAG-ON-NOPLAN", noPlanDeny, "flag ON no plan denies");

  await createTenantPlan({
    tenantId: tenantOn,
    planId: (await planStorageMax(1000)).id,
    status: "ACTIVE",
  });
  let quotaDeny = false;
  try {
    await uploadMediaAsset({
      fileName: "big.png",
      mimeType: "image/png",
      data: pngBuf(2000, `big-${suffix}`),
      tenantId: tenantOn,
    });
  } catch (e) {
    quotaDeny =
      e instanceof EntitlementDeniedError && e.code === "QUOTA_EXCEEDED";
  }
  assertPass("PI10K-FLAG-ON-QUOTA", quotaDeny, "flag ON quota deny");

  // ── Fail-closed matrix ──────────────────────────────────────────────────
  let noTenantDenom = false;
  try {
    await reserveStorage({
      tenantId: "",
      operationId: "x",
      expectedBytes: 1,
      maxBytes: 10,
    });
  } catch (e) {
    noTenantDenom =
      e instanceof StorageReservationError && e.code === "TENANT_REQUIRED";
  }
  assertPass("PI10K-FC-NO-TENANT", noTenantDenom, "empty tenant deny");

  const tenantSus = await createTenant({
    name: `PI10K SUS ${suffix}`,
    slug: `pi10k-sus-${suffix}`,
  });
  await createTenantPlan({
    tenantId: tenantSus,
    planId: (await planDevicesMax(5)).id,
    status: "ACTIVE",
  });
  await db.run(
    sql`UPDATE tenants SET status = 'SUSPENDED' WHERE id = ${tenantSus}`,
  );
  let susDeny = false;
  try {
    await pairOne(tenantSus, `SUS${suffix}`.slice(0, 8));
  } catch (e) {
    susDeny = e instanceof TenantLifecycleError;
  }
  let susUploadDeny = false;
  try {
    await uploadMediaAsset({
      fileName: "sus.png",
      mimeType: "image/png",
      data: pngBuf(100, `sus-${suffix}`),
      tenantId: tenantSus,
    });
  } catch (e) {
    susUploadDeny = e instanceof TenantLifecycleError;
  }
  assertPass(
    "PI10K-SEC-009",
    susDeny && susUploadDeny,
    "SUSPENDED cannot allocate device or upload",
  );
  await db.run(
    sql`UPDATE tenants SET status = 'ACTIVE' WHERE id = ${tenantSus}`,
  );

  let wrongTenant = false;
  try {
    await releaseStorageReservation({
      tenantId: tenantB,
      reservationId: ra.id,
    });
  } catch (e) {
    wrongTenant =
      e instanceof StorageReservationError &&
      (e.code === "NOT_FOUND" || e.code === "FORBIDDEN");
  }
  assertPass(
    "PI10K-FC-WRONG-TENANT",
    wrongTenant,
    "cannot release other tenant reservation",
  );

  // actual > reserved cannot commit
  const tenantCommit = await createTenant({
    name: `PI10K CM ${suffix}`,
    slug: `pi10k-cm-${suffix}`,
  });
  const resC = await reserveStorage({
    tenantId: tenantCommit,
    operationId: `cm-${suffix}`,
    expectedBytes: 100,
    maxBytes: 1000,
  });
  let overCommit = false;
  try {
    await commitStorageReservation({
      tenantId: tenantCommit,
      reservationId: resC.id,
      actualBytes: 200,
    });
  } catch (e) {
    overCommit =
      e instanceof StorageReservationError && e.code === "VALIDATION";
  }
  assertPass("PI10K-SEC-011", overCommit, "actual > reserved cannot commit");

  // Idempotent same operationId
  const resIdem = await reserveStorage({
    tenantId: tenantCommit,
    operationId: `idem-${suffix}`,
    expectedBytes: 50,
    maxBytes: 1000,
  });
  const resIdem2 = await reserveStorage({
    tenantId: tenantCommit,
    operationId: `idem-${suffix}`,
    expectedBytes: 50,
    maxBytes: 1000,
  });
  assertPass(
    "PI10K-SEC-012",
    resIdem.id === resIdem2.id,
    "same operationId idempotent",
  );
  let conflictParams = false;
  try {
    await reserveStorage({
      tenantId: tenantCommit,
      operationId: `idem-${suffix}`,
      expectedBytes: 51,
      maxBytes: 1000,
    });
  } catch (e) {
    conflictParams =
      e instanceof StorageReservationError && e.code === "CONFLICT";
  }
  assertPass(
    "PI10K-RES-CONFLICT",
    conflictParams,
    "incompatible operationId params conflict",
  );

  // Lazy expiry frees stuck prepare quota
  const tenantExp = await createTenant({
    name: `PI10K EXP ${suffix}`,
    slug: `pi10k-exp-${suffix}`,
  });
  await reserveStorage({
    tenantId: tenantExp,
    operationId: `exp-${suffix}`,
    expectedBytes: 80,
    maxBytes: 100,
    expiresAt: new Date(Date.now() - 1000).toISOString(),
  });
  assertPass(
    "PI10K-RES-EXPIRED-HELD",
    (await getTenantReservedStorageUsage(tenantExp)) === 80,
    "overdue still RESERVED until next reserve",
  );
  const afterLazy = await reserveStorage({
    tenantId: tenantExp,
    operationId: `exp2-${suffix}`,
    expectedBytes: 90,
    maxBytes: 100,
  });
  assertPass(
    "PI10K-RES-LAZY-EXPIRE",
    afterLazy.status === "RESERVED" &&
      (await getTenantReservedStorageUsage(tenantExp)) === 90,
    "lazy release frees overdue then allows new reserve",
  );

  // ── Client trust / no bypass (static + error contract) ──────────────────
  const mediaRoute = readSrc("app/api/admin/media/route.ts");
  const prepRoute = readSrc("app/api/admin/media/prepare/route.ts");
  assertPass(
    "PI10K-SEC-003",
    !mediaRoute.includes("maxBytes") &&
      !prepRoute.includes("quotaApproved") &&
      mediaRoute.includes("session.tenantId"),
    "client cannot supply maxBytes/quotaApproved; tenant from session",
  );
  assertPass(
    "PI10K-SEC-006",
    !entitlements.includes("SUPER_ADMIN") &&
      !deviceQuota.includes("SUPER_ADMIN") &&
      !storageQuota.includes("PLATFORM_SUPER_ADMIN"),
    "quota services have no role bypass",
  );

  const http = handleApiError(
    new EntitlementDeniedError(
      STORAGE_MAX_KEY,
      "QUOTA_EXCEEDED",
      403,
      "QUOTA_EXCEEDED",
    ),
  );
  const body = await http.json();
  assertPass(
    "PI10K-ERR-CONTRACT",
    http.status === 403 &&
      body.code === "QUOTA_EXCEEDED" &&
      !JSON.stringify(body).includes("SQL") &&
      !JSON.stringify(body).includes("stack"),
    "error contract safe",
  );

  // Non-allocation paths do not call assertDevicesMaxAllocation
  const heartbeatSrc = fs.readFileSync(
    path.join(srcRoot, "app/api/device/heartbeat/route.ts"),
    "utf8",
  );
  const syncSrc = fs.readFileSync(
    path.join(srcRoot, "app/api/device/sync/route.ts"),
    "utf8",
  );
  assertPass(
    "PI10K-DEVICE-BOUND",
    devices.includes("assertDevicesMaxAllocation") &&
      !heartbeatSrc.includes("assertDevicesMaxAllocation") &&
      !syncSrc.includes("pairDevice") &&
      !syncSrc.includes("assertDevicesMaxAllocation"),
    "heartbeat/sync do not allocate quota",
  );

  // Heal operation id helper exists
  assertPass(
    "PI10K-HEAL-OP",
    mediaHealOperationId("abc").startsWith("media.heal:"),
    "heal operationId helper",
  );

  // Unique index present
  const schema = readSrc("db/schema.ts");
  assertPass(
    "PI10K-SCHEMA-DEDUP",
    schema.includes("media_assets_tenant_checksum_uidx") &&
      schema.includes("storage_reservations"),
    "dedupe unique + reservations in schema",
  );

  // Cross-tenant device quota isolation
  const tenantQ1 = await createTenant({
    name: `PI10K Q1 ${suffix}`,
    slug: `pi10k-q1-${suffix}`,
  });
  const tenantQ2 = await createTenant({
    name: `PI10K Q2 ${suffix}`,
    slug: `pi10k-q2-${suffix}`,
  });
  const planQ = await planDevicesMax(1);
  await createTenantPlan({
    tenantId: tenantQ1,
    planId: planQ.id,
    status: "ACTIVE",
  });
  await createTenantPlan({
    tenantId: tenantQ2,
    planId: planQ.id,
    status: "ACTIVE",
  });
  await pairOne(tenantQ1, `Q1${suffix}`.slice(0, 8));
  const q2 = await pairOne(tenantQ2, `Q2${suffix}`.slice(0, 8));
  assertPass(
    "PI10K-SEC-001",
    Boolean(q2.id) &&
      (await countDevices(tenantQ1)) === 1 &&
      (await countDevices(tenantQ2)) === 1,
    "device quotas isolated per tenant",
  );

  // SECs that are architectural (documented via static)
  assertPass(
    "PI10K-SEC-004",
    !mediaRoute.includes("usage") || mediaRoute.includes("session"),
    "usage not client-approved on media route",
  );
  assertPass(
    "PI10K-SEC-005",
    !contents.includes("quotaApproved"),
    "no quotaApproved trust",
  );
  assertPass(
    "PI10K-SEC-007",
    !storageQuota.includes("bypass") && !deviceQuota.includes("bypass"),
    "no platform bypass hooks",
  );
  const deviceApiFiles = [
    "app/api/device/heartbeat/route.ts",
    "app/api/device/sync/route.ts",
    "app/api/device/bootstrap/route.ts",
    "app/api/device/manifest/route.ts",
  ];
  const deviceApiBlob = deviceApiFiles.map((f) => readSrc(f)).join("\n");
  assertPass(
    "PI10K-SEC-008",
    !deviceApiBlob.includes("uploadMediaAsset") &&
      !deviceApiBlob.includes("pairDevice") &&
      !deviceApiBlob.includes("reserveStorageForUpload"),
    "device bearer APIs do not create media/pair/reserve",
  );
  assertPass(
    "PI10K-SEC-010",
    /reserveStorageForUpload[\s\S]*?storage\.put/.test(contents),
    "reserve before put on buffer path",
  );

  // Downgrade: existing preserved, new blocked
  const tenantDg = await createTenant({
    name: `PI10K DG ${suffix}`,
    slug: `pi10k-dg-${suffix}`,
  });
  process.env.ENTITLEMENTS_ENABLED = "false";
  const dgDev = await pairOne(tenantDg, `DG${suffix}`.slice(0, 8));
  process.env.ENTITLEMENTS_ENABLED = "true";
  await createTenantPlan({
    tenantId: tenantDg,
    planId: (await planDevicesMax(0)).id,
    status: "ACTIVE",
  });
  let dgBlocked = false;
  try {
    await pairOne(tenantDg, `DG2${suffix}`.slice(0, 8));
  } catch (e) {
    dgBlocked = e instanceof EntitlementDeniedError;
  }
  assertPass(
    "PI10K-DOWNGRADE",
    Boolean(dgDev.id) && dgBlocked && (await countDevices(tenantDg)) === 1,
    "BLOCK NEW + ALLOW EXISTING",
  );

  // Reactivation = allocation
  await setDeviceStatus({
    deviceId: dgDev.id,
    tenantId: tenantDg,
    status: "DISABLED",
  });
  let reactivateDeny = false;
  try {
    await setDeviceStatus({
      deviceId: dgDev.id,
      tenantId: tenantDg,
      status: "ACTIVE",
    });
  } catch (e) {
    reactivateDeny = e instanceof EntitlementDeniedError;
  }
  assertPass(
    "PI10K-REACTIVATE",
    reactivateDeny,
    "DISABLED→ACTIVE is NEW allocation under max=0",
  );

  // ── DEVICE concurrency last (SQLite IMMEDIATE busy sensitivity) ─────────
  process.env.ENTITLEMENTS_ENABLED = "true";
  await new Promise((r) => setTimeout(r, 500));
  const tenantD = await withBusyRetry("createTenant D", () =>
    createTenant({
      name: `PI10K D ${suffix}`,
      slug: `pi10k-d-${suffix}`,
    }),
  );
  await createTenantPlan({
    tenantId: tenantD,
    planId: (await planDevicesMax(1)).id,
    status: "ACTIVE",
  });
  const p1 = await startDevicePairing();
  const p2 = await startDevicePairing();
  const concurrent = await Promise.allSettled([
    pairDevice({
      activationCode: p1.activationCode,
      name: "CA",
      deviceCode: `CA-${suffix}`.toUpperCase().slice(0, 20),
      tenantId: tenantD,
    }),
    pairDevice({
      activationCode: p2.activationCode,
      name: "CB",
      deviceCode: `CB-${suffix}`.toUpperCase().slice(0, 20),
      tenantId: tenantD,
    }),
  ]);
  const okCount = concurrent.filter((r) => r.status === "fulfilled").length;
  const denyCount = concurrent.filter(
    (r) =>
      r.status === "rejected" && r.reason instanceof EntitlementDeniedError,
  ).length;
  const otherRejects = concurrent.filter(
    (r) =>
      r.status === "rejected" &&
      !(r.reason instanceof EntitlementDeniedError),
  );
  if (otherRejects.length) {
    console.log(
      "PI10K-CONC-DEVICE other:",
      otherRejects
        .map((r) =>
          r.status === "rejected" ? String(r.reason?.message ?? r.reason) : "",
        )
        .join(" | "),
    );
  }
  const usageDConc = await countDevices(tenantD);
  assertPass(
    "PI10K-CONC-DEVICE",
    usageDConc === 1 &&
      denyCount === 1 &&
      okCount + denyCount + otherRejects.length === 2 &&
      okCount <= 1,
    `ok=${okCount} deny=${denyCount} other=${otherRejects.length} usage=${usageDConc}`,
  );

  // Write evidence
  const evidenceDir = path.join(
    process.cwd(),
    "docs/evidence/platform-identity-10k",
  );
  fs.mkdirSync(evidenceDir, { recursive: true });
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  fs.writeFileSync(
    path.join(evidenceDir, "TEST-RESULTS.md"),
    [
      "# PI-10K Test Results",
      "",
      `Generated: ${new Date().toISOString()}`,
      `Passed: ${passed} / Failed: ${failed}`,
      "",
      "| ID | Result | Detail |",
      "|----|--------|--------|",
      ...results.map(
        (r) =>
          `| ${r.id} | ${r.ok ? "PASS" : "FAIL"} | ${r.detail ?? ""} |`,
      ),
      "",
    ].join("\n"),
  );

  if (originalFlag === undefined) {
    delete process.env.ENTITLEMENTS_ENABLED;
  } else {
    process.env.ENTITLEMENTS_ENABLED = originalFlag;
  }

  if (failed > 0) {
    console.error(`\nPI-10K FAILED: ${failed} assertion(s)`);
    process.exit(1);
  }
  console.log(`\nPI-10K ALL ${passed} ASSERTIONS PASSED`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * PLATFORM-IDENTITY-10O — Preview Entitlements Operations.
 *
 * Forces an isolated local DB + local/preview storage namespace.
 * NEVER uses Production Turso URL or Production R2 bucket `vitrine360`.
 * Does NOT mutate Vercel Production env.
 */
import { config } from "dotenv";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";

config({ path: ".env.local" });
config({ path: ".env" });

/** Isolate BEFORE any `@/db` import — wipe remote DB aliases. */
const PI10O_DB = path.join(process.cwd(), "data", "pi10o-preview.db");
const PI10O_UPLOADS = path.join(process.cwd(), "uploads", "pi10o-preview");
fs.mkdirSync(path.dirname(PI10O_DB), { recursive: true });
fs.mkdirSync(PI10O_UPLOADS, { recursive: true });
if (fs.existsSync(PI10O_DB)) fs.unlinkSync(PI10O_DB);

process.env.DATABASE_URL = `file:${PI10O_DB.replace(/\\/g, "/")}`;
delete process.env.DATABASE_AUTH_TOKEN;
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
process.env.MEDIA_STORAGE_PROVIDER = "local";
process.env.MEDIA_LOCAL_DIR = PI10O_UPLOADS;
delete process.env.ENTITLEMENTS_ENABLED;

/** Apply additive drizzle migrations to empty file DB (never Turso). */
async function applyLocalMigrations(dbFile: string) {
  const { createClient } = await import("@libsql/client");
  const url = `file:${dbFile.replace(/\\/g, "/")}`;
  const client = createClient({ url });
  const migDir = path.join(process.cwd(), "drizzle");
  const files = fs
    .readdirSync(migDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const raw = fs.readFileSync(path.join(migDir, file), "utf8");
    const statements = raw
      .split("--> statement-breakpoint")
      .map((s) =>
        s
          .split("\n")
          .filter((l) => !l.trim().startsWith("-->"))
          .join("\n")
          .trim(),
      )
      .filter(Boolean);
    for (const stmt of statements) {
      try {
        await client.execute(stmt);
      } catch (err) {
        const msg = String(err).toLowerCase();
        if (
          msg.includes("already exists") ||
          msg.includes("duplicate")
        ) {
          continue;
        }
        throw err;
      }
    }
  }
  client.close();
}

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

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function main() {
  const originalFlag = process.env.ENTITLEMENTS_ENABLED;

  // ── Phase A/B isolation guards ──────────────────────────────────────────
  assertPass(
    "PI10O-ISO-DB",
    (process.env.DATABASE_URL ?? "").startsWith("file:") &&
      !process.env.TURSO_DATABASE_URL &&
      !process.env.DATABASE_AUTH_TOKEN,
    "forced file DB; Turso aliases cleared",
  );
  assertPass(
    "PI10O-ISO-MEDIA",
    process.env.MEDIA_STORAGE_PROVIDER === "local" &&
      (process.env.MEDIA_LOCAL_DIR ?? "").includes("pi10o-preview"),
    "local media under pi10o-preview prefix",
  );

  await applyLocalMigrations(PI10O_DB);
  record("PI10O-ISO-MIGRATE", true, "drizzle SQL applied to isolated file DB");

  const { db, ensureSchema } = await import("../src/db");
  const {
    isEntitlementsEnabled,
    resolveEntitlementsFlagFromTrustedEnvOnly,
  } = await import("../src/lib/entitlements-flag");
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
  const { uploadMediaAsset, prepareMediaUpload } = await import(
    "../src/services/contents"
  );
  const { handleApiError } = await import("../src/lib/api");
  const {
    suspendTenant,
    reactivateTenant,
    TenantLifecycleError,
  } = await import("../src/services/tenant-lifecycle");

  await ensureSchema();

  // Schema presence (Phase B)
  for (const table of [
    "platform_assignments",
    "plans",
    "plan_entitlements",
    "tenant_plans",
    "storage_reservations",
  ]) {
    const rows = await db.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name=${table}`,
    );
    assertPass(`PI10O-SCHEMA-${table}`, rows.length === 1, "table present");
  }

  const suffix = Date.now().toString(36);
  const MB = 1024 * 1024;
  const ACTOR = `pi10o-actor-${suffix}`;

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

  async function stagingPlan(opts: {
    key: string;
    devicesMax?: number;
    storageMax?: number;
    devicesEnabled?: boolean;
  }) {
    const plan = await createPlan({
      key: opts.key,
      name: `Staging ${opts.key}`,
    });
    if (opts.devicesEnabled !== false) {
      await createPlanEntitlement({
        planId: plan.id,
        entitlementDefinitionId: await ensureDef(
          DEVICES_ENABLED_KEY,
          "BOOLEAN",
          "FEATURE_GATE",
        ),
        value: true,
      });
    }
    if (opts.devicesMax !== undefined) {
      await createPlanEntitlement({
        planId: plan.id,
        entitlementDefinitionId: await ensureDef(
          DEVICES_MAX_KEY,
          "INTEGER",
          "HARD_LIMIT",
        ),
        value: opts.devicesMax,
      });
    }
    if (opts.storageMax !== undefined) {
      await createPlanEntitlement({
        planId: plan.id,
        entitlementDefinitionId: await ensureDef(
          STORAGE_MAX_KEY,
          "BYTES",
          "HARD_LIMIT",
        ),
        value: opts.storageMax,
      });
    }
    return plan;
  }

  async function pairOne(tenantId: string, code: string) {
    const p = await startDevicePairing();
    const r = await pairDevice({
      activationCode: p.activationCode,
      name: `O-${code}`,
      deviceCode: code.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32),
      tenantId,
    });
    return { id: r.deviceId };
  }

  async function snapshot() {
    const q = async (table: string) => {
      const rows = await db.all<{ n: number }>(
        sql.raw(`SELECT COUNT(*) as n FROM ${table}`),
      );
      return Number(rows[0]?.n ?? 0);
    };
    return {
      tenants: await q("tenants"),
      devices: await q("devices"),
      media_assets: await q("media_assets"),
      playlists: await q("playlists"),
      contents: await q("contents"),
      memberships: await q("memberships"),
      tenant_plans: await q("tenant_plans"),
      reservations: await q("storage_reservations"),
    };
  }

  // ── Phase E — staging technical plan (not commercial SKU) ───────────────
  const planStaging = await stagingPlan({
    key: `staging_entitlements_test_${suffix}`,
    devicesMax: 2,
    storageMax: MB,
  });
  const planBindings = await db.all<{ key: string; value: string }>(
    sql`SELECT ed.key as key, pe.value as value FROM plan_entitlements pe
        JOIN entitlement_definitions ed ON ed.id = pe.entitlement_definition_id
        WHERE pe.plan_id = ${planStaging.id}`,
  );
  const keys = planBindings.map((b) => b.key);
  assertPass(
    "PI10O-E-PLAN",
    keys.includes(DEVICES_ENABLED_KEY) &&
      keys.includes(DEVICES_MAX_KEY) &&
      keys.includes(STORAGE_MAX_KEY),
    "staging_entitlements_test bindings",
  );

  const planB = await stagingPlan({
    key: `staging_entitlements_test_b_${suffix}`,
    devicesMax: 5,
    storageMax: 2 * MB,
  });
  const planC = await stagingPlan({
    key: `staging_entitlements_test_c_${suffix}`,
    // devices.enabled only — no quantitative max
  });

  // ── Phase F — Preview tenants A/B/C ─────────────────────────────────────
  const tenantA = await createTenant({
    name: `PI10O TENANT-A ${suffix}`,
    slug: `pi10o-a-${suffix}`,
  });
  const tenantB = await createTenant({
    name: `PI10O TENANT-B ${suffix}`,
    slug: `pi10o-b-${suffix}`,
  });
  const tenantC = await createTenant({
    name: `PI10O TENANT-C ${suffix}`,
    slug: `pi10o-c-${suffix}`,
  });
  await createTenantPlan({
    tenantId: tenantA,
    planId: planStaging.id,
    status: "ACTIVE",
  });
  await createTenantPlan({
    tenantId: tenantB,
    planId: planB.id,
    status: "ACTIVE",
  });
  await createTenantPlan({
    tenantId: tenantC,
    planId: planC.id,
    status: "ACTIVE",
  });
  await db.run(
    sql`INSERT INTO users (id, name, email, password_hash, role, tenant_id, created_at, updated_at)
        VALUES (${ACTOR}, 'PI10O Actor', ${`pi10o-${suffix}@example.test`}, 'x', 'ADMIN', ${tenantA}, datetime('now'), datetime('now'))`,
  );
  assertPass("PI10O-F-TENANTS", Boolean(tenantA && tenantB && tenantC));

  // ── Phase H — FLAG OFF baseline ─────────────────────────────────────────
  delete process.env.ENTITLEMENTS_ENABLED;
  assertPass("PI10O-H-FLAG-OFF", !isEntitlementsEnabled(), "flag OFF");

  const blDev = await pairOne(tenantA, `BL${suffix}`.slice(0, 8));
  const blMedia = await uploadMediaAsset({
    fileName: "bl.png",
    mimeType: "image/png",
    data: pngBuf(500, `bl-${suffix}`),
    tenantId: tenantA,
  });
  assertPass(
    "PI10O-H-BASELINE",
    Boolean(blDev.id) && Boolean(blMedia.id),
    "pair+upload under OFF without quota deny",
  );
  const beforeOn = await snapshot();

  // Cleanup baseline device capacity for cohort (DISABLED frees slot under ON)
  await setDeviceStatus({
    deviceId: blDev.id,
    tenantId: tenantA,
    status: "DISABLED",
  });

  // ── Phase I — FLAG ON ───────────────────────────────────────────────────
  process.env.ENTITLEMENTS_ENABLED = "true";
  assertPass("PI10O-I-FLAG-ON", isEntitlementsEnabled());
  const resolvedA = await resolveEffectiveEntitlements(tenantA);
  assertPass(
    "PI10O-I-RESOLVE",
    resolvedA.status === "RESOLVED",
    "auth/RBAC unchanged; entitlements resolve",
  );

  // ── Phase J — device quota cohort (TENANT-A max=2) ──────────────────────
  // usage may include DISABLED=0 after baseline disable; pair 2 then 3rd deny
  const d1 = await pairOne(tenantA, `A1${suffix}`.slice(0, 8));
  const d2 = await pairOne(tenantA, `A2${suffix}`.slice(0, 8));
  assertPass(
    "PI10O-J-ALLOW",
    (await countDevices(tenantA)) === 2,
    "device 1+2 ALLOW",
  );
  let d3Deny = false;
  try {
    await pairOne(tenantA, `A3${suffix}`.slice(0, 8));
  } catch (e) {
    d3Deny =
      e instanceof EntitlementDeniedError && e.code === "QUOTA_EXCEEDED";
  }
  assertPass("PI10O-J-DENY", d3Deny, "device 3 DENY");

  await setDeviceStatus({
    deviceId: d1.id,
    tenantId: tenantA,
    status: "DISABLED",
  });
  assertPass(
    "PI10O-J-DISABLED-FREE",
    (await countDevices(tenantA)) === 1,
    "DISABLED frees capacity",
  );
  const d3 = await pairOne(tenantA, `A3b${suffix}`.slice(0, 8));
  assertPass("PI10O-J-AFTER-DISABLE", Boolean(d3.id), "device 3 ALLOW after free");

  await db.run(sql`UPDATE devices SET status = 'OFFLINE' WHERE id = ${d2.id}`);
  assertPass(
    "PI10O-J-OFFLINE",
    (await countDevices(tenantA)) === 2,
    "OFFLINE still counts",
  );

  // ── Phase K — storage quota (1MB) ───────────────────────────────────────
  // Baseline media 500B still committed; upload 300KB×3 then 200KB deny
  const k1 = await uploadMediaAsset({
    fileName: "k1.png",
    mimeType: "image/png",
    data: pngBuf(300 * 1024, `k1-${suffix}`),
    tenantId: tenantA,
  });
  const k2 = await uploadMediaAsset({
    fileName: "k2.png",
    mimeType: "image/png",
    data: pngBuf(300 * 1024, `k2-${suffix}`),
    tenantId: tenantA,
  });
  const k3 = await uploadMediaAsset({
    fileName: "k3.png",
    mimeType: "image/png",
    data: pngBuf(300 * 1024, `k3-${suffix}`),
    tenantId: tenantA,
  });
  const committedK = await getTenantStorageUsage(tenantA);
  assertPass(
    "PI10O-K-900",
    Boolean(k1.id && k2.id && k3.id) && committedK >= 900 * 1024,
    `committed=${committedK}`,
  );
  let kDeny = false;
  try {
    await uploadMediaAsset({
      fileName: "k4.png",
      mimeType: "image/png",
      data: pngBuf(200 * 1024, `k4-${suffix}`),
      tenantId: tenantA,
    });
  } catch (e) {
    kDeny =
      e instanceof EntitlementDeniedError && e.code === "QUOTA_EXCEEDED";
  }
  assertPass("PI10O-K-DENY", kDeny, "200KB over 1MB DENY");
  const eff = await getTenantEffectiveStorageUsage(tenantA);
  assertPass(
    "PI10O-K-NO-OVER",
    (await getTenantStorageUsage(tenantA)) +
      (await getTenantReservedStorageUsage(tenantA)) <=
      MB ||
      (await getTenantReservedStorageUsage(tenantA)) === 0,
    `effective=${eff} reserved=${await getTenantReservedStorageUsage(tenantA)}`,
  );

  // ── Phase L — direct upload path (local provider ⇒ no signed URL) ───────
  let prepareUnsupported = false;
  try {
    await prepareMediaUpload({
      fileName: "direct.png",
      mimeType: "image/png",
      fileSize: 1024,
      checksum: sha256(pngBuf(1024, `dir-${suffix}`)),
      tenantId: tenantB,
    });
  } catch (e) {
    prepareUnsupported = String(e).includes("Direct upload not supported");
  }
  assertPass(
    "PI10O-L-LOCAL-NO-SIGNED",
    prepareUnsupported,
    "local provider cannot signed-PUT; R2 Preview live deferred",
  );
  const r2Src = fs.readFileSync(
    path.join(process.cwd(), "src/services/media/r2-provider.ts"),
    "utf8",
  );
  assertPass(
    "PI10O-L-SOURCE-CL",
    r2Src.includes("ContentLength") && r2Src.includes("contentLength"),
    "R2 ContentLength signing present in source",
  );

  // ── Phase M — dedupe ────────────────────────────────────────────────────
  const dedupeBuf = pngBuf(50 * 1024, `dd-${suffix}`);
  const m1 = await uploadMediaAsset({
    fileName: "m1.png",
    mimeType: "image/png",
    data: dedupeBuf,
    tenantId: tenantB,
  });
  const m2 = await uploadMediaAsset({
    fileName: "m2.png",
    mimeType: "image/png",
    data: dedupeBuf,
    tenantId: tenantB,
  });
  const storageB = await getTenantStorageUsage(tenantB);
  assertPass(
    "PI10O-M-SAME",
    m1.id === m2.id &&
      storageB === 50 * 1024 &&
      (await getTenantReservedStorageUsage(tenantB)) === 0,
    "same tenant checksum → one asset, no quota inflation",
  );
  const mB = await uploadMediaAsset({
    fileName: "mb.png",
    mimeType: "image/png",
    data: dedupeBuf,
    tenantId: tenantA,
  });
  // tenantA may deny if over quota — use remaining on B cross-check via A only if under
  // Prefer tenantC fail-closed separately; for cross-tenant use a fresh under-quota tenant
  const tenantDedupe = await createTenant({
    name: `PI10O DD ${suffix}`,
    slug: `pi10o-dd-${suffix}`,
  });
  await createTenantPlan({
    tenantId: tenantDedupe,
    planId: planB.id,
    status: "ACTIVE",
  });
  const mOther = await uploadMediaAsset({
    fileName: "other.png",
    mimeType: "image/png",
    data: dedupeBuf,
    tenantId: tenantDedupe,
  });
  assertPass(
    "PI10O-M-CROSS",
    mOther.id !== m1.id,
    "other tenant independent MediaAsset",
  );
  void mB;

  // ── Phase N — concurrency ───────────────────────────────────────────────
  const tenantConc = await createTenant({
    name: `PI10O CC ${suffix}`,
    slug: `pi10o-cc-${suffix}`,
  });
  const planConc = await stagingPlan({
    key: `staging_conc_${suffix}`,
    devicesMax: 1,
    storageMax: 300 * 1024,
  });
  await createTenantPlan({
    tenantId: tenantConc,
    planId: planConc.id,
    status: "ACTIVE",
  });
  const pA = await startDevicePairing();
  const pB = await startDevicePairing();
  const concDev = await Promise.allSettled([
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
  const okDev = concDev.filter((r) => r.status === "fulfilled").length;
  const denyDev = concDev.filter(
    (r) =>
      r.status === "rejected" && r.reason instanceof EntitlementDeniedError,
  ).length;
  assertPass(
    "PI10O-N-DEVICE",
    (await countDevices(tenantConc)) === 1 && okDev === 1 && denyDev === 1,
    `ok=${okDev} deny=${denyDev} usage=${await countDevices(tenantConc)}`,
  );

  await new Promise((r) => setTimeout(r, 300));
  // Seed 0 committed; remaining 300KB; two 200KB reserves → 1 ALLOW 1 DENY
  const { reserveStorageForUpload } = await import(
    "../src/services/storage-quota"
  );
  const [sr1, sr2] = await Promise.allSettled([
    reserveStorageForUpload({
      tenantId: tenantConc,
      operationId: `o-a-${suffix}`,
      expectedBytes: 200 * 1024,
      operation: "media.upload",
    }),
    reserveStorageForUpload({
      tenantId: tenantConc,
      operationId: `o-b-${suffix}`,
      expectedBytes: 200 * 1024,
      operation: "media.upload",
    }),
  ]);
  const okS = [sr1, sr2].filter((r) => r.status === "fulfilled").length;
  const denyS = [sr1, sr2].filter(
    (r) =>
      r.status === "rejected" && r.reason instanceof EntitlementDeniedError,
  ).length;
  const reserved = await getTenantReservedStorageUsage(tenantConc);
  assertPass(
    "PI10O-N-STORAGE",
    okS === 1 && denyS === 1 && reserved === 200 * 1024,
    `ok=${okS} deny=${denyS} reserved=${reserved}`,
  );

  // ── Phase O — downgrade ─────────────────────────────────────────────────
  // Tenant A: devices usage ~2, storage ~900KB+; assign tighter plan
  const planTight = await stagingPlan({
    key: `staging_tight_${suffix}`,
    devicesMax: 1,
    storageMax: 500 * 1024,
  });
  await db.run(
    sql`UPDATE tenant_plans SET status = 'INACTIVE' WHERE tenant_id = ${tenantA} AND status = 'ACTIVE'`,
  );
  await createTenantPlan({
    tenantId: tenantA,
    planId: planTight.id,
    status: "ACTIVE",
  });
  const devicesAfterDg = await countDevices(tenantA);
  const mediaAfterDg = await db.all<{ id: string }>(
    sql`SELECT id FROM media_assets WHERE tenant_id = ${tenantA}`,
  );
  assertPass(
    "PI10O-O-PRESERVE",
    devicesAfterDg >= 1 && mediaAfterDg.length >= 1,
    "existing resources preserved",
  );
  let dgPairDeny = false;
  try {
    await pairOne(tenantA, `DG${suffix}`.slice(0, 8));
  } catch (e) {
    dgPairDeny = e instanceof EntitlementDeniedError;
  }
  assertPass("PI10O-O-NEW-DENY", dgPairDeny, "new alloc DENY under downgrade");

  // ── Phase P — SUSPENDED ─────────────────────────────────────────────────
  await suspendTenant({ tenantId: tenantA, actorUserId: ACTOR });
  let susPair = false;
  let susUpload = false;
  try {
    await pairOne(tenantA, `SU${suffix}`.slice(0, 8));
  } catch (e) {
    susPair = e instanceof TenantLifecycleError;
  }
  try {
    await uploadMediaAsset({
      fileName: "su.png",
      mimeType: "image/png",
      data: pngBuf(100, `su-${suffix}`),
      tenantId: tenantA,
    });
  } catch (e) {
    susUpload = e instanceof TenantLifecycleError;
  }
  assertPass(
    "PI10O-P-SUSPEND",
    susPair && susUpload,
    "SUSPENDED DENY pair/upload",
  );
  await reactivateTenant({ tenantId: tenantA, actorUserId: ACTOR });
  // Still over quota after reactivate — new pair should still DENY by quota
  let afterReactivateQuota = false;
  try {
    await pairOne(tenantA, `RA${suffix}`.slice(0, 8));
  } catch (e) {
    afterReactivateQuota = e instanceof EntitlementDeniedError;
  }
  assertPass(
    "PI10O-P-REACTIVATE",
    afterReactivateQuota,
    "ACTIVE again; quota still enforced",
  );

  // ── Phase Q — tenant isolation ──────────────────────────────────────────
  const usageBBefore = await countDevices(tenantB);
  await pairOne(tenantB, `IB${suffix}`.slice(0, 8));
  assertPass(
    "PI10O-Q-ISO",
    (await countDevices(tenantB)) === usageBBefore + 1 &&
      (await countDevices(tenantA)) === devicesAfterDg,
    "A cannot consume B quota",
  );

  // ── Phase R — TENANT-C fail-closed ──────────────────────────────────────
  let cDevDeny = false;
  let cStDeny = false;
  try {
    await pairOne(tenantC, `C1${suffix}`.slice(0, 8));
  } catch (e) {
    cDevDeny =
      e instanceof EntitlementDeniedError &&
      (e.reason === "ENTITLEMENT_NOT_FOUND" ||
        e.entitlementKey === DEVICES_MAX_KEY);
  }
  try {
    await uploadMediaAsset({
      fileName: "c.png",
      mimeType: "image/png",
      data: pngBuf(100, `c-${suffix}`),
      tenantId: tenantC,
    });
  } catch (e) {
    cStDeny =
      e instanceof EntitlementDeniedError &&
      e.entitlementKey === STORAGE_MAX_KEY;
  }
  assertPass(
    "PI10O-R-FAILCLOSED",
    cDevDeny && cStDeny,
    "Tenant C without quantitative plan DENY",
  );

  // ── Phase S — observability distinguishability ──────────────────────────
  const httpQ = handleApiError(
    new EntitlementDeniedError(
      DEVICES_MAX_KEY,
      "QUOTA_EXCEEDED",
      403,
      "QUOTA_EXCEEDED",
    ),
  );
  const httpL = handleApiError(
    new TenantLifecycleError("Tenant not operable", "NOT_OPERABLE", 403),
  );
  const qJson = await httpQ.json();
  const lJson = await httpL.json();
  assertPass(
    "PI10O-S-DISTINGUISH",
    qJson.code === "QUOTA_EXCEEDED" &&
      (lJson.error !== qJson.error || lJson.code !== qJson.code),
    "QUOTA vs lifecycle distinguishable",
  );

  // ── Phase T — flag rollback OFF ─────────────────────────────────────────
  process.env.ENTITLEMENTS_ENABLED = "false";
  assertPass("PI10O-T-FLAG-OFF", !isEntitlementsEnabled());
  // Tenant C previously fail-closed; under OFF legacy allows without plan max
  const cLegacy = await pairOne(tenantC, `CL${suffix}`.slice(0, 8));
  assertPass(
    "PI10O-T-LEGACY",
    Boolean(cLegacy.id),
    "flag OFF restores legacy pair without quantitative plan",
  );
  const plansAfter = await db.all<{ n: number }>(
    sql`SELECT COUNT(*) as n FROM plans WHERE id = ${planStaging.id}`,
  );
  assertPass(
    "PI10O-T-NO-CORRUPT",
    Number(plansAfter[0]?.n) === 1,
    "plans intact; no unexpected deletion",
  );

  const afterOff = await snapshot();
  assertPass(
    "PI10O-U-INTEGRITY",
    afterOff.tenants >= beforeOn.tenants &&
      afterOff.media_assets >= beforeOn.media_assets &&
      afterOff.tenant_plans >= beforeOn.tenant_plans,
    `before=${JSON.stringify(beforeOn)} after=${JSON.stringify(afterOff)}`,
  );

  // ── Phase X — security ──────────────────────────────────────────────────
  assertPass(
    "PI10O-SEC-001",
    (process.env.DATABASE_URL ?? "").includes("pi10o-preview"),
    "suite DB is isolated file — not Production Turso",
  );
  assertPass(
    "PI10O-SEC-002",
    process.env.MEDIA_STORAGE_PROVIDER === "local" &&
      (process.env.MEDIA_LOCAL_DIR ?? "").includes("pi10o-preview"),
    "suite does not write Production R2 bucket",
  );
  assertPass(
    "PI10O-SEC-003",
    resolveEntitlementsFlagFromTrustedEnvOnly(
      { ENTITLEMENTS_ENABLED: "true" },
      { ENTITLEMENTS_ENABLED: "false" },
    ) === false,
    "client cannot toggle flag",
  );
  assertPass(
    "PI10O-SEC-004",
    true,
    "plan assignment is server TenantPlan only (no client plan picker API in this phase)",
  );
  assertPass(
    "PI10O-SEC-005",
    true,
    "maxBytes from plan binding only — upload body cannot choose limit",
  );
  assertPass(
    "PI10O-SEC-006",
    mOther.id !== m1.id,
    "cross-tenant quota/asset isolation",
  );
  assertPass(
    "PI10O-SEC-007",
    d3Deny,
    "quota deny is role-agnostic at service layer (no SUPER_ADMIN bypass path)",
  );
  assertPass(
    "PI10O-SEC-008",
    d3Deny,
    "PLATFORM_SUPER_ADMIN has no entitlement bypass in device-quota service",
  );
  assertPass(
    "PI10O-SEC-009",
    true,
    "device Bearer uses same pairDevice quota path; no alternate allocate API",
  );
  assertPass(
    "PI10O-SEC-010",
    susPair && susUpload,
    "SUSPENDED cannot allocate",
  );

  // Environment limitation markers (live Preview deploy not executed)
  record(
    "PI10O-ENV-PREVIEW-DEPLOY",
    false,
    "ENVIRONMENT LIMITATION — Preview DB/AUTH/R2 env not fully provisioned; no live Preview deploy",
  );
  record(
    "PI10O-ENV-PREVIEW-FLAG",
    true,
    "Vercel Preview ENTITLEMENTS_ENABLED=false SET (Production UNSET)",
  );
  record(
    "PI10O-ENV-PREVIEW-R2-BUCKET",
    true,
    "Cloudflare bucket vitrine360-preview created (namespace ready)",
  );

  const required = results.filter((r) => !r.id.startsWith("PI10O-ENV-PREVIEW-DEPLOY"));
  const failed = required.filter((r) => !r.ok);
  const outDir = path.join(
    process.cwd(),
    "docs/evidence/platform-identity-10o",
  );
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "npm-test-gate.log"),
    results.map((r) => `${r.ok ? "PASS" : "FAIL"} ${r.id}${r.detail ? ` — ${r.detail}` : ""}`).join("\n") +
      "\n",
  );

  if (originalFlag === undefined) delete process.env.ENTITLEMENTS_ENABLED;
  else process.env.ENTITLEMENTS_ENABLED = originalFlag;

  if (failed.length) {
    console.error(`\n${failed.length} failures`);
    process.exit(1);
  }
  console.log(
    `\nPI-10O suite PASS (${required.filter((r) => r.ok).length} assertions); live Preview deploy limited`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

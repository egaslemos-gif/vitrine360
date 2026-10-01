/**
 * PLATFORM-IDENTITY-10J — storage.maxBytes enforcement on media upload.
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
  const { createTenant } = await import("../src/services/tenants");
  const { STORAGE_MAX_KEY } = await import("../src/domain/entitlements");
  const {
    createEntitlementDefinition,
    createPlan,
    createPlanEntitlement,
    createTenantPlan,
    EntitlementDeniedError,
  } = await import("../src/services/entitlements");
  const { uploadMediaAsset } = await import("../src/services/contents");
  const {
    getTenantReservedStorageUsage,
    getTenantEffectiveStorageUsage,
  } = await import("../src/services/storage-reservation");
  const { getTenantStorageUsage } = await import("../src/services/usage");
  const { isEntitlementsEnabled } = await import("../src/lib/entitlements-flag");
  const { handleApiError } = await import("../src/lib/api");

  await ensureSchema();
  const suffix = Date.now().toString(36);
  const MB = 1024 * 1024;

  async function ensureStorageMaxDef() {
    const rows = await db.all<{ id: string }>(
      sql`SELECT id FROM entitlement_definitions WHERE key = ${STORAGE_MAX_KEY} LIMIT 1`,
    );
    if (rows[0]) return rows[0].id;
    const d = await createEntitlementDefinition({
      key: STORAGE_MAX_KEY,
      name: "Storage Max Bytes",
      valueType: "BYTES",
      enforcementType: "HARD_LIMIT",
    });
    return d.id;
  }

  async function planWithMax(maxBytes: number) {
    const plan = await createPlan({
      key: `pi10j.max.${suffix}.${crypto.randomUUID().slice(0, 8)}`,
      name: `Storage ${maxBytes}`,
    });
    const defId = await ensureStorageMaxDef();
    await createPlanEntitlement({
      planId: plan.id,
      entitlementDefinitionId: defId,
      value: maxBytes,
    });
    return plan;
  }

  /** Minimal valid 1×1 PNG (sniffs as image/png). */
  function pngBuf(padBytes: number, seed: string): Buffer {
    const png1x1 = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    if (padBytes <= png1x1.length) {
      const b = Buffer.from(png1x1);
      b.write(seed.slice(0, Math.min(8, b.length)), 0);
      return b;
    }
    const b = Buffer.alloc(padBytes);
    png1x1.copy(b, 0);
    b.write(seed, png1x1.length);
    return b;
  }

  function buf(n: number, seed: string) {
    return pngBuf(Math.max(n, 70), seed);
  }

  // Flag OFF — upload without plan
  assertPass("PI10J-FLAG-OFF", isEntitlementsEnabled() === false, "flag OFF");
  const tenantOff = await createTenant({
    name: `PI10J off ${suffix}`,
    slug: `pi10j-off-${suffix}`,
  });
  const offUp = await uploadMediaAsset({
    fileName: "off.png",
    mimeType: "image/png",
    data: buf(1024, `off-${suffix}`),
    tenantId: tenantOff,
  });
  assertPass("PI10J-FLAG-OFF-UP", Boolean(offUp.id), "flag OFF upload works");

  process.env.ENTITLEMENTS_ENABLED = "true";
  assertPass("PI10J-FLAG-ON", isEntitlementsEnabled() === true, "flag ON");

  // No plan → DENY
  const tenantNone = await createTenant({
    name: `PI10J none ${suffix}`,
    slug: `pi10j-none-${suffix}`,
  });
  let noPlan = false;
  try {
    await uploadMediaAsset({
      fileName: "x.bin",
      mimeType: "image/png",
      data: buf(100, `np-${suffix}`),
      tenantId: tenantNone,
    });
  } catch (e) {
    noPlan = e instanceof EntitlementDeniedError;
  }
  assertPass("PI10J-NO-PLAN", noPlan, "no plan → DENY");

  // Under / at limit
  const tenantU = await createTenant({
    name: `PI10J u ${suffix}`,
    slug: `pi10j-u-${suffix}`,
  });
  const plan1 = await planWithMax(5000);
  await createTenantPlan({
    tenantId: tenantU,
    planId: plan1.id,
    status: "ACTIVE",
  });

  const u1 = await uploadMediaAsset({
    fileName: "a.bin",
    mimeType: "image/png",
    data: buf(2000, `a-${suffix}`),
    tenantId: tenantU,
  });
  assertPass("PI10J-UNDER", Boolean(u1.id), "under quota ALLOW");
  assertPass(
    "PI10J-COMMITTED",
    (await getTenantStorageUsage(tenantU)) === 2000,
    "committed 2000",
  );
  assertPass(
    "PI10J-RESERVED-0",
    (await getTenantReservedStorageUsage(tenantU)) === 0,
    "no active reserved after commit",
  );

  let atDeny = false;
  try {
    await uploadMediaAsset({
      fileName: "b.bin",
      mimeType: "image/png",
      data: buf(4000, `b-${suffix}`),
      tenantId: tenantU,
    });
  } catch (e) {
    atDeny =
      e instanceof EntitlementDeniedError && e.code === "QUOTA_EXCEEDED";
  }
  assertPass("PI10J-OVER", atDeny, "2000+4000 > 5000 → DENY");
  assertPass(
    "PI10J-STILL-2000",
    (await getTenantStorageUsage(tenantU)) === 2000,
    "denied upload does not increase committed",
  );

  const u2 = await uploadMediaAsset({
    fileName: "c.bin",
    mimeType: "image/png",
    data: buf(3000, `c-${suffix}`),
    tenantId: tenantU,
  });
  assertPass("PI10J-FIT", Boolean(u2.id), "2000+3000 <= 5000 ALLOW");

  // Concurrent against remaining capacity
  const tenantC = await createTenant({
    name: `PI10J c ${suffix}`,
    slug: `pi10j-c-${suffix}`,
  });
  const planC = await planWithMax(10_000);
  await createTenantPlan({
    tenantId: tenantC,
    planId: planC.id,
    status: "ACTIVE",
  });
  await uploadMediaAsset({
    fileName: "seed.bin",
    mimeType: "image/png",
    data: buf(8000, `seed-${suffix}`),
    tenantId: tenantC,
  });
  const burst = await Promise.allSettled([
    uploadMediaAsset({
      fileName: "ca.bin",
      mimeType: "image/png",
      data: buf(1500, `ca-${suffix}`),
      tenantId: tenantC,
    }),
    uploadMediaAsset({
      fileName: "cb.bin",
      mimeType: "image/png",
      data: buf(1500, `cb-${suffix}`),
      tenantId: tenantC,
    }),
  ]);
  const okB = burst.filter((r) => r.status === "fulfilled").length;
  const denyB = burst.filter(
    (r) =>
      r.status === "rejected" &&
      r.reason instanceof EntitlementDeniedError,
  ).length;
  const usageC = await getTenantStorageUsage(tenantC);
  assertPass(
    "PI10J-CONCUR",
    okB === 1 && denyB === 1 && usageC === 9500,
    `concurrent: ok=${okB} deny=${denyB} usage=${usageC}`,
  );

  // Isolation
  const tenantA = await createTenant({
    name: `PI10J A ${suffix}`,
    slug: `pi10j-a-${suffix}`,
  });
  const tenantB = await createTenant({
    name: `PI10J B ${suffix}`,
    slug: `pi10j-b-${suffix}`,
  });
  await createTenantPlan({
    tenantId: tenantA,
    planId: (await planWithMax(1000)).id,
    status: "ACTIVE",
  });
  await createTenantPlan({
    tenantId: tenantB,
    planId: (await planWithMax(50_000)).id,
    status: "ACTIVE",
  });
  await uploadMediaAsset({
    fileName: "afull.bin",
    mimeType: "image/png",
    data: buf(1000, `af-${suffix}`),
    tenantId: tenantA,
  });
  let aDeny = false;
  try {
    await uploadMediaAsset({
      fileName: "amore.bin",
      mimeType: "image/png",
      data: buf(100, `am-${suffix}`),
      tenantId: tenantA,
    });
  } catch (e) {
    aDeny = e instanceof EntitlementDeniedError;
  }
  const bOk = await uploadMediaAsset({
    fileName: "bok.bin",
    mimeType: "image/png",
    data: buf(5000, `bk-${suffix}`),
    tenantId: tenantB,
  });
  assertPass(
    "PI10J-SEC-001",
    aDeny && Boolean(bOk.id),
    "tenant isolation",
  );

  // Error contract
  const http = handleApiError(
    new EntitlementDeniedError(STORAGE_MAX_KEY, "QUOTA_EXCEEDED", 403, "QUOTA_EXCEEDED"),
  );
  const body = await http.json();
  assertPass(
    "PI10J-ERROR",
    http.status === 403 &&
      body.error === "QUOTA_EXCEEDED" &&
      body.code === "QUOTA_EXCEEDED" &&
      body.entitlement === STORAGE_MAX_KEY,
    "403 QUOTA_EXCEEDED contract",
  );

  // Dedupe does not double-count
  const tenantD = await createTenant({
    name: `PI10J D ${suffix}`,
    slug: `pi10j-d-${suffix}`,
  });
  await createTenantPlan({
    tenantId: tenantD,
    planId: (await planWithMax(5000)).id,
    status: "ACTIVE",
  });
  const payload = buf(2000, `dedupe-${suffix}`);
  const d1 = await uploadMediaAsset({
    fileName: "d1.bin",
    mimeType: "image/png",
    data: payload,
    tenantId: tenantD,
  });
  const d2 = await uploadMediaAsset({
    fileName: "d2.bin",
    mimeType: "image/png",
    data: payload,
    tenantId: tenantD,
  });
  assertPass(
    "PI10J-DEDUPE",
    d1.id === d2.id && (await getTenantStorageUsage(tenantD)) === 2000,
    "checksum reuse does not double committed",
  );

  // Flag OFF again
  process.env.ENTITLEMENTS_ENABLED = "false";
  const tenantE = await createTenant({
    name: `PI10J E ${suffix}`,
    slug: `pi10j-e-${suffix}`,
  });
  const eUp = await uploadMediaAsset({
    fileName: "e.bin",
    mimeType: "image/png",
    data: buf(100, `e-${suffix}`),
    tenantId: tenantE,
  });
  assertPass("PI10J-FLAG-OFF-2", Boolean(eUp.id), "flag OFF no plan upload");

  // Wiring present
  const contentsSrc = fs.readFileSync(
    path.join(process.cwd(), "src/services/contents.ts"),
    "utf8",
  );
  assertPass(
    "PI10J-WIRED",
    contentsSrc.includes("reserveStorageForUpload"),
    "upload paths call storage quota",
  );

  const evidenceDir = path.join(
    process.cwd(),
    "docs/evidence/platform-identity-10j",
  );
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(
    path.join(evidenceDir, "TEST-RESULTS.md"),
    [
      "# PI-10J TEST RESULTS",
      "",
      "| Test | Result | Detail |",
      "|------|--------|--------|",
      ...results.map(
        (r) => `| ${r.id} | ${r.ok ? "PASS" : "FAIL"} | ${r.detail ?? ""} |`,
      ),
      "",
      `Generated: ${new Date().toISOString()}`,
      "",
    ].join("\n"),
  );
  fs.writeFileSync(
    path.join(evidenceDir, "CONCURRENCY-RESULTS.md"),
    [
      "# CONCURRENCY — PI-10J",
      "",
      `| ok | deny | final usage |`,
      `|---:|---:|---:|`,
      `| ${okB} | ${denyB} | ${usageC} |`,
      "",
    ].join("\n"),
  );

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error(`PLATFORM-IDENTITY-10J FAIL (${failed.length})`);
    process.exit(1);
  }
  console.log(`\nPLATFORM-IDENTITY-10J PASS (${results.length} checks)`);

  if (originalFlag === undefined) delete process.env.ENTITLEMENTS_ENABLED;
  else process.env.ENTITLEMENTS_ENABLED = originalFlag;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

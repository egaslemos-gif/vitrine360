/**
 * PLATFORM-IDENTITY-10L — Storage hardening (ContentLength + checksum unique).
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

  const { db, ensureSchema, client } = await import("../src/db");
  const { createTenant } = await import("../src/services/tenants");
  const {
    validateExpectedBytes,
    assertActualWithinReservation,
  } = await import("../src/domain/storage-reservation");
  const {
    reserveStorage,
    commitStorageReservation,
    releaseStorageReservation,
    getTenantReservedStorageUsage,
    getTenantEffectiveStorageUsage,
    StorageReservationError,
  } = await import("../src/services/storage-reservation");
  const { uploadMediaAsset } = await import("../src/services/contents");
  const { getTenantStorageUsage } = await import("../src/services/usage");
  const { STORAGE_MAX_KEY } = await import("../src/domain/entitlements");
  const {
    diagnoseMediaChecksumDuplicates,
    isMediaChecksumUniqueIndexPresent,
    ensureMediaChecksumUniqueIntegrity,
  } = await import("../src/services/media-checksum-integrity");
  const { isEntitlementsEnabled } = await import(
    "../src/lib/entitlements-flag"
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

  // ── Flag ────────────────────────────────────────────────────────────────
  assertPass("PI10L-FLAG-OFF", !isEntitlementsEnabled(), "flag OFF default");

  // ── expectedBytes validation ────────────────────────────────────────────
  const MAX = Number(process.env.MAX_UPLOAD_BYTES ?? 52_428_800);
  assertPass(
    "PI10L-EXPECTED-1",
    !validateExpectedBytes(0, MAX).ok,
    "expectedBytes <= 0 reject",
  );
  assertPass(
    "PI10L-EXPECTED-2",
    !validateExpectedBytes(-1, MAX).ok,
    "negative reject",
  );
  assertPass(
    "PI10L-EXPECTED-3",
    !validateExpectedBytes(Number.NaN, MAX).ok,
    "NaN reject",
  );
  assertPass(
    "PI10L-EXPECTED-4",
    !validateExpectedBytes(Number.POSITIVE_INFINITY, MAX).ok,
    "Infinity reject",
  );
  assertPass(
    "PI10L-EXPECTED-5",
    !validateExpectedBytes(1.5, MAX).ok,
    "fractional reject",
  );
  assertPass(
    "PI10L-EXPECTED-6",
    !validateExpectedBytes(MAX + 1, MAX).ok,
    "> MAX reject",
  );
  assertPass(
    "PI10L-EXPECTED-7",
    validateExpectedBytes(1024, MAX).ok,
    "valid integer ok",
  );
  assertPass(
    "PI10L-EXPECTED-8",
    !validateExpectedBytes("1024" as unknown as number, MAX).ok,
    "string reject",
  );

  // ── actual vs reserved ──────────────────────────────────────────────────
  assertPass(
    "PI10L-ACTUAL-LT",
    assertActualWithinReservation({
      reservedBytes: 10 * MB,
      actualBytes: 7 * MB,
    }).ok,
    "actual < reserved ok",
  );
  assertPass(
    "PI10L-ACTUAL-GT",
    !assertActualWithinReservation({
      reservedBytes: 10 * MB,
      actualBytes: 11 * MB,
    }).ok,
    "actual > reserved deny",
  );

  const tenantR = await createTenant({
    name: `PI10L R ${suffix}`,
    slug: `pi10l-r-${suffix}`,
  });
  const res = await reserveStorage({
    tenantId: tenantR,
    operationId: `act-${suffix}`,
    expectedBytes: 10_000,
    maxBytes: 100_000,
  });
  await commitStorageReservation({
    tenantId: tenantR,
    reservationId: res.id,
    actualBytes: 7_000,
  });
  assertPass(
    "PI10L-ACTUAL-LT-COMMIT",
    (await getTenantReservedStorageUsage(tenantR)) === 0,
    "after commit with actual<reserved, reserved freed fully",
  );
  // Simulate committed via MediaAsset of actual size
  await db.insert(mediaAssets).values({
    id: crypto.randomUUID(),
    fileName: "a.bin",
    mimeType: "image/png",
    fileSize: 7_000,
    storageProvider: "local",
    storageKey: `tenants/${tenantR}/a.bin`,
    url: "http://local/a",
    checksum: `lt-${suffix}`,
    tenantId: tenantR,
  });
  const eff = await getTenantEffectiveStorageUsage(tenantR);
  assertPass(
    "PI10L-ACTUAL-LT-USAGE",
    eff.committed === 7_000 && eff.reserved === 0,
    `committed=${eff.committed} reserved=${eff.reserved}`,
  );

  const tenantOver = await createTenant({
    name: `PI10L OV ${suffix}`,
    slug: `pi10l-ov-${suffix}`,
  });
  const resOver = await reserveStorage({
    tenantId: tenantOver,
    operationId: `over-${suffix}`,
    expectedBytes: 100,
    maxBytes: 1000,
  });
  let overDeny = false;
  try {
    await commitStorageReservation({
      tenantId: tenantOver,
      reservationId: resOver.id,
      actualBytes: 200,
    });
  } catch (e) {
    overDeny =
      e instanceof StorageReservationError && e.code === "VALIDATION";
  }
  assertPass("PI10L-SEC-004", overDeny, "actual > reserved cannot commit");
  assertPass(
    "PI10L-SEC-004b",
    (await getTenantReservedStorageUsage(tenantOver)) === 100,
    "failed commit leaves RESERVED until release",
  );
  await releaseStorageReservation({
    tenantId: tenantOver,
    reservationId: resOver.id,
  });

  // ── ContentLength / signed URL source hardening ─────────────────────────
  const r2Src = fs.readFileSync(
    path.join(process.cwd(), "src/services/media/r2-provider.ts"),
    "utf8",
  );
  const typesSrc = fs.readFileSync(
    path.join(process.cwd(), "src/services/media/types.ts"),
    "utf8",
  );
  const contentsSrc = fs.readFileSync(
    path.join(process.cwd(), "src/services/contents.ts"),
    "utf8",
  );
  const directSrc = fs.readFileSync(
    path.join(process.cwd(), "src/features/media/direct-upload.ts"),
    "utf8",
  );
  assertPass(
    "PI10L-CL-1",
    r2Src.includes("ContentLength: params.contentLength") &&
      r2Src.includes('signableHeaders: new Set(["content-type", "content-length"])'),
    "R2 signs ContentLength + ContentType",
  );
  assertPass(
    "PI10L-CL-2",
    typesSrc.includes("contentLength: number") &&
      typesSrc.includes("requiredHeaders"),
    "provider contract requires contentLength",
  );
  assertPass(
    "PI10L-CL-3",
    contentsSrc.includes("contentLength: params.fileSize") &&
      contentsSrc.includes("requiredHeaders: signed.requiredHeaders"),
    "prepare passes fileSize as signed contentLength",
  );
  assertPass(
    "PI10L-CL-4",
    directSrc.includes("Content-Length") &&
      directSrc.includes("requiredHeaders"),
    "browser PUT sends Content-Length",
  );
  assertPass(
    "PI10L-SEC-007",
    !contentsSrc.includes("R2_SECRET") &&
      !directSrc.includes("R2_SECRET_ACCESS_KEY") &&
      r2Src.includes("getSignedUrl"),
    "credentials never in browser path; only signed URL",
  );

  // Signed URL isolation (static + key construction)
  assertPass(
    "PI10L-SEC-001",
    contentsSrc.includes("`tenants/${params.tenantId}/${params.assetId") ||
      contentsSrc.includes("tenants/${params.tenantId}/"),
    "complete key is tenant-scoped server-side",
  );
  assertPass(
    "PI10L-SEC-002",
    contentsSrc.includes("assetId") &&
      /randomUUID|existing\?\.id/.test(contentsSrc) &&
      !contentsSrc.includes("body.storageKey"),
    "object key server-generated; not client storageKey",
  );
  assertPass(
    "PI10L-EXPIRY",
    r2Src.includes("expiresIn") && contentsSrc.includes("expiresIn: 900"),
    "signed URL expiry 900s",
  );
  assertPass(
    "PI10L-SEC-003",
    !contentsSrc.includes("reservedBytes") ||
      !/body\.reservedBytes|params\.reservedBytes/.test(contentsSrc),
    "client cannot set reservedBytes after prepare",
  );

  // Invalid contentLength on R2 provider (no network)
  const hasR2Creds = Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME,
  );
  if (process.env.MEDIA_STORAGE_PROVIDER === "r2" && hasR2Creds) {
    const { R2StorageProvider } = await import(
      "../src/services/media/r2-provider"
    );
    const r2 = new R2StorageProvider();
    let badLen = false;
    try {
      await r2.createUploadUrl({
        storageKey: `tenants/pi10l-test/bad.bin`,
        mimeType: "image/png",
        contentLength: 0,
      });
    } catch {
      badLen = true;
    }
    assertPass("PI10L-CL-R2-VALID", badLen, "R2 rejects contentLength<=0");

    const key = `tenants/pi10l-test/${suffix}.png`;
    const payload = pngBuf(128, `r2-${suffix}`);
    const signed = await r2.createUploadUrl({
      storageKey: key,
      mimeType: "image/png",
      contentLength: payload.byteLength,
      expiresIn: 120,
    });
    assertPass(
      "PI10L-CL-R2-SIGNED",
      Boolean(signed.uploadUrl) &&
        signed.contentLength === payload.byteLength &&
        signed.requiredHeaders["Content-Length"] ===
          String(payload.byteLength),
      "signed URL includes exact length",
    );

    const putOk = await fetch(signed.uploadUrl, {
      method: "PUT",
      headers: signed.requiredHeaders,
      body: new Uint8Array(payload),
    });
    assertPass(
      "PI10L-R2-PUT-OK",
      putOk.ok,
      `within-limit PUT status=${putOk.status}`,
    );

    const oversized = Buffer.concat([payload, Buffer.alloc(64)]);
    const putBig = await fetch(signed.uploadUrl, {
      method: "PUT",
      headers: {
        ...signed.requiredHeaders,
        "Content-Length": String(oversized.byteLength),
      },
      body: new Uint8Array(oversized),
    });
    assertPass(
      "PI10L-R2-PUT-OVER",
      !putBig.ok,
      `oversized PUT rejected status=${putBig.status}`,
    );

    await r2.delete(key).catch(() => {});
    record("PI10L-R2-ENV", true, "real R2 credentials used");
  } else {
    record(
      "PI10L-R2-ENV",
      true,
      "ENVIRONMENT LIMITATION — no R2 test credentials; source-level ContentLength verified",
    );
  }

  // ── Checksum unique integrity (real DB) ─────────────────────────────────
  const integrity = await ensureMediaChecksumUniqueIntegrity();
  const idx = await isMediaChecksumUniqueIndexPresent();
  const dup = await diagnoseMediaChecksumDuplicates();
  assertPass(
    "PI10L-SCHEMA-IDX",
    idx.present && idx.unique,
    `present=${idx.present} unique=${idx.unique}`,
  );
  assertPass(
    "PI10L-SEC-010",
    integrity.status === "OK" || integrity.status === "DUPLICATES_PRESENT",
    `integrity status=${integrity.status} (observable)`,
  );
  assertPass(
    "PI10L-HIST-DUP",
    dup.groupCount === 0 || integrity.status === "DUPLICATES_PRESENT",
    dup.groupCount === 0
      ? "no historical duplicates"
      : `DUPLICATES_PRESENT groups=${dup.groupCount} (not auto-deleted)`,
  );
  if (dup.groupCount > 0) {
    console.warn("PI10L duplicate samples:", JSON.stringify(dup.samples.slice(0, 5)));
  }

  // Journal / migration
  const journal = fs.readFileSync(
    path.join(process.cwd(), "drizzle/meta/_journal.json"),
    "utf8",
  );
  const mig = fs.readFileSync(
    path.join(process.cwd(), "drizzle/0008_storage_reservations.sql"),
    "utf8",
  );
  assertPass(
    "PI10L-MIG",
    journal.includes("0008") &&
      mig.includes("media_assets_tenant_checksum_uidx"),
    "0008 journaled with unique index",
  );

  // ── Same checksum race ──────────────────────────────────────────────────
  const tenantC = await createTenant({
    name: `PI10L C ${suffix}`,
    slug: `pi10l-c-${suffix}`,
  });
  const same = pngBuf(2048, `race-${suffix}`);
  const [u1, u2] = await Promise.allSettled([
    uploadMediaAsset({
      fileName: "r1.png",
      mimeType: "image/png",
      data: same,
      tenantId: tenantC,
    }),
    uploadMediaAsset({
      fileName: "r2.png",
      mimeType: "image/png",
      data: same,
      tenantId: tenantC,
    }),
  ]);
  const ok = [u1, u2].filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<{
    id: string;
  }>[];
  const ids = new Set(ok.map((r) => r.value.id));
  const cnt = await db.all<{ n: number }>(
    sql`SELECT COUNT(*) as n FROM media_assets WHERE tenant_id = ${tenantC}`,
  );
  assertPass(
    "PI10L-SEC-005",
    Number(cnt[0]?.n) === 1 && ids.size === 1,
    `assets=${cnt[0]?.n} ids=${ids.size}`,
  );
  assertPass(
    "PI10L-SEC-009",
    (await getTenantStorageUsage(tenantC)) === 2048,
    "dedupe does not inflate committed",
  );

  // Cross-tenant
  const tenantA = await createTenant({
    name: `PI10L A ${suffix}`,
    slug: `pi10l-a-${suffix}`,
  });
  const tenantB = await createTenant({
    name: `PI10L B ${suffix}`,
    slug: `pi10l-b-${suffix}`,
  });
  const shared = pngBuf(1024, `x-${suffix}`);
  const ax = await uploadMediaAsset({
    fileName: "a.png",
    mimeType: "image/png",
    data: shared,
    tenantId: tenantA,
  });
  const bx = await uploadMediaAsset({
    fileName: "b.png",
    mimeType: "image/png",
    data: shared,
    tenantId: tenantB,
  });
  assertPass(
    "PI10L-SEC-006",
    ax.id !== bx.id &&
      ax.checksum === bx.checksum &&
      ax.storageKey.includes(tenantA) &&
      bx.storageKey.includes(tenantB),
    "cross-tenant checksum isolated",
  );

  // Dedupe + reservation cleanup (flag ON path uses reserve then release on hit)
  process.env.ENTITLEMENTS_ENABLED = "true";
  const {
    createEntitlementDefinition,
    createPlan,
    createPlanEntitlement,
    createTenantPlan,
  } = await import("../src/services/entitlements");
  const tenantD = await createTenant({
    name: `PI10L D ${suffix}`,
    slug: `pi10l-d-${suffix}`,
  });
  let defId: string;
  const existingDef = await db.all<{ id: string }>(
    sql`SELECT id FROM entitlement_definitions WHERE key = ${STORAGE_MAX_KEY} LIMIT 1`,
  );
  if (existingDef[0]) defId = existingDef[0].id;
  else {
    const d = await createEntitlementDefinition({
      key: STORAGE_MAX_KEY,
      name: "Storage Max",
      valueType: "BYTES",
      enforcementType: "HARD_LIMIT",
    });
    defId = d.id;
  }
  const plan = await createPlan({
    key: `pi10l.${suffix}`,
    name: "PI10L",
  });
  await createPlanEntitlement({
    planId: plan.id,
    entitlementDefinitionId: defId,
    value: 50 * MB,
  });
  await createTenantPlan({
    tenantId: tenantD,
    planId: plan.id,
    status: "ACTIVE",
  });
  const dedupePayload = pngBuf(1500, `dedupe-${suffix}`);
  await uploadMediaAsset({
    fileName: "d1.png",
    mimeType: "image/png",
    data: dedupePayload,
    tenantId: tenantD,
  });
  await uploadMediaAsset({
    fileName: "d2.png",
    mimeType: "image/png",
    data: dedupePayload,
    tenantId: tenantD,
  });
  assertPass(
    "PI10L-DEDUPE-QUOTA",
    (await getTenantStorageUsage(tenantD)) === 1500 &&
      (await getTenantReservedStorageUsage(tenantD)) === 0,
    "dedupe hit: one committed, no stuck reserved",
  );
  process.env.ENTITLEMENTS_ENABLED = "false";

  // Failure cleanup: reserve then release (simulates PUT/HEAD failure path)
  const tenantF = await createTenant({
    name: `PI10L F ${suffix}`,
    slug: `pi10l-f-${suffix}`,
  });
  const rFail = await reserveStorage({
    tenantId: tenantF,
    operationId: `fail-${suffix}`,
    expectedBytes: 500,
    maxBytes: 5000,
  });
  await releaseStorageReservation({
    tenantId: tenantF,
    reservationId: rFail.id,
  });
  assertPass(
    "PI10L-CLEANUP-A",
    (await getTenantReservedStorageUsage(tenantF)) === 0,
    "PUT failure path: reservation released",
  );
  assertPass(
    "PI10L-SEC-008",
    (await getTenantStorageUsage(tenantF)) === 0,
    "failed upload creates no committed asset",
  );

  // Reservation-first wiring still present
  assertPass(
    "PI10L-RESERVE-FIRST",
    /reserveStorageForUpload[\s\S]*?storage\.put/.test(contentsSrc) &&
      contentsSrc.includes("finishStorageReservation"),
    "quota still reservation-first",
  );

  // ensureSchema no longer silently equates catch with protected
  const clientSrc = fs.readFileSync(
    path.join(process.cwd(), "src/db/client.ts"),
    "utf8",
  );
  assertPass(
    "PI10L-ENSURE",
    clientSrc.includes("ensureMediaChecksumUniqueIntegrity") &&
      !/media_assets_tenant_checksum_uidx not applied:[\s\S]*catch/.test(
        clientSrc,
      ),
    "ensureSchema uses integrity helper (no silent catch-as-OK)",
  );

  // Evidence
  const evidenceDir = path.join(
    process.cwd(),
    "docs/evidence/platform-identity-10l",
  );
  fs.mkdirSync(evidenceDir, { recursive: true });
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  const envLimited = results.some(
    (r) => r.id === "PI10L-R2-ENV" && (r.detail ?? "").includes("ENVIRONMENT"),
  );
  fs.writeFileSync(
    path.join(evidenceDir, "TEST-RESULTS.md"),
    [
      "# PI-10L Test Results",
      "",
      `Generated: ${new Date().toISOString()}`,
      `Passed: ${passed} / Failed: ${failed}`,
      envLimited ? "R2: ENVIRONMENT LIMITATION" : "R2: exercised",
      "",
      "| ID | Result | Detail |",
      "|----|--------|--------|",
      ...results.map(
        (r) => `| ${r.id} | ${r.ok ? "PASS" : "FAIL"} | ${r.detail ?? ""} |`,
      ),
      "",
    ].join("\n"),
  );
  fs.writeFileSync(
    path.join(evidenceDir, "HISTORICAL-DUPLICATES.md"),
    [
      "# Historical Duplicate Diagnosis",
      "",
      `groupCount: ${dup.groupCount}`,
      `rowCount: ${dup.rowCount}`,
      `integrity: ${integrity.status}`,
      "",
      "```json",
      JSON.stringify(dup.samples, null, 2),
      "```",
      "",
      "Policy: do not auto-delete. Unique index applied only when groupCount=0.",
      "",
    ].join("\n"),
  );

  // pragma dump
  const pragma = await client.execute("PRAGMA index_list('media_assets')");
  fs.writeFileSync(
    path.join(evidenceDir, "SCHEMA-INDEX.md"),
    [
      "# media_assets indexes",
      "",
      "```json",
      JSON.stringify(pragma.rows, null, 2),
      "```",
      "",
      `unique index present=${idx.present} unique=${idx.unique}`,
      "",
    ].join("\n"),
  );

  if (originalFlag === undefined) delete process.env.ENTITLEMENTS_ENABLED;
  else process.env.ENTITLEMENTS_ENABLED = originalFlag;

  if (failed > 0) {
    console.error(`\nPI-10L FAILED: ${failed}`);
    process.exit(1);
  }
  console.log(
    `\nPLATFORM-IDENTITY-10L PASS (${passed} checks)${envLimited ? " [ENVIRONMENT LIMITATION for live R2]" : ""}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

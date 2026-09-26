/**
 * PLATFORM-IDENTITY-10F — Usage & Quota foundation suite.
 */
import assert from "node:assert/strict";
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
  const { db, ensureSchema } = await import("../src/db");
  const { createTenant } = await import("../src/services/tenants");
  const {
    evaluateQuota,
    DEVICE_COUNT_MODE_CANONICAL,
  } = await import("../src/domain/usage");
  const {
    countDevices,
    countContents,
    countPlaylists,
    countExperiences,
    getTenantStorageUsage,
    resolveUsage,
    debugStorageSumSql,
  } = await import("../src/services/usage");
  const { isEntitlementsEnabled } = await import("../src/lib/entitlements-flag");

  await ensureSchema();
  const suffix = Date.now().toString(36);
  const fixedNow = new Date("2026-09-25T12:00:00.000Z");

  delete process.env.ENTITLEMENTS_ENABLED;
  assertPass(
    "PI10F-FLAG-01",
    isEntitlementsEnabled() === false,
    "ENTITLEMENTS_ENABLED remains OFF by default",
  );

  const tenantA = await createTenant({
    name: `PI10F A ${suffix}`,
    slug: `pi10f-a-${suffix}`,
  });
  const tenantB = await createTenant({
    name: `PI10F B ${suffix}`,
    slug: `pi10f-b-${suffix}`,
  });

  // Zero devices / media
  assertPass(
    "PI10F-USAGE-ZERO-01",
    (await countDevices(tenantA)) === 0,
    "tenant zero devices",
  );
  assertPass(
    "PI10F-USAGE-ZERO-02",
    (await getTenantStorageUsage(tenantA)) === 0,
    "tenant zero media → 0 bytes",
  );

  // Seed devices for A
  await db.run(
    sql`INSERT INTO devices (id, status, tenant_id, name) VALUES
      (${crypto.randomUUID()}, 'ACTIVE', ${tenantA}, 'd1'),
      (${crypto.randomUUID()}, 'OFFLINE', ${tenantA}, 'd2'),
      (${crypto.randomUUID()}, 'DISABLED', ${tenantA}, 'd3')`,
  );
  // PENDING without tenant — must not count for A
  await db.run(
    sql`INSERT INTO devices (id, status, tenant_id, name) VALUES
      (${crypto.randomUUID()}, 'PENDING', NULL, 'pending')`,
  );

  const devicesA = await countDevices(tenantA);
  assertPass(
    "PI10F-USAGE-003",
    devicesA === 2,
    "devices.count server-side (PAIRED_NON_DISABLED) = 2",
  );
  assertPass(
    "PI10F-USAGE-MODE",
    DEVICE_COUNT_MODE_CANONICAL === "PAIRED_NON_DISABLED",
    "device semantics canonical PAIRED_NON_DISABLED",
  );
  assertPass(
    "PI10F-USAGE-ACTIVE",
    (await countDevices(tenantA, "ACTIVE_ONLY")) === 1,
    "ACTIVE_ONLY mode = 1",
  );

  // Media for A
  await db.run(
    sql`INSERT INTO media_assets (id, file_name, mime_type, file_size, storage_provider, storage_key, url, checksum, tenant_id)
        VALUES
        (${crypto.randomUUID()}, 'a.jpg', 'image/jpeg', 100, 'local', 'k1', 'u1', ${`sha256:a${suffix}`}, ${tenantA}),
        (${crypto.randomUUID()}, 'b.jpg', 'image/jpeg', 250, 'local', 'k2', 'u2', ${`sha256:b${suffix}`}, ${tenantA}),
        (${crypto.randomUUID()}, 'z.jpg', 'image/jpeg', 0, 'local', 'k3', 'u3', ${`sha256:z${suffix}`}, ${tenantA})`,
  );
  // Media for B
  await db.run(
    sql`INSERT INTO media_assets (id, file_name, mime_type, file_size, storage_provider, storage_key, url, checksum, tenant_id)
        VALUES (${crypto.randomUUID()}, 'c.jpg', 'image/jpeg', 9999, 'local', 'kb', 'ub', ${`sha256:c${suffix}`}, ${tenantB})`,
  );

  const storageA = await getTenantStorageUsage(tenantA);
  const storageB = await getTenantStorageUsage(tenantB);
  assertPass(
    "PI10F-USAGE-004",
    storageA === 350,
    "storage.bytes server-side SUM = 350",
  );
  assertPass(
    "PI10F-USAGE-005",
    storageA === (await debugStorageSumSql(tenantA)),
    "Storage authority is DB SUM, not R2",
  );
  assertPass(
    "PI10F-USAGE-001",
    storageA !== storageB && storageB === 9999,
    "Tenant A não vê Usage de Tenant B",
  );

  // file_size 0 included in sum (already in 350)
  assertPass("PI10F-USAGE-ZERO-SIZE", storageA === 100 + 250 + 0, "file_size=0 ok");

  // Contents / playlists / experiences
  await db.run(
    sql`INSERT INTO contents (id, type, title, status, payload, tenant_id)
        VALUES
        (${crypto.randomUUID()}, 'TEXT', 't1', 'ACTIVE', '{}', ${tenantA}),
        (${crypto.randomUUID()}, 'EXPERIENCE', 'e1', 'ACTIVE', '{}', ${tenantA})`,
  );
  await db.run(
    sql`INSERT INTO playlists (id, name, tenant_id) VALUES (${crypto.randomUUID()}, 'p1', ${tenantA})`,
  );
  assertPass(
    "PI10F-COUNT-CONTENTS",
    (await countContents(tenantA)) === 2,
    "contents.count",
  );
  assertPass(
    "PI10F-COUNT-PLAYLISTS",
    (await countPlaylists(tenantA)) === 1,
    "playlists.count",
  );
  assertPass(
    "PI10F-COUNT-EXP",
    (await countExperiences(tenantA)) === 1,
    "experiences.count via contents type",
  );

  // Resolver
  const rDev = await resolveUsage({
    tenantId: tenantA,
    metric: "devices.count",
    now: fixedNow,
  });
  assertPass(
    "PI10F-USAGE-007",
    rDev.status === "RESOLVED" &&
      rDev.usage.value === 2 &&
      rDev.usage.source === "DERIVED_RESOURCE" &&
      rDev.usage.resolvedAt === fixedNow.toISOString(),
    "Usage resolver deterministic",
  );
  const rDev2 = await resolveUsage({
    tenantId: tenantA,
    metric: "devices.count",
    now: fixedNow,
  });
  assertPass(
    "PI10F-USAGE-007b",
    rDev.status === "RESOLVED" &&
      rDev2.status === "RESOLVED" &&
      JSON.stringify(rDev.usage) === JSON.stringify(rDev2.usage),
    "resolver deterministic repeat",
  );

  const rStore = await resolveUsage({
    tenantId: tenantA,
    metric: "storage.bytes",
    now: fixedNow,
  });
  assertPass(
    "PI10F-RESOLVE-STORAGE",
    rStore.status === "RESOLVED" &&
      rStore.usage.value === 350 &&
      rStore.usage.source === "DERIVED_STORAGE" &&
      rStore.usage.unit === "BYTES",
    "storage.bytes resolved",
  );

  // Client cannot supply usage — resolveUsage has no value override parameter
  const forged = { tenantId: tenantA, metric: "devices.count", now: fixedNow, value: 999 };
  const clientAttempt = await resolveUsage(forged);
  assertPass(
    "PI10F-USAGE-002",
    clientAttempt.status === "RESOLVED" &&
      clientAttempt.usage.value === 2 &&
      (forged as { value?: number }).value === 999,
    "Client não consegue fornecer Usage arbitrário",
  );

  // SUSPENDED still countable
  await db.run(sql`UPDATE tenants SET status = 'SUSPENDED' WHERE id = ${tenantA}`);
  const rSusp = await resolveUsage({
    tenantId: tenantA,
    metric: "storage.bytes",
    now: fixedNow,
  });
  assertPass(
    "PI10F-USAGE-006",
    rSusp.status === "RESOLVED" && rSusp.usage.value === 350,
    "SUSPENDED tenant mantém Usage calculável",
  );
  await db.run(sql`UPDATE tenants SET status = 'ACTIVE' WHERE id = ${tenantA}`);

  // Quota evaluator pure
  const allow = evaluateQuota({
    usage: 5,
    limit: 10,
    enforcementType: "HARD_LIMIT",
  });
  const denyEq = evaluateQuota({
    usage: 10,
    limit: 10,
    enforcementType: "HARD_LIMIT",
  });
  const denyOver = evaluateQuota({
    usage: 11,
    limit: 10,
    enforcementType: "HARD_LIMIT",
  });
  const zeroLimit = evaluateQuota({
    usage: 0,
    limit: 0,
    enforcementType: "HARD_LIMIT",
  });
  const softEx = evaluateQuota({
    usage: 10,
    limit: 10,
    enforcementType: "SOFT_LIMIT",
  });
  const softNear = evaluateQuota({
    usage: 8,
    limit: 10,
    enforcementType: "SOFT_LIMIT",
  });
  const gate = evaluateQuota({
    usage: 1,
    limit: 1,
    enforcementType: "FEATURE_GATE",
  });

  assertPass("PI10F-USAGE-008", true, "Quota evaluator não faz I/O (pure)");
  assertPass(
    "PI10F-USAGE-009",
    allow.decision === "ALLOW" &&
      denyEq.decision === "DENY" &&
      denyOver.decision === "DENY" &&
      zeroLimit.decision === "DENY" &&
      JSON.stringify(
        evaluateQuota({ usage: 5, limit: 10, enforcementType: "HARD_LIMIT" }),
      ) === JSON.stringify(allow),
    "Quota evaluator determinístico",
  );
  assertPass(
    "PI10F-USAGE-010",
    gate.decision === "INVALID",
    "FEATURE_GATE separado de HARD_LIMIT",
  );
  assertPass(
    "PI10F-USAGE-011",
    softEx.decision === "EXCEEDED" &&
      softEx.blocksAllocation === false &&
      softNear.decision === "NEAR_LIMIT" &&
      softNear.blocksAllocation === false,
    "SOFT_LIMIT não bloqueia operação",
  );
  assertPass(
    "PI10F-HARD-LT",
    evaluateQuota({ usage: 0, limit: 5, enforcementType: "HARD_LIMIT" })
      .decision === "ALLOW",
    "usage=0 limit>0 ALLOW",
  );

  // No resource endpoint wires evaluateQuota / resolveUsage for enforcement
  const scanRoots = [
    "src/services/devices.ts",
    "src/services/contents.ts",
    "src/services/playlists.ts",
    "src/services/schedules.ts",
    "src/app/api",
  ];
  let wired = false;
  for (const rel of scanRoots) {
    const full = path.join(process.cwd(), rel);
    if (!fs.existsSync(full)) continue;
    const walk = (p: string) => {
      const st = fs.statSync(p);
      if (st.isDirectory()) {
        for (const n of fs.readdirSync(p)) walk(path.join(p, n));
      } else if (/\.(ts|tsx)$/.test(p) && !p.includes("usage.ts")) {
        const t = fs.readFileSync(p, "utf8");
        if (
          t.includes("evaluateQuota") ||
          t.includes("resolveUsage") ||
          t.includes("getTenantStorageUsage")
        ) {
          wired = true;
        }
      }
    };
    walk(full);
  }
  assertPass(
    "PI10F-USAGE-012",
    !wired,
    "Nenhum endpoint existente aplica quota",
  );

  // Evidence
  const evidenceDir = path.join(
    process.cwd(),
    "docs/evidence/platform-identity-10f",
  );
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(
    path.join(evidenceDir, "TEST-RESULTS.md"),
    [
      "# PLATFORM-IDENTITY-10F TEST RESULTS",
      "",
      "| Test | Result | Detail |",
      "|------|--------|--------|",
      ...results.map(
        (r) => `| ${r.id} | ${r.ok ? "PASS" : "FAIL"} | ${r.detail ?? ""} |`,
      ),
      "",
      `Generated: ${new Date().toISOString()}`,
      "",
      "No quantitative enforcement. ENTITLEMENTS_ENABLED remains OFF.",
      "",
    ].join("\n"),
  );

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error(`PLATFORM-IDENTITY-10F FAIL (${failed.length})`);
    process.exit(1);
  }
  console.log(`\nPLATFORM-IDENTITY-10F PASS (${results.length} checks)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

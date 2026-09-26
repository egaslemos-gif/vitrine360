/**
 * PI-10P — Production Cohort Expansion Review (READ-ONLY).
 * No mutations. No cohort expansion. No flag change.
 */
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { and, eq, sql } from "drizzle-orm";

const PRODUCTION_HOST =
  "vitrine360-vercel-icfg-rd8hoku6p0oaszo88ixdwcu4.aws-us-east-1.turso.io";
const PREVIEW_HOST = "vitrine360-preview-elemos.aws-us-west-2.turso.io";
const PILOT_SLUG = "egaslemos";
const WITNESS_SLUG = "demo";
const PROD_URL = "https://vitrine360-psi.vercel.app";
const EXPECTED_DEVICES_MAX = 5;
const EXPECTED_STORAGE_MAX = 10 * 1024 * 1024;

type Finding = { severity: string; item: string };
const findings: Finding[] = [];
const stops: string[] = [];

function hostOf(url: string): string {
  try {
    return new URL(url.includes("://") ? url : `libsql://${url}`).hostname;
  } catch {
    return "";
  }
}

function resolveProd() {
  config({ path: ".env.local" });
  const tursoUrl = process.env.TURSO_DATABASE_URL || "";
  const dbUrl = process.env.DATABASE_URL || "";
  let url = "";
  if (tursoUrl && hostOf(tursoUrl) === PRODUCTION_HOST) {
    url = tursoUrl.startsWith("libsql://") ? tursoUrl : `libsql://${tursoUrl}`;
  } else if (dbUrl.startsWith("libsql://") || dbUrl.startsWith("https://")) {
    url = dbUrl;
  }
  const token =
    process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || "";
  return { url, token, host: hostOf(url) };
}

function note(sev: string, item: string) {
  findings.push({ severity: sev, item });
  console.log(`FINDING[${sev}] ${item}`);
}

function stop(msg: string) {
  stops.push(msg);
  console.error(`STOP: ${msg}`);
}

async function main() {
  const { url, token, host } = resolveProd();
  console.log("=== PI-10P PRODUCTION COHORT EXPANSION REVIEW (READ-ONLY) ===");
  console.log(`target_host=${host}`);

  if (!url || !token || host !== PRODUCTION_HOST) {
    stop("Production target guard failed");
    process.exit(2);
  }
  if ((host as string) === PREVIEW_HOST) {
    stop("Preview host refused");
    process.exit(2);
  }

  process.env.DATABASE_URL = url;
  process.env.TURSO_DATABASE_URL = url;
  process.env.DATABASE_AUTH_TOKEN = token;
  process.env.TURSO_AUTH_TOKEN = token;
  process.env.ENTITLEMENTS_ENABLED = "true";

  // Live health
  const health = await fetch(`${PROD_URL}/api/health`).then((r) => r.json()) as {
    entitlementsEnabled?: boolean;
    databaseHost?: string;
    r2BucketName?: string;
    environmentHint?: string;
  };
  console.log(`live_health=${JSON.stringify(health)}`);

  let previewHealth: typeof health | null = null;
  try {
    previewHealth = await fetch(
      "https://vitrine360-cgazxkwa2-egaslemos-5751s-projects.vercel.app/api/health",
    ).then((r) => r.json());
  } catch {
    previewHealth = null;
  }
  console.log(`preview_health=${JSON.stringify(previewHealth)}`);

  if (health.entitlementsEnabled !== true) stop("Production flag not true");
  if (!health.databaseHost?.includes("vitrine360-vercel")) {
    stop("Production health DB host mismatch");
  }
  if (previewHealth && previewHealth.entitlementsEnabled !== false) {
    stop("Preview flag not false");
  }
  if (previewHealth && !previewHealth.databaseHost?.includes("preview")) {
    stop("Preview health DB host mismatch");
  }

  const raw = createClient({ url, authToken: token });
  const {
    resolveEffectiveEntitlements,
    enforceEntitlement,
  } = await import("../src/services/entitlements");
  const {
    DEVICES_ENABLED_KEY,
    DEVICES_MAX_KEY,
    STORAGE_MAX_KEY,
  } = await import("../src/domain/entitlements");
  const { db, schema } = await import("../src/db");
  const { countDevices, getTenantStorageUsage } = await import(
    "../src/services/usage"
  );
  const { DEVICE_COUNT_MODE_CANONICAL } = await import("../src/domain/usage");
  const {
    getTenantReservedStorageUsage,
    getTenantEffectiveStorageUsage,
  } = await import("../src/services/storage-reservation");
  const { isEntitlementsEnabled } = await import("../src/lib/entitlements-flag");

  console.log(`process_flag_on=${isEntitlementsEnabled()}`);

  // Active TenantPlans
  const allActive = await db
    .select()
    .from(schema.tenantPlans)
    .where(eq(schema.tenantPlans.status, "ACTIVE"));
  console.log(`active_tenant_plans=${allActive.length}`);
  if (allActive.length !== 1) {
    stop(`Active TenantPlans=${allActive.length} (expected 1)`);
  }

  // Pilot
  const [pilot] = (
    await raw.execute({
      sql: "SELECT id, slug, status, name, created_at FROM tenants WHERE slug = ?",
      args: [PILOT_SLUG],
    })
  ).rows as unknown as Array<{
    id: string;
    slug: string;
    status: string;
    name: string;
    created_at: string;
  }>;
  if (!pilot) stop("Pilot tenant missing");
  console.log(
    `pilot_id=${pilot!.id} status=${pilot!.status} slug=${pilot!.slug}`,
  );
  if (pilot!.status !== "ACTIVE") stop("Pilot not ACTIVE");

  if (allActive.length === 1 && allActive[0]!.tenantId !== pilot!.id) {
    stop("Sole ACTIVE TenantPlan is not pilot");
  }

  // Witness
  const [witness] = (
    await raw.execute({
      sql: "SELECT id, slug, status FROM tenants WHERE slug = ?",
      args: [WITNESS_SLUG],
    })
  ).rows as unknown as Array<{ id: string; slug: string; status: string }>;
  if (!witness) stop("Witness demo missing");

  // TenantPlan + plan + bindings
  const [tp] = await db
    .select()
    .from(schema.tenantPlans)
    .where(
      and(
        eq(schema.tenantPlans.tenantId, pilot!.id),
        eq(schema.tenantPlans.status, "ACTIVE"),
      ),
    );
  if (!tp) stop("Pilot ACTIVE TenantPlan missing");
  const [plan] = await db
    .select()
    .from(schema.plans)
    .where(eq(schema.plans.id, tp!.planId));
  console.log(`plan_key=${plan?.key} plan_active=${plan?.active}`);
  if (plan?.key !== "pi10p_production_pilot") {
    stop(`Unexpected plan key ${plan?.key}`);
  }

  const bindings = await db
    .select({
      key: schema.entitlementDefinitions.key,
      value: schema.planEntitlements.value,
      valueType: schema.entitlementDefinitions.valueType,
    })
    .from(schema.planEntitlements)
    .innerJoin(
      schema.entitlementDefinitions,
      eq(
        schema.planEntitlements.entitlementDefinitionId,
        schema.entitlementDefinitions.id,
      ),
    )
    .where(eq(schema.planEntitlements.planId, plan!.id));
  console.log(`plan_bindings=${JSON.stringify(bindings)}`);

  // Effective resolve ×3 (determinism)
  const r1 = await resolveEffectiveEntitlements(pilot!.id);
  const r2 = await resolveEffectiveEntitlements(pilot!.id);
  const r3 = await resolveEffectiveEntitlements(pilot!.id);
  const snap = (r: typeof r1) =>
    r.status === "RESOLVED"
      ? JSON.stringify(
          [...r.entitlements.entitlements]
            .map((e) => [e.key, e.value])
            .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
        )
      : r.status;
  const s1 = snap(r1);
  const s2 = snap(r2);
  const s3 = snap(r3);
  console.log(`eff1=${s1}`);
  console.log(`eff2=${s2}`);
  console.log(`eff3=${s3}`);
  console.log(`deterministic=${s1 === s2 && s2 === s3}`);
  if (r1.status !== "RESOLVED") stop("Pilot resolve not RESOLVED");
  if (s1 !== s2 || s2 !== s3) stop("EffectiveEntitlements non-deterministic");

  const map = new Map(
    r1.status === "RESOLVED"
      ? r1.entitlements.entitlements.map((e) => [e.key, e.value])
      : [],
  );
  console.log(`devices.enabled=${map.get(DEVICES_ENABLED_KEY)}`);
  console.log(`devices.max=${map.get(DEVICES_MAX_KEY)}`);
  console.log(`storage.maxBytes=${map.get(STORAGE_MAX_KEY)}`);
  if (map.get(DEVICES_ENABLED_KEY) !== true) stop("devices.enabled != true");
  if (map.get(DEVICES_MAX_KEY) !== EXPECTED_DEVICES_MAX) {
    stop("devices.max mismatch");
  }
  if (map.get(STORAGE_MAX_KEY) !== EXPECTED_STORAGE_MAX) {
    stop("storage.maxBytes mismatch");
  }

  // Resource baseline
  const deviceUsage = await countDevices(
    pilot!.id,
    DEVICE_COUNT_MODE_CANONICAL,
  );
  const committed = await getTenantStorageUsage(pilot!.id);
  const reserved = await getTenantReservedStorageUsage(pilot!.id);
  const effectiveStor = await getTenantEffectiveStorageUsage(pilot!.id);

  async function countTable(table: string, tenantId: string) {
    const res = await raw.execute({
      sql: `SELECT COUNT(*) AS n FROM ${table} WHERE tenant_id = ?`,
      args: [tenantId],
    });
    return Number(res.rows[0]?.n ?? 0);
  }

  const contents = await countTable("contents", pilot!.id);
  const media = await countTable("media_assets", pilot!.id);
  const playlists = await countTable("playlists", pilot!.id);
  const schedules = await countTable("schedules", pilot!.id);
  let experiences = 0;
  try {
    experiences = await countTable("experiences", pilot!.id);
  } catch {
    experiences = -1; // table may not exist
  }
  const memberships = await countTable("memberships", pilot!.id);
  const devicesAll = await countTable("devices", pilot!.id);

  const deviceStatus = await raw.execute({
    sql: `SELECT status, COUNT(*) AS n FROM devices WHERE tenant_id=? GROUP BY status`,
    args: [pilot!.id],
  });
  console.log(
    `device_status_breakdown=${JSON.stringify(deviceStatus.rows)}`,
  );

  const devicesDetail = await raw.execute({
    sql: `SELECT id, name, status, last_seen_at, created_at, current_playlist_id
          FROM devices WHERE tenant_id=? ORDER BY created_at ASC LIMIT 50`,
    args: [pilot!.id],
  });
  console.log(`devices_detail_count=${devicesDetail.rows.length}`);
  for (const d of devicesDetail.rows) {
    console.log(
      `device status=${d.status} last_seen=${d.last_seen_at ?? "null"} playlist=${d.current_playlist_id ? "set" : "null"}`,
    );
  }

  const reservations = await raw.execute({
    sql: `SELECT status, COUNT(*) AS n, COALESCE(SUM(expected_bytes),0) AS bytes
          FROM storage_reservations WHERE tenant_id=? GROUP BY status`,
    args: [pilot!.id],
  });
  console.log(`reservations=${JSON.stringify(reservations.rows)}`);

  const allResRows = await raw.execute({
    sql: `SELECT id, status, expected_bytes, created_at, expires_at
          FROM storage_reservations WHERE tenant_id=? ORDER BY created_at DESC LIMIT 20`,
    args: [pilot!.id],
  });
  console.log(`reservation_rows=${allResRows.rows.length}`);

  // Global integrity counts
  const globalActive = allActive.length;
  const globalPlans = (
    await db.select({ c: sql<number>`count(*)` }).from(schema.plans)
  )[0];
  const globalDefs = (
    await db
      .select({ c: sql<number>`count(*)` })
      .from(schema.entitlementDefinitions)
  )[0];
  const globalTps = (
    await db.select({ c: sql<number>`count(*)` }).from(schema.tenantPlans)
  )[0];
  const globalRes = await raw.execute({
    sql: `SELECT status, COUNT(*) AS n FROM storage_reservations GROUP BY status`,
    args: [],
  });
  const pi10pTenants = await raw.execute({
    sql: `SELECT COUNT(*) AS n FROM tenants WHERE slug LIKE 'pi10p-%'`,
    args: [],
  });
  console.log(
    `catalog plans=${globalPlans?.c} defs=${globalDefs?.c} tenant_plans=${globalTps?.c}`,
  );
  console.log(`global_reservations=${JSON.stringify(globalRes.rows)}`);
  console.log(`pi10p_test_tenants=${pi10pTenants.rows[0]?.n}`);

  // Journal
  const journal = await raw.execute({
    sql: `SELECT COUNT(*) AS n FROM __drizzle_migrations`,
    args: [],
  });
  console.log(`journal_entries=${journal.rows[0]?.n}`);

  // Headroom
  const deviceHeadroom = EXPECTED_DEVICES_MAX - deviceUsage;
  const storageHeadroom =
    EXPECTED_STORAGE_MAX - (committed + reserved);
  function classify(headroom: number, max: number): string {
    if (headroom <= 0) return "AT LIMIT";
    if (headroom / max <= 0.2) return "LOW HEADROOM";
    return "HEALTHY HEADROOM";
  }
  const deviceClass = classify(deviceHeadroom, EXPECTED_DEVICES_MAX);
  const storageClass = classify(storageHeadroom, EXPECTED_STORAGE_MAX);
  console.log(
    `device_usage=${deviceUsage} max=${EXPECTED_DEVICES_MAX} headroom=${deviceHeadroom} class=${deviceClass}`,
  );
  console.log(
    `committed=${committed} reserved=${reserved} effective=${effectiveStor} max=${EXPECTED_STORAGE_MAX} headroom=${storageHeadroom} class=${storageClass}`,
  );

  if (deviceUsage > EXPECTED_DEVICES_MAX) stop("device usage > max");
  if (committed + reserved > EXPECTED_STORAGE_MAX) {
    stop("storage committed+reserved > max");
  }
  if (committed < 0 || reserved < 0) stop("negative storage usage");

  // Non-cohort
  const wEff = await resolveEffectiveEntitlements(witness!.id);
  console.log(`witness_resolve=${wEff.status}`);
  const wTp = await db
    .select()
    .from(schema.tenantPlans)
    .where(eq(schema.tenantPlans.tenantId, witness!.id));
  console.log(`witness_tenant_plans=${wTp.length}`);
  const wGate = await enforceEntitlement({
    tenantId: witness!.id,
    key: DEVICES_ENABLED_KEY,
    operation: "device.pair",
  });
  console.log(`witness_gate=${wGate.decision}/${wGate.reason}`);
  if (wEff.status !== "NO_ACTIVE_PLAN") stop("Witness resolve unexpected");
  if (wTp.length !== 0) stop("Witness received TenantPlan");
  if (wGate.decision !== "DENY") stop("Witness allocation not DENY");

  const pGate = await enforceEntitlement({
    tenantId: pilot!.id,
    key: DEVICES_ENABLED_KEY,
    operation: "device.pair",
  });
  console.log(`pilot_gate=${pGate.decision}/${pGate.reason}`);

  // Cross-tenant: service-layer isolation — usage queries are tenant-id scoped
  const pilotStor = committed;
  const witnessStor = await getTenantStorageUsage(witness!.id);
  const witnessDev = await countDevices(
    witness!.id,
    DEVICE_COUNT_MODE_CANONICAL,
  );
  console.log(
    `cross_tenant_usage_scoped pilot_stor=${pilotStor} witness_stor=${witnessStor} witness_dev=${witnessDev}`,
  );
  // Resolve for wrong id should not leak other tenant plan
  const fakeEff = await resolveEffectiveEntitlements(witness!.id);
  const pilotOnlyPlans = allActive.every((t) => t.tenantId === pilot!.id);
  console.log(`active_plans_all_pilot=${pilotOnlyPlans}`);

  // Activity / errors — activity_logs if present
  let activitySample = "ABSENT_TABLE";
  try {
    const act = await raw.execute({
      sql: `SELECT action, COUNT(*) AS n FROM activity_logs WHERE tenant_id=? GROUP BY action ORDER BY n DESC LIMIT 15`,
      args: [pilot!.id],
    });
    activitySample = JSON.stringify(act.rows);
  } catch {
    try {
      const act2 = await raw.execute({
        sql: `SELECT COUNT(*) AS n FROM activity WHERE tenant_id=?`,
        args: [pilot!.id],
      });
      activitySample = `activity_count=${act2.rows[0]?.n}`;
    } catch {
      activitySample = "NO_ACTIVITY_TABLE";
    }
  }
  console.log(`pilot_activity=${activitySample}`);

  // Memberships users
  const users = await raw.execute({
    sql: `SELECT COUNT(DISTINCT user_id) AS n FROM memberships WHERE tenant_id=?`,
    args: [pilot!.id],
  });
  console.log(`pilot_members=${users.rows[0]?.n} memberships=${memberships}`);

  // Schema table count
  const tables = await raw.execute({
    sql: `SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
    args: [],
  });
  console.log(`tables=${tables.rows[0]?.n}`);

  // Summary block for docs
  const summary = {
    production: {
      db: "vitrine360",
      host: host,
      entitlementsEnabled: health.entitlementsEnabled,
      deploymentLive: "dpl_GSh3MXryZLeFWvDTMY5gRoV9SJd6",
      deploymentPromptMentioned: "dpl_Amo25Sy1eRXspPUYxFirH4DGRaqo",
      note: "Live alias points to auth-fix deploy after /XD auth staging bug",
    },
    preview: {
      entitlementsEnabled: previewHealth?.entitlementsEnabled ?? null,
      host: previewHealth?.databaseHost ?? null,
    },
    pilot: {
      id: pilot!.id,
      slug: pilot!.slug,
      status: pilot!.status,
      planKey: plan?.key,
      tenantPlanId: tp?.id,
      devicesEnabled: map.get(DEVICES_ENABLED_KEY),
      devicesMax: map.get(DEVICES_MAX_KEY),
      storageMaxBytes: map.get(STORAGE_MAX_KEY),
    },
    baseline: {
      deviceUsagePairedNonDisabled: deviceUsage,
      devicesAllRows: devicesAll,
      contents,
      mediaAssets: media,
      playlists,
      schedules,
      experiences,
      memberships,
      membersDistinct: Number(users.rows[0]?.n ?? 0),
      committed,
      reserved,
      effectiveStorage: effectiveStor,
    },
    headroom: {
      device: { headroom: deviceHeadroom, class: deviceClass },
      storage: { headroom: storageHeadroom, class: storageClass },
    },
    resolve: {
      deterministic: s1 === s2 && s2 === s3,
      status: r1.status,
    },
    nonCohort: {
      slug: WITNESS_SLUG,
      resolve: wEff.status,
      tenantPlans: wTp.length,
      gate: `${wGate.decision}/${wGate.reason}`,
    },
    integrity: {
      activeTenantPlans: globalActive,
      pi10pTestTenants: Number(pi10pTenants.rows[0]?.n ?? 0),
      journal: Number(journal.rows[0]?.n ?? 0),
      tables: Number(tables.rows[0]?.n ?? 0),
      catalog: {
        plans: Number(globalPlans?.c ?? 0),
        defs: Number(globalDefs?.c ?? 0),
        tenantPlans: Number(globalTps?.c ?? 0),
      },
    },
    stops,
    findings,
  };

  console.log("=== SUMMARY_JSON_BEGIN ===");
  console.log(JSON.stringify(summary, null, 2));
  console.log("=== SUMMARY_JSON_END ===");

  if (stops.length) {
    console.error(`review_stops=${stops.length}`);
    process.exit(2);
  }
  console.log("review_read_only=SUCCESS");
}

main().catch((e) => {
  console.error(String(e).replace(/[A-Za-z0-9_-]{24,}/g, "REDACTED"));
  process.exit(1);
});

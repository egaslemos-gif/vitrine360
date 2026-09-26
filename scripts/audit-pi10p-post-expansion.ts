/**
 * PI-10P — Production Post-Expansion Audit (READ-ONLY).
 * No mutations. No flag change. No secrets printed.
 */
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";

const PRODUCTION_HOST =
  "vitrine360-vercel-icfg-rd8hoku6p0oaszo88ixdwcu4.aws-us-east-1.turso.io";
const PREVIEW_HOST = "vitrine360-preview-elemos.aws-us-west-2.turso.io";
const PROD_URL = "https://vitrine360-psi.vercel.app";
const PILOT = "egaslemos";
const DEMO = "demo";
const WITNESS = "acc-mubsv40q";
const PILOT_PLAN = "pi10p_production_pilot";
const DEMO_PLAN = "pi10p_production_cohort_demo";
const EXPECTED_JOURNAL = 9;
const PILOT_DEVICES_MAX = 5;
const PILOT_STORAGE_MAX = 10 * 1024 * 1024;
const DEMO_DEVICES_MAX = 10;
const DEMO_STORAGE_MAX = 100 * 1024 * 1024;

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

function resolveProdUrl() {
  config({ path: ".env.local" });
  const dbUrl = process.env.DATABASE_URL || "";
  const tursoUrl = process.env.TURSO_DATABASE_URL || "";
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
  console.log(`FINDING ${sev}: ${item}`);
}

function must(cond: boolean, msg: string) {
  if (!cond) {
    stops.push(msg);
    console.error(`STOP: ${msg}`);
  }
}

async function main() {
  const { url, token, host } = resolveProdUrl();
  console.log("PI-10P Production Post-Expansion Audit (READ-ONLY)");
  console.log(`target_host=${host}`);
  must(Boolean(url && token && host === PRODUCTION_HOST), "Production guard failed");
  must((host as string) !== PREVIEW_HOST, "Preview host refused");
  if (stops.length) process.exit(2);
  console.log("target_guard=PASS");

  process.env.DATABASE_URL = url;
  process.env.TURSO_DATABASE_URL = url;
  process.env.DATABASE_AUTH_TOKEN = token;
  process.env.TURSO_AUTH_TOKEN = token;
  process.env.ENTITLEMENTS_ENABLED = "true";

  // Live health
  const healthRes = await fetch(`${PROD_URL}/api/health`);
  must(healthRes.ok, `health HTTP ${healthRes.status}`);
  const health = (await healthRes.json()) as Record<string, unknown>;
  console.log(`health=${JSON.stringify(health)}`);
  must(health.entitlementsEnabled === true, "entitlementsEnabled not true");
  must(
    String(health.databaseHost || "").includes("vitrine360-vercel"),
    "health DB not Production",
  );
  must(health.r2BucketName === "vitrine360", "R2 bucket not vitrine360");

  const raw = createClient({ url, authToken: token });

  // Schema / journal
  const journal = await raw.execute(
    "SELECT COUNT(*) AS n FROM __drizzle_migrations",
  );
  const journalN = Number(journal.rows[0]?.n ?? -1);
  console.log(`journal_entries=${journalN}`);
  must(journalN === EXPECTED_JOURNAL, `journal expected ${EXPECTED_JOURNAL} got ${journalN}`);

  const tables = await raw.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
  );
  const tableNames = tables.rows.map((r) => String(r.name));
  const required = [
    "entitlement_definitions",
    "plans",
    "plan_entitlements",
    "tenant_plans",
    "storage_reservations",
    "media_assets",
    "devices",
    "tenants",
  ];
  for (const t of required) {
    must(tableNames.includes(t), `missing table ${t}`);
  }
  console.log(`tables_count=${tableNames.length}`);

  const idx = await raw.execute(
    "SELECT name, sql FROM sqlite_master WHERE type='index' AND (name LIKE '%checksum%' OR sql LIKE '%checksum%')",
  );
  console.log(`checksum_indexes=${JSON.stringify(idx.rows)}`);
  must(idx.rows.length >= 1, "checksum unique index absent");

  // TenantPlans
  const activeTp = await raw.execute(`
    SELECT tp.id, tp.tenant_id, tp.plan_id, tp.status, t.slug, p.key AS plan_key
    FROM tenant_plans tp
    JOIN tenants t ON t.id = tp.tenant_id
    JOIN plans p ON p.id = tp.plan_id
    WHERE tp.status = 'ACTIVE'
    ORDER BY t.slug
  `);
  console.log(`active_tenant_plans=${JSON.stringify(activeTp.rows)}`);
  must(activeTp.rows.length === 2, `ACTIVE TenantPlans expected 2 got ${activeTp.rows.length}`);
  const bySlug = Object.fromEntries(
    activeTp.rows.map((r) => [String(r.slug), r]),
  );
  must(Boolean(bySlug[PILOT]), "pilot missing from ACTIVE TenantPlans");
  must(Boolean(bySlug[DEMO]), "demo missing from ACTIVE TenantPlans");
  must(bySlug[PILOT]?.plan_key === PILOT_PLAN, "pilot plan key mismatch");
  must(bySlug[DEMO]?.plan_key === DEMO_PLAN, "demo plan key mismatch");
  must(!bySlug[WITNESS], "witness must not have ACTIVE TenantPlan");

  const allTp = await raw.execute(`
    SELECT tp.status, t.slug, p.key AS plan_key, COUNT(*) AS n
    FROM tenant_plans tp
    JOIN tenants t ON t.id=tp.tenant_id
    JOIN plans p ON p.id=tp.plan_id
    GROUP BY tp.status, t.slug, p.key
  `);
  console.log(`all_tenant_plans_grouped=${JSON.stringify(allTp.rows)}`);

  const plans = await raw.execute(
    "SELECT key, active FROM plans WHERE key LIKE 'pi10p%' ORDER BY key",
  );
  console.log(`pi10p_plans=${JSON.stringify(plans.rows)}`);
  must(plans.rows.length === 2, `unexpected pi10p plan count ${plans.rows.length}`);

  // Resolve tenants
  async function tenantBySlug(slug: string) {
    const r = await raw.execute({
      sql: "SELECT id, slug, status FROM tenants WHERE slug=?",
      args: [slug],
    });
    return r.rows[0] as unknown as
      | { id: string; slug: string; status: string }
      | undefined;
  }
  const pilotT = await tenantBySlug(PILOT);
  const demoT = await tenantBySlug(DEMO);
  const witnessT = await tenantBySlug(WITNESS);
  must(Boolean(pilotT && demoT && witnessT), "required tenants missing");
  if (!pilotT || !demoT || !witnessT) process.exit(1);

  // Effective entitlements ×3
  const {
    resolveEffectiveEntitlements,
  } = await import("../src/services/entitlements");
  const {
    DEVICES_ENABLED_KEY,
    DEVICES_MAX_KEY,
    STORAGE_MAX_KEY,
  } = await import("../src/domain/entitlements");
  const { assertDevicesMaxAllocation } = await import(
    "../src/services/device-quota"
  );

  async function resolveX3(label: string, tenantId: string) {
    const results = [];
    for (let i = 0; i < 3; i++) {
      results.push(await resolveEffectiveEntitlements(tenantId));
    }
    const statuses = results.map((r) => r.status);
    const same = statuses.every((s) => s === statuses[0]);
    console.log(`eff_${label}_x3=${statuses.join(",")}`);
    must(same, `${label} entitlement resolution not deterministic`);
    return results[0]!;
  }

  const effPilot = await resolveX3("egaslemos", pilotT.id);
  const effDemo = await resolveX3("demo", demoT.id);
  const effWitness = await resolveX3("acc-mubsv40q", witnessT.id);

  must(effPilot.status === "RESOLVED", "egaslemos not RESOLVED");
  must(effDemo.status === "RESOLVED", "demo not RESOLVED");
  must(effWitness.status === "NO_ACTIVE_PLAN", "witness not NO_ACTIVE_PLAN");

  function mapOf(eff: typeof effPilot) {
    if (eff.status !== "RESOLVED") return new Map<string, unknown>();
    return new Map(eff.entitlements.entitlements.map((e) => [e.key, e.value]));
  }
  const mP = mapOf(effPilot);
  const mD = mapOf(effDemo);
  console.log(`pilot_values enabled=${mP.get(DEVICES_ENABLED_KEY)} max=${mP.get(DEVICES_MAX_KEY)} stor=${mP.get(STORAGE_MAX_KEY)}`);
  console.log(`demo_values enabled=${mD.get(DEVICES_ENABLED_KEY)} max=${mD.get(DEVICES_MAX_KEY)} stor=${mD.get(STORAGE_MAX_KEY)}`);
  must(mP.get(DEVICES_ENABLED_KEY) === true, "pilot devices.enabled");
  must(mP.get(DEVICES_MAX_KEY) === PILOT_DEVICES_MAX, "pilot devices.max");
  must(mP.get(STORAGE_MAX_KEY) === PILOT_STORAGE_MAX, "pilot storage.maxBytes");
  must(mD.get(DEVICES_ENABLED_KEY) === true, "demo devices.enabled");
  must(mD.get(DEVICES_MAX_KEY) === DEMO_DEVICES_MAX, "demo devices.max");
  must(mD.get(STORAGE_MAX_KEY) === DEMO_STORAGE_MAX, "demo storage.maxBytes");

  // Device usage by status
  async function deviceBreakdown(tenantId: string, label: string) {
    const r = await raw.execute({
      sql: `SELECT status, COUNT(*) AS n FROM devices WHERE tenant_id=? GROUP BY status`,
      args: [tenantId],
    });
    const paired = await raw.execute({
      sql: `SELECT COUNT(*) AS n FROM devices WHERE tenant_id=? AND status != 'DISABLED'`,
      args: [tenantId],
    });
    // PAIRED_NON_DISABLED typically means status in ACTIVE, OFFLINE (paired states)
    const canonical = await raw.execute({
      sql: `SELECT COUNT(*) AS n FROM devices WHERE tenant_id=? AND status IN ('ACTIVE','OFFLINE')`,
      args: [tenantId],
    });
    console.log(`devices_${label}_by_status=${JSON.stringify(r.rows)}`);
    console.log(`devices_${label}_non_disabled=${paired.rows[0]?.n}`);
    console.log(`devices_${label}_canonical_ACTIVE_OFFLINE=${canonical.rows[0]?.n}`);
    return {
      nonDisabled: Number(paired.rows[0]?.n ?? 0),
      canonical: Number(canonical.rows[0]?.n ?? 0),
      byStatus: r.rows,
    };
  }
  const dPilot = await deviceBreakdown(pilotT.id, "egaslemos");
  const dDemo = await deviceBreakdown(demoT.id, "demo");
  const dWitness = await deviceBreakdown(witnessT.id, "acc-mubsv40q");
  must(dPilot.canonical <= PILOT_DEVICES_MAX, "egaslemos device usage > limit");
  must(dDemo.canonical === 5 || dDemo.nonDisabled === 5, "demo device usage expected 5");
  must(dDemo.canonical <= DEMO_DEVICES_MAX, "demo device usage > limit");

  // Storage
  async function storageUsage(tenantId: string, label: string) {
    const committed = await raw.execute({
      sql: `SELECT COALESCE(SUM(file_size),0) AS n FROM media_assets WHERE tenant_id=?`,
      args: [tenantId],
    });
    const reserved = await raw.execute({
      sql: `SELECT COALESCE(SUM(expected_bytes),0) AS n FROM storage_reservations WHERE tenant_id=? AND status='RESERVED'`,
      args: [tenantId],
    });
    const allRes = await raw.execute({
      sql: `SELECT status, COUNT(*) AS n, COALESCE(SUM(expected_bytes),0) AS bytes
            FROM storage_reservations WHERE tenant_id=? GROUP BY status`,
      args: [tenantId],
    });
    const c = Number(committed.rows[0]?.n ?? 0);
    const r = Number(reserved.rows[0]?.n ?? 0);
    console.log(`storage_${label}_committed=${c}`);
    console.log(`storage_${label}_reserved=${r}`);
    console.log(`storage_${label}_effective=${c + r}`);
    console.log(`storage_${label}_reservations=${JSON.stringify(allRes.rows)}`);
    must(c >= 0, `${label} negative committed`);
    return { committed: c, reserved: r, effective: c + r };
  }
  const sPilot = await storageUsage(pilotT.id, "egaslemos");
  const sDemo = await storageUsage(demoT.id, "demo");
  const sWitness = await storageUsage(witnessT.id, "acc-mubsv40q");
  must(sPilot.effective <= PILOT_STORAGE_MAX, "egaslemos storage over limit");
  must(sDemo.effective <= DEMO_STORAGE_MAX, "demo storage over limit");
  must(sDemo.committed > 40 * 1024 * 1024 && sDemo.committed < 50 * 1024 * 1024, "demo storage not ≈45MiB");

  // Global reservations integrity
  const resGlobal = await raw.execute(`
    SELECT status, COUNT(*) AS n, COALESCE(SUM(expected_bytes),0) AS bytes
    FROM storage_reservations GROUP BY status
  `);
  console.log(`reservations_global=${JSON.stringify(resGlobal.rows)}`);
  const orphan = await raw.execute(`
    SELECT COUNT(*) AS n FROM storage_reservations sr
    LEFT JOIN tenants t ON t.id = sr.tenant_id WHERE t.id IS NULL
  `);
  console.log(`reservations_orphan_tenant=${orphan.rows[0]?.n}`);
  must(Number(orphan.rows[0]?.n ?? 0) === 0, "orphan reservations present");

  const dupOp = await raw.execute(`
    SELECT operation_id, COUNT(*) AS n FROM storage_reservations
    GROUP BY operation_id HAVING COUNT(*) > 1 LIMIT 10
  `);
  console.log(`reservations_dup_operation_id=${JSON.stringify(dupOp.rows)}`);
  if (dupOp.rows.length > 0) {
    note("MEDIUM", `duplicate operation_id rows: ${dupOp.rows.length}`);
  }

  const expiredStill = await raw.execute(`
    SELECT COUNT(*) AS n FROM storage_reservations
    WHERE status='RESERVED' AND expires_at IS NOT NULL AND expires_at < datetime('now')
  `);
  console.log(`reservations_expired_still_RESERVED=${expiredStill.rows[0]?.n}`);
  if (Number(expiredStill.rows[0]?.n ?? 0) > 0) {
    note("MEDIUM", `expired RESERVED still counted: ${expiredStill.rows[0]?.n}`);
  }

  // Witness TenantPlan count
  const wTp = await raw.execute({
    sql: `SELECT COUNT(*) AS n FROM tenant_plans WHERE tenant_id=? AND status='ACTIVE'`,
    args: [witnessT.id],
  });
  console.log(`witness_active_plans=${wTp.rows[0]?.n}`);
  must(Number(wTp.rows[0]?.n) === 0, "witness has ACTIVE plan");

  // Device quota allocation check (read-only assert)
  const dqPilot = await assertDevicesMaxAllocation(pilotT.id, "audit.pilot");
  const dqDemo = await assertDevicesMaxAllocation(demoT.id, "audit.demo");
  console.log(`alloc_devices_egaslemos=${dqPilot.decision}/${dqPilot.reason}`);
  console.log(`alloc_devices_demo=${dqDemo.decision}/${dqDemo.reason}`);
  must(dqPilot.decision === "ALLOW", "pilot device alloc should ALLOW");
  must(dqDemo.decision === "ALLOW", "demo device alloc should ALLOW");

  let witnessDeny = false;
  try {
    await assertDevicesMaxAllocation(witnessT.id, "audit.witness");
  } catch (e) {
    witnessDeny = true;
    console.log(`alloc_devices_witness=DENY ${String(e).slice(0, 120)}`);
  }
  must(witnessDeny, "witness device alloc must DENY");

  // Inventory counts for integrity compare
  const counts: Record<string, number> = {};
  for (const table of [
    "tenants",
    "devices",
    "contents",
    "media_assets",
    "playlists",
    "schedules",
    "storage_reservations",
    "tenant_plans",
    "plans",
    "plan_entitlements",
    "entitlement_definitions",
  ]) {
    if (!tableNames.includes(table)) continue;
    const c = await raw.execute(`SELECT COUNT(*) AS n FROM ${table}`);
    counts[table] = Number(c.rows[0]?.n ?? 0);
  }
  console.log(`inventory_counts=${JSON.stringify(counts)}`);

  // Checksum uniqueness sample
  const checksumDup = await raw.execute(`
    SELECT checksum, tenant_id, COUNT(*) AS n FROM media_assets
    WHERE checksum IS NOT NULL
    GROUP BY checksum, tenant_id HAVING COUNT(*) > 1 LIMIT 5
  `);
  console.log(`checksum_tenant_dups=${JSON.stringify(checksumDup.rows)}`);
  if (checksumDup.rows.length > 0) {
    note("HIGH", "checksum uniqueness broken within tenant");
  }

  console.log(`findings_count=${findings.length}`);
  if (stops.length) {
    console.log(`STOPS=${stops.length}`);
    process.exit(1);
  }
  console.log("post_expansion_audit_core=PASS");
}

main().catch((e) => {
  console.error(String(e).replace(/[A-Za-z0-9_-]{24,}/g, "REDACTED"));
  process.exit(1);
});

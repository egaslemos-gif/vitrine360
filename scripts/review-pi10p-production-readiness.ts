/**
 * PI-10P — Production readiness review (read-only).
 * Compares Preview vs Production schema/metadata. Never prints secrets.
 * Never mutates Production.
 */
import { config } from "dotenv";
import { createClient } from "@libsql/client";

const PREVIEW_HOST = "vitrine360-preview-elemos.aws-us-west-2.turso.io";
const PRODUCTION_HOST =
  "vitrine360-vercel-icfg-rd8hoku6p0oaszo88ixdwcu4.aws-us-east-1.turso.io";

function hostOf(url: string): string {
  if (!url) return "";
  try {
    return new URL(url.includes("://") ? url : `libsql://${url}`).hostname;
  } catch {
    return url.replace(/^libsql:\/\//, "").split("/")[0] || "";
  }
}

function libsqlUrl(url: string): string {
  if (!url) return "";
  return url.startsWith("libsql://") || url.startsWith("https://")
    ? url
    : `libsql://${url}`;
}

type TableInfo = { name: string; sql: string | null };
type IndexInfo = { name: string; tbl: string; sql: string | null };

async function introspect(client: ReturnType<typeof createClient>, label: string) {
  const tables = await client.execute(
    "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  const indexes = await client.execute(
    "SELECT name, tbl_name as tbl, sql FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  let journal = -1;
  for (const name of ["__drizzle_migrations", "drizzle_migrations"]) {
    try {
      const r = await client.execute(`SELECT COUNT(*) AS c FROM ${name}`);
      journal = Number(r.rows[0]?.c ?? -1);
      break;
    } catch {
      /* next */
    }
  }

  const tableList: TableInfo[] = tables.rows.map((r) => ({
    name: String(r.name),
    sql: r.sql == null ? null : String(r.sql),
  }));
  const indexList: IndexInfo[] = indexes.rows.map((r) => ({
    name: String(r.name),
    tbl: String(r.tbl),
    sql: r.sql == null ? null : String(r.sql),
  }));

  const expected = [
    "entitlement_definitions",
    "plans",
    "plan_entitlements",
    "tenant_plans",
    "storage_reservations",
    "media_assets",
    "devices",
    "tenants",
    "memberships",
  ];
  const present = new Set(tableList.map((t) => t.name));
  const missing = expected.filter((t) => !present.has(t));

  const dedupeIdx = indexList.find(
    (i) =>
      i.name.includes("media_assets_tenant_checksum") ||
      (i.sql || "").toLowerCase().includes("media_assets") &&
        (i.sql || "").toLowerCase().includes("checksum"),
  );

  // Column presence for key tables
  async function cols(table: string): Promise<string[]> {
    try {
      const r = await client.execute(`PRAGMA table_info(${table})`);
      return r.rows.map((row) => String(row.name));
    } catch {
      return [];
    }
  }

  const entitlementCols = await cols("entitlement_definitions");
  const reservationCols = await cols("storage_reservations");
  const mediaCols = await cols("media_assets");
  const deviceCols = await cols("devices");

  // Entitlement definition keys (read-only)
  let defKeys: string[] = [];
  try {
    const r = await client.execute(
      "SELECT key, value_type, enforcement_type, active FROM entitlement_definitions ORDER BY key",
    );
    defKeys = r.rows.map(
      (row) =>
        `${row.key}|${row.value_type}|${row.enforcement_type}|active=${row.active}`,
    );
  } catch {
    defKeys = ["UNAVAILABLE"];
  }

  let planCount = -1;
  let activeTenantPlansDup = -1;
  try {
    const p = await client.execute("SELECT COUNT(*) AS c FROM plans");
    planCount = Number(p.rows[0]?.c ?? -1);
    const d = await client.execute(
      `SELECT COUNT(*) AS c FROM (
         SELECT tenant_id FROM tenant_plans WHERE status='ACTIVE'
         GROUP BY tenant_id HAVING COUNT(*) > 1
       )`,
    );
    activeTenantPlansDup = Number(d.rows[0]?.c ?? -1);
  } catch {
    /* tables may be missing on Production */
  }

  const pi10pTenants = await client
    .execute("SELECT COUNT(*) AS c FROM tenants WHERE slug LIKE 'pi10p-%'")
    .catch(() => ({ rows: [{ c: -1 }] }));

  console.log(`=== ${label} ===`);
  console.log(`tables=${tableList.length}`);
  console.log(`indexes=${indexList.length}`);
  console.log(`journal=${journal}`);
  console.log(`missing_expected=${missing.join(",") || "none"}`);
  console.log(`dedupe_index=${dedupeIdx ? dedupeIdx.name : "ABSENT"}`);
  console.log(`entitlement_def_cols=${entitlementCols.join(",") || "ABSENT"}`);
  console.log(`reservation_cols=${reservationCols.join(",") || "ABSENT"}`);
  console.log(`media_cols_has_checksum=${mediaCols.includes("checksum")}`);
  console.log(`media_cols_has_tenant=${mediaCols.includes("tenant_id")}`);
  console.log(`device_cols_has_tenant=${deviceCols.includes("tenant_id")}`);
  console.log(`def_keys=${defKeys.length ? defKeys.join(";") : "none"}`);
  console.log(`plans=${planCount}`);
  console.log(`duplicate_active_tenant_plans=${activeTenantPlansDup}`);
  console.log(`pi10p_test_tenants=${pi10pTenants.rows[0]?.c}`);

  return {
    label,
    tableNames: tableList.map((t) => t.name).sort(),
    indexNames: indexList.map((i) => i.name).sort(),
    journal,
    missing,
    dedupeIndex: dedupeIdx?.name || null,
    entitlementCols,
    reservationCols,
    mediaCols,
    deviceCols,
    defKeys,
    planCount,
    activeTenantPlansDup,
    pi10pTenants: Number(pi10pTenants.rows[0]?.c ?? -1),
    tableSql: Object.fromEntries(tableList.map((t) => [t.name, t.sql])),
  };
}

async function main() {
  config({ path: ".env.local" });
  const localDb = process.env.DATABASE_URL || "";
  const localTurso = process.env.TURSO_DATABASE_URL || "";
  const productionUrl =
    localDb.startsWith("libsql://") || localDb.startsWith("https://")
      ? localDb
      : localTurso;
  const productionToken =
    process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || "";

  config({ path: ".env.preview.local", override: true });
  const previewDb = process.env.DATABASE_URL || "";
  const previewTurso = process.env.TURSO_DATABASE_URL || "";
  const previewUrl =
    previewDb.startsWith("libsql://") || previewDb.startsWith("https://")
      ? previewDb
      : previewTurso;
  const previewToken =
    process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || "";

  const prodHost = hostOf(productionUrl);
  const prevHost = hostOf(previewUrl);

  console.log("=== HARD SAFETY ===");
  console.log(`production_host=${prodHost || "ABSENT"}`);
  console.log(`preview_host=${prevHost || "ABSENT"}`);
  const hostsExpected =
    prodHost === PRODUCTION_HOST && prevHost === PREVIEW_HOST;
  const hostsDistinct = prodHost.length > 0 && prevHost.length > 0 && prodHost !== prevHost;
  const hostsOk = hostsExpected && hostsDistinct;
  console.log(`hosts_distinct_and_expected=${hostsOk}`);
  if (!hostsOk || !productionToken || !previewToken) {
    console.error("STOP: safety gate failed");
    process.exit(2);
  }
  console.log("mutations=none");
  console.log("migrations=none");
  console.log("deployments=none");

  const prod = createClient({
    url: libsqlUrl(productionUrl),
    authToken: productionToken,
  });
  const prev = createClient({
    url: libsqlUrl(previewUrl),
    authToken: previewToken,
  });

  const P = await introspect(prod, "PRODUCTION");
  const V = await introspect(prev, "PREVIEW");

  const onlyProd = P.tableNames.filter((t) => !V.tableNames.includes(t));
  const onlyPrev = V.tableNames.filter((t) => !P.tableNames.includes(t));
  const shared = P.tableNames.filter((t) => V.tableNames.includes(t));

  console.log("=== DRIFT ===");
  console.log(`tables_only_production=${onlyProd.join(",") || "none"}`);
  console.log(`tables_only_preview=${onlyPrev.join(",") || "none"}`);
  console.log(`shared_tables=${shared.length}`);

  // Column-level drift on shared critical tables
  const critical = [
    "devices",
    "media_assets",
    "tenants",
    "entitlement_definitions",
    "plans",
    "plan_entitlements",
    "tenant_plans",
    "storage_reservations",
  ];
  for (const t of critical) {
    const pc = new Set(
      t === "devices"
        ? P.deviceCols
        : t === "media_assets"
          ? P.mediaCols
          : t === "entitlement_definitions"
            ? P.entitlementCols
            : t === "storage_reservations"
              ? P.reservationCols
              : (
                  await (async () => {
                    try {
                      const r = await prod.execute(`PRAGMA table_info(${t})`);
                      return r.rows.map((row) => String(row.name));
                    } catch {
                      return [] as string[];
                    }
                  })()
                ),
    );
    const vc = new Set(
      t === "devices"
        ? V.deviceCols
        : t === "media_assets"
          ? V.mediaCols
          : t === "entitlement_definitions"
            ? V.entitlementCols
            : t === "storage_reservations"
              ? V.reservationCols
              : (
                  await (async () => {
                    try {
                      const r = await prev.execute(`PRAGMA table_info(${t})`);
                      return r.rows.map((row) => String(row.name));
                    } catch {
                      return [] as string[];
                    }
                  })()
                ),
    );
    if (pc.size === 0 && vc.size === 0) {
      console.log(`cols_${t}=BOTH_ABSENT`);
      continue;
    }
    if (pc.size === 0) {
      console.log(`cols_${t}=PROD_ABSENT`);
      continue;
    }
    if (vc.size === 0) {
      console.log(`cols_${t}=PREV_ABSENT`);
      continue;
    }
    const onlyP = [...pc].filter((c) => !vc.has(c));
    const onlyV = [...vc].filter((c) => !pc.has(c));
    console.log(
      `cols_${t}=ok_shared=${[...pc].filter((c) => vc.has(c)).length} only_prod=${onlyP.join("|") || "none"} only_prev=${onlyV.join("|") || "none"}`,
    );
  }

  console.log("safety=PASS");
  console.log("read_only=true");
}

main().catch((e) => {
  console.error(String(e).replace(/[A-Za-z0-9_-]{24,}/g, "REDACTED"));
  process.exit(1);
});

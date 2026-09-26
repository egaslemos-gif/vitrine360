/**
 * PI-10P — Pre-migration Production inventory + safety (read-only).
 * Loads .env.local (Production). Refuses Preview host.
 * No mutations. No secrets printed.
 */
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const PRODUCTION_HOST =
  "vitrine360-vercel-icfg-rd8hoku6p0oaszo88ixdwcu4.aws-us-east-1.turso.io";
const PREVIEW_HOST = "vitrine360-preview-elemos.aws-us-west-2.turso.io";

const MIGRATION_FILES = [
  "0000_known_leopardon.sql",
  "0001_stale_mole_man.sql",
  "0002_mute_captain_america.sql",
  "0003_friendly_tv_pairing.sql",
  "0004_slide_fit_mode.sql",
  "0005_memberships_identities.sql",
  "0006_platform_identity.sql",
  "0007_entitlements.sql",
  "0008_storage_reservations.sql",
];

function hostOf(url: string): string {
  try {
    return new URL(url.includes("://") ? url : `libsql://${url}`).hostname;
  } catch {
    return "";
  }
}

function libsqlUrl(url: string): string {
  return url.startsWith("libsql://") || url.startsWith("https://")
    ? url
    : `libsql://${url}`;
}

async function main() {
  config({ path: ".env.local" });
  const dbUrl = process.env.DATABASE_URL || "";
  const tursoUrl = process.env.TURSO_DATABASE_URL || "";
  // Prefer Turso Production when DATABASE_URL is local file:
  let url = "";
  if (tursoUrl && hostOf(tursoUrl) === PRODUCTION_HOST) {
    url = tursoUrl.startsWith("libsql://") || tursoUrl.startsWith("https://")
      ? tursoUrl
      : `libsql://${tursoUrl}`;
  } else if (dbUrl.startsWith("libsql://") || dbUrl.startsWith("https://")) {
    url = dbUrl;
  } else if (tursoUrl) {
    url = tursoUrl.startsWith("libsql://") || tursoUrl.startsWith("https://")
      ? tursoUrl
      : `libsql://${tursoUrl}`;
  }
  const token =
    process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || "";
  const host = hostOf(url);

  console.log("=== HARD SAFETY ===");
  console.log(`production_host_expected=${PRODUCTION_HOST}`);
  console.log(`preview_host_forbidden=${PREVIEW_HOST}`);
  console.log(`target_host=${host || "ABSENT"}`);
  console.log(`ENTITLEMENTS_ENABLED=${process.env.ENTITLEMENTS_ENABLED ?? "UNSET"}`);

  if (!url || !token) {
    console.error("STOP: Production credentials ABSENT");
    process.exit(2);
  }
  const isProduction = host === PRODUCTION_HOST;
  const isPreview =
    host === PREVIEW_HOST || host.toLowerCase().includes("preview");
  if (!isProduction) {
    console.error("STOP: target is not Production host");
    process.exit(2);
  }
  if (isPreview) {
    console.error("STOP: target is Preview");
    process.exit(2);
  }
  console.log("hosts_ok=true");

  const client = createClient({ url: libsqlUrl(url), authToken: token });

  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  const indexes = await client.execute(
    "SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );

  console.log("=== INVENTORY ===");
  console.log(`tables=${tables.rows.length}`);
  console.log(`table_names=${tables.rows.map((r) => r.name).join(",")}`);
  console.log(`indexes=${indexes.rows.length}`);

  let journal = -1;
  let journalRows: Array<{ id: unknown; hash: unknown }> = [];
  try {
    const j = await client.execute(
      "SELECT id, hash FROM __drizzle_migrations ORDER BY id ASC",
    );
    journal = j.rows.length;
    journalRows = j.rows.map((r) => ({
      id: r.id as unknown,
      hash: r.hash as unknown,
    }));
  } catch {
    journal = -1;
  }
  console.log(`journal_rows=${journal}`);
  if (journalRows.length) {
    console.log(
      `journal_hashes=${journalRows.map((r) => String(r.hash).slice(0, 12)).join(",")}`,
    );
  }

  const expected = [
    "entitlement_definitions",
    "plans",
    "plan_entitlements",
    "tenant_plans",
    "storage_reservations",
  ];
  const present = new Set(tables.rows.map((r) => String(r.name)));
  for (const t of expected) {
    console.log(`table_${t}=${present.has(t) ? "PRESENT" : "MISSING"}`);
  }
  const dedupe = indexes.rows.find((r) =>
    String(r.name).includes("media_assets_tenant_checksum"),
  );
  console.log(`checksum_uidx=${dedupe ? "PRESENT" : "MISSING"}`);

  // Row counts for data integrity baseline
  const countTables = [
    "tenants",
    "users",
    "memberships",
    "devices",
    "media_assets",
    "contents",
    "playlists",
    "schedules",
    "platform_assignments",
  ];
  for (const t of countTables) {
    if (!present.has(t)) {
      console.log(`count_${t}=ABSENT`);
      continue;
    }
    const c = await client.execute(`SELECT COUNT(*) AS c FROM ${t}`);
    console.log(`count_${t}=${c.rows[0]?.c}`);
  }

  // Duplicate tenant+checksum check (STOP if >0 before unique index)
  if (present.has("media_assets")) {
    const dups = await client.execute(`
      SELECT COUNT(*) AS groups FROM (
        SELECT tenant_id, checksum FROM media_assets
        WHERE checksum IS NOT NULL
        GROUP BY tenant_id, checksum
        HAVING COUNT(*) > 1
      )
    `);
    const g = Number(dups.rows[0]?.groups ?? 0);
    console.log(`duplicate_tenant_checksum_groups=${g}`);
    console.log(
      `checksum_index_safe=${g === 0 ? "YES" : "NO_STOP"}`,
    );
  }

  // Migration file hashes + destructive scan
  console.log("=== MIGRATION SOURCE ===");
  const drizzleDir = path.join(process.cwd(), "drizzle");
  for (const file of MIGRATION_FILES) {
    const body = fs.readFileSync(path.join(drizzleDir, file), "utf8");
    const hash = createHash("sha256").update(body).digest("hex");
    const destructive =
      /^\s*(DROP\s+TABLE|DELETE\s+FROM|TRUNCATE)/im.test(body) ||
      /\bDROP\s+TABLE\b/i.test(body);
    console.log(
      `file=${file} hash=${hash.slice(0, 16)} destructive=${destructive}`,
    );
  }

  // Which base tables already look like post-0006
  const baseOk = [
    "tenants",
    "users",
    "memberships",
    "devices",
    "media_assets",
    "platform_assignments",
  ].every((t) => present.has(t));
  console.log(`base_schema_looks_post_0006=${baseOk}`);
  console.log(
    `pending_additive_only=${!present.has("entitlement_definitions") && !present.has("storage_reservations")}`,
  );
  console.log("mutations=none");
  console.log("read_only=true");
}

main().catch((e) => {
  console.error(String(e).replace(/[A-Za-z0-9_-]{24,}/g, "REDACTED"));
  process.exit(1);
});

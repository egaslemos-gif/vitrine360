/**
 * PI-10P — Production schema migration (additive pending only).
 *
 * HARD RULES:
 * - Target MUST be Production Turso host (never Preview, never file:).
 * - Does NOT re-execute migrations that contain DROP TABLE when base schema
 *   is already present (0001 is destructive rebuild — STOP if forced).
 * - Applies pending additive SQL: 0007 + 0008 (and any other pending file
 *   that has no DROP TABLE).
 * - Baseline-journals 0000–0006 ONLY after structural attestation, without
 *   re-executing DROP TABLE SQL (documented exception — re-exec would destroy data).
 * - Does NOT enable ENTITLEMENTS_ENABLED.
 * - Does NOT seed plans / TenantPlans / cohort.
 * - Does NOT print secrets.
 */
import { createClient, type Client } from "@libsql/client";
import { createHash } from "node:crypto";
import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";

const PRODUCTION_HOST =
  "vitrine360-vercel-icfg-rd8hoku6p0oaszo88ixdwcu4.aws-us-east-1.turso.io";
const PREVIEW_HOST = "vitrine360-preview-elemos.aws-us-west-2.turso.io";
const PRODUCTION_URL = `libsql://${PRODUCTION_HOST}`;

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

/**
 * On live Production the base schema is already present (ensureSchema / prior push).
 * Re-executing 0000–0006 is unsafe (0001 DROP TABLE; 0000 hits UNIQUE on existing rows).
 * Only execute additive entitlement/reservation migrations.
 */
const EXECUTE_FILES = new Set([
  "0007_entitlements.sql",
  "0008_storage_reservations.sql",
]);

const BASELINE_REQUIRED_TABLES = [
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

function hostOf(url: string): string {
  try {
    return new URL(url.includes("://") ? url : `libsql://${url}`).hostname;
  } catch {
    return "";
  }
}

function resolveProductionUrl(): { url: string; token: string } {
  config({ path: ".env.local" });
  const dbUrl = process.env.DATABASE_URL || "";
  const tursoUrl = process.env.TURSO_DATABASE_URL || "";
  const token =
    process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || "";

  // Prefer explicit Turso URL when DATABASE_URL is local file
  let url = "";
  if (tursoUrl && hostOf(tursoUrl) === PRODUCTION_HOST) {
    url = tursoUrl.startsWith("libsql://") ? tursoUrl : `libsql://${tursoUrl}`;
  } else if (dbUrl.startsWith("libsql://") || dbUrl.startsWith("https://")) {
    url = dbUrl;
  }

  return { url, token };
}

function splitStatements(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function fileHasDropTable(body: string): boolean {
  return /\bDROP\s+TABLE\b/i.test(body);
}

async function ensureMigrationsTable(client: Client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL,
      created_at NUMERIC
    )
  `);
}

async function appliedHashes(client: Client): Promise<Set<string>> {
  const res = await client.execute(
    "SELECT hash FROM __drizzle_migrations ORDER BY created_at ASC, id ASC",
  );
  return new Set(res.rows.map((r) => String(r.hash ?? "")));
}

async function tableNames(client: Client): Promise<Set<string>> {
  const res = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  );
  return new Set(res.rows.map((r) => String(r.name)));
}

async function countRows(client: Client, table: string): Promise<number> {
  const r = await client.execute(`SELECT COUNT(*) AS c FROM ${table}`);
  return Number(r.rows[0]?.c ?? 0);
}

async function main() {
  const { url, token } = resolveProductionUrl();
  const host = hostOf(url);

  console.log("PI-10P Production schema migration");
  console.log(`ENTITLEMENTS_ENABLED=${process.env.ENTITLEMENTS_ENABLED ?? "UNSET"}`);
  console.log(`target_host=${host || "ABSENT"}`);
  console.log(`expected_host=${PRODUCTION_HOST}`);

  if (!url || !token) {
    console.error("STOP: Production Turso URL/token ABSENT");
    process.exit(2);
  }
  if (host === PREVIEW_HOST) {
    console.error("STOP: refused Preview target");
    process.exit(2);
  }
  if (host !== PRODUCTION_HOST) {
    console.error("STOP: target is not Production host");
    process.exit(2);
  }
  if (url.startsWith("file:")) {
    console.error("STOP: refused file database");
    process.exit(2);
  }
  console.log("target_guard=PASS");
  console.log(`production_url_canonical=${PRODUCTION_URL}`);

  const client = createClient({ url, authToken: token });
  const beforeTables = await tableNames(client);

  // Pre counts
  const countTargets = [
    "tenants",
    "users",
    "memberships",
    "devices",
    "media_assets",
    "contents",
    "playlists",
    "schedules",
  ];
  const beforeCounts: Record<string, number> = {};
  for (const t of countTargets) {
    if (beforeTables.has(t)) beforeCounts[t] = await countRows(client, t);
  }
  console.log(
    `pre_counts=${Object.entries(beforeCounts)
      .map(([k, v]) => `${k}:${v}`)
      .join(",")}`,
  );

  // Duplicate checksum STOP
  if (beforeTables.has("media_assets")) {
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
    if (g > 0) {
      console.error("STOP: duplicate tenant+checksum — cannot create unique index");
      process.exit(1);
    }
  }

  // Structural attestation for baseline 0000–0006
  const missingBase = BASELINE_REQUIRED_TABLES.filter((t) => !beforeTables.has(t));
  if (missingBase.length) {
    console.error(
      `STOP: base schema incomplete missing=${missingBase.join(",")}`,
    );
    process.exit(1);
  }
  console.log("base_schema_attestation=PASS");

  await ensureMigrationsTable(client);
  const done = await appliedHashes(client);
  console.log(`journal_rows_before=${done.size}`);

  const drizzleDir = path.join(process.cwd(), "drizzle");
  const appliedExec: string[] = [];
  const baselineRecorded: string[] = [];
  const skipped: string[] = [];

  for (const file of MIGRATION_FILES) {
    const full = path.join(drizzleDir, file);
    const body = fs.readFileSync(full, "utf8");
    const hash = createHash("sha256").update(body).digest("hex");

    if (done.has(hash)) {
      skipped.push(file);
      continue;
    }

    if (!EXECUTE_FILES.has(file)) {
      // Baseline attestation: live schema already satisfies 0000–0006.
      // Do NOT re-exec (0001 DROP TABLE; 0000 UNIQUE on existing rows).
      if (fileHasDropTable(body)) {
        console.log(
          `baseline_record=${file} reason=destructive_DROP_TABLE_already_satisfied`,
        );
      } else {
        console.log(
          `baseline_record=${file} reason=live_schema_attested_reexec_unsafe`,
        );
      }
      await client.execute({
        sql: "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
        args: [hash, Date.now()],
      });
      done.add(hash);
      baselineRecorded.push(file);
      continue;
    }

    // Execute additive 0007 / 0008 only
    const statements = splitStatements(body);
    console.log(`applying=${file} statements=${statements.length}`);
    for (const stmt of statements) {
      try {
        await client.execute(stmt);
      } catch (err) {
        const msg = String(err);
        const ignorable =
          /duplicate column|already exists|UNIQUE constraint failed: __drizzle/i.test(
            msg,
          );
        if (!ignorable) {
          console.error(
            `STOP: migration failure file=${file} err=${msg.replace(/[A-Za-z0-9_-]{24,}/g, "REDACTED")}`,
          );
          process.exit(1);
        }
        console.log(`ignored_idempotent_err=${file}`);
      }
    }
    await client.execute({
      sql: "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
      args: [hash, Date.now()],
    });
    done.add(hash);
    appliedExec.push(file);
  }

  // Checksum unique index (also in 0008; ensure present)
  console.log("checksum_index=ensure");
  try {
    await client.execute(
      "CREATE UNIQUE INDEX IF NOT EXISTS media_assets_tenant_checksum_uidx ON media_assets (tenant_id, checksum)",
    );
  } catch (err) {
    console.error(
      `STOP: checksum index failed err=${String(err).replace(/[A-Za-z0-9_-]{24,}/g, "REDACTED")}`,
    );
    process.exit(1);
  }

  const afterTables = await tableNames(client);
  const afterCounts: Record<string, number> = {};
  for (const t of countTargets) {
    if (afterTables.has(t)) afterCounts[t] = await countRows(client, t);
  }

  const countDrift = Object.keys(beforeCounts).filter(
    (k) => beforeCounts[k] !== afterCounts[k],
  );
  console.log(
    `post_counts=${Object.entries(afterCounts)
      .map(([k, v]) => `${k}:${v}`)
      .join(",")}`,
  );
  console.log(`count_drift=${countDrift.join(",") || "none"}`);
  if (countDrift.length) {
    console.error("STOP: unexpected row count change");
    process.exit(1);
  }

  const required = [
    "entitlement_definitions",
    "plans",
    "plan_entitlements",
    "tenant_plans",
    "storage_reservations",
  ];
  for (const t of required) {
    console.log(`table_${t}=${afterTables.has(t) ? "PRESENT" : "MISSING"}`);
    if (!afterTables.has(t)) {
      console.error(`STOP: missing ${t}`);
      process.exit(1);
    }
  }

  // storage_reservations columns
  const cols = await client.execute("PRAGMA table_info(storage_reservations)");
  const colNames = cols.rows.map((r) => String(r.name));
  console.log(`storage_reservation_cols=${colNames.join(",")}`);
  if (!colNames.includes("expected_bytes")) {
    console.error("STOP: expected_bytes missing");
    process.exit(1);
  }
  if (colNames.includes("reserved_bytes")) {
    console.error("STOP: unexpected reserved_bytes column");
    process.exit(1);
  }

  const idx = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='index' AND name='media_assets_tenant_checksum_uidx'",
  );
  console.log(
    `checksum_uidx=${idx.rows.length ? "PRESENT" : "MISSING"}`,
  );
  if (!idx.rows.length) {
    console.error("STOP: checksum uidx missing");
    process.exit(1);
  }

  const journal = await client.execute(
    "SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id ASC",
  );
  const hashes = journal.rows.map((r) => String(r.hash));
  const dup = hashes.filter((h, i) => hashes.indexOf(h) !== i);
  console.log(`journal_rows_after=${journal.rows.length}`);
  console.log(`journal_duplicates=${dup.length}`);
  console.log(`migrations_executed=${appliedExec.join(",") || "(none)"}`);
  console.log(
    `migrations_baseline_recorded=${baselineRecorded.join(",") || "(none)"}`,
  );
  console.log(`migrations_skipped=${skipped.join(",") || "(none)"}`);

  if (dup.length > 0 || journal.rows.length < MIGRATION_FILES.length) {
    console.error("STOP: journal inconsistent");
    process.exit(1);
  }

  // Empty entitlement catalog (schema-only)
  const planCount = await countRows(client, "plans");
  const defCount = await countRows(client, "entitlement_definitions");
  const tpCount = await countRows(client, "tenant_plans");
  const resCount = await countRows(client, "storage_reservations");
  console.log(
    `new_table_rows plans=${planCount} defs=${defCount} tenant_plans=${tpCount} reservations=${resCount}`,
  );
  console.log(`ENTITLEMENTS_ENABLED_after=${process.env.ENTITLEMENTS_ENABLED ?? "UNSET"}`);
  console.log("cohort_created=false");
  console.log("flag_changed=false");
  console.log("migration_phase=SUCCESS");
}

main().catch((err) => {
  console.error(String(err).replace(/[A-Za-z0-9_-]{24,}/g, "REDACTED"));
  process.exit(1);
});

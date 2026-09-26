/**
 * PI-10P — Apply existing drizzle SQL migrations to Preview Turso ONLY.
 *
 * Loads `.env.preview.local` (not `.env.local`).
 * Hard-stops if DATABASE_URL is Production or not the known Preview host.
 * Does NOT re-run the provisioner. Does NOT create cohort data.
 * Does NOT print secrets.
 */
import { createClient, type Client } from "@libsql/client";
import { createHash } from "node:crypto";
import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";

const PREVIEW_HOST =
  "libsql://vitrine360-preview-elemos.aws-us-west-2.turso.io";
const PRODUCTION_HOST =
  "libsql://vitrine360-vercel-icfg-rd8hoku6p0oaszo88ixdwcu4.aws-us-east-1.turso.io";

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

function status(v: string | undefined | null) {
  return v && String(v).trim() ? "PRESENT" : "ABSENT";
}

function normalizeUrl(url: string) {
  return url.trim().replace(/\/$/, "");
}

function assertPreviewTarget(url: string) {
  const u = normalizeUrl(url);
  if (u === normalizeUrl(PRODUCTION_HOST)) {
    console.error("STOP: target is Production hostname");
    process.exit(2);
  }
  if (u !== normalizeUrl(PREVIEW_HOST)) {
    console.error(
      `STOP: target hostname mismatch. expected=${PREVIEW_HOST} got=${u.replace(/[A-Za-z0-9_-]{24,}/g, "REDACTED")}`,
    );
    process.exit(2);
  }
}

function splitStatements(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
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
  return new Set(
    (res.rows as Array<{ hash?: string }>).map((r) => String(r.hash ?? "")),
  );
}

async function main() {
  // Preview-only env — do not load .env.local (Production SQL JWT lives there)
  config({ path: ".env.preview.local", override: true });

  const url =
    process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "";
  const token =
    process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || "";

  console.log("PI-10P Preview migration");
  console.log(`DATABASE_URL=${status(url)}`);
  console.log(`DATABASE_AUTH_TOKEN=${status(token)}`);
  console.log(`ENTITLEMENTS_ENABLED=${process.env.ENTITLEMENTS_ENABLED ?? "UNSET"}`);

  if (!url || !token) {
    console.error("STOP: Preview DATABASE_URL / DATABASE_AUTH_TOKEN ABSENT");
    process.exit(2);
  }

  assertPreviewTarget(url);
  console.log("target_guard=PASS");
  console.log(`preview_host=${PREVIEW_HOST}`);
  console.log("production_host_rejected=true");

  const client = createClient({ url, authToken: token });

  await ensureMigrationsTable(client);
  const done = await appliedHashes(client);
  console.log(`journal_rows_before=${done.size}`);

  const drizzleDir = path.join(process.cwd(), "drizzle");
  const applied: string[] = [];
  const skipped: string[] = [];
  const pending: string[] = [];

  for (const file of MIGRATION_FILES) {
    const full = path.join(drizzleDir, file);
    if (!fs.existsSync(full)) {
      console.error(`STOP: missing migration file ${file}`);
      process.exit(1);
    }
    const body = fs.readFileSync(full, "utf8");
    const hash = createHash("sha256").update(body).digest("hex");
    if (done.has(hash)) {
      skipped.push(file);
      continue;
    }
    pending.push(file);
    const statements = splitStatements(body);
    console.log(`applying=${file} statements=${statements.length}`);
    for (const stmt of statements) {
      try {
        await client.execute(stmt);
      } catch (err) {
        const msg = String(err);
        // Idempotent tolerance for additive re-runs / duplicate column
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
      }
    }
    await client.execute({
      sql: "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
      args: [hash, Date.now()],
    });
    applied.push(file);
    done.add(hash);
  }

  // Runtime ensure path for checksum unique (PI-10L) — Preview only, no cohort data
  console.log("ensureSchema_checksum=start");
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

  const after = await appliedHashes(client);
  const journalTags = (
    await client.execute(
      "SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id ASC",
    )
  ).rows as unknown as Array<{ id: number; hash: string; created_at: number }>;

  // Duplicate hash check
  const hashes = journalTags.map((r) => r.hash);
  const dup = hashes.filter((h, i) => hashes.indexOf(h) !== i);
  console.log(`migrations_applied_this_run=${applied.join(",") || "(none)"}`);
  console.log(`migrations_skipped_already=${skipped.join(",") || "(none)"}`);
  console.log(`migrations_expected=${MIGRATION_FILES.length}`);
  console.log(`journal_rows_after=${after.size}`);
  console.log(`journal_duplicates=${dup.length}`);
  console.log(
    `journal=${dup.length === 0 && after.size >= MIGRATION_FILES.length ? "PASS" : "FAIL"}`,
  );

  if (dup.length > 0 || after.size < MIGRATION_FILES.length) {
    console.error("STOP: journal inconsistent");
    process.exit(1);
  }

  console.log("migration_phase=SUCCESS");
  console.log("cohort_data_created=false");
  console.log("provisioner_rerun=false");
}

main().catch((err) => {
  console.error(String(err).replace(/[A-Za-z0-9_-]{24,}/g, "REDACTED"));
  process.exit(1);
});

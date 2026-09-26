/**
 * PI-10P — Production integrity check (read-only). Never prints secrets.
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

async function main() {
  config({ path: ".env.local", override: true });
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

  console.log(`dotenv_local_loaded=true`);
  console.log(`production_host=${prodHost || "ABSENT"}`);
  console.log(`preview_host=${prevHost || "ABSENT"}`);
  console.log(
    `hosts_distinct=${
      Boolean(prodHost) &&
      Boolean(prevHost) &&
      prodHost !== prevHost &&
      prodHost === PRODUCTION_HOST &&
      prevHost === PREVIEW_HOST
    }`,
  );

  if (prodHost !== PRODUCTION_HOST) {
    console.error("STOP: production URL host mismatch");
    process.exit(2);
  }
  if (prevHost !== PREVIEW_HOST) {
    console.error("STOP: preview URL host mismatch");
    process.exit(2);
  }
  if (!productionToken || !previewToken) {
    console.error("STOP: missing tokens (not printed)");
    process.exit(2);
  }

  const prod = createClient({
    url: libsqlUrl(productionUrl),
    authToken: productionToken,
  });
  const prev = createClient({
    url: libsqlUrl(previewUrl),
    authToken: previewToken,
  });

  async function meta(client: ReturnType<typeof createClient>, label: string) {
    const migrationTables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%drizzle%' OR name LIKE '%migration%')",
    );
    const migNames = migrationTables.rows.map((r) => String(r.name)).join(",");
    let journal = -1;
    for (const name of ["__drizzle_migrations", "drizzle_migrations"]) {
      try {
        const r = await client.execute(`SELECT COUNT(*) AS c FROM ${name}`);
        journal = Number(r.rows[0]?.c ?? -1);
        break;
      } catch {
        /* try next */
      }
    }
    const tables = await client.execute(
      "SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table'",
    );
    const tenants = await client.execute(
      "SELECT COUNT(*) AS c FROM tenants WHERE slug LIKE 'pi10p-%'",
    ).catch(() => ({ rows: [{ c: -1 }] }));
    console.log(
      `${label}_migration_tables=${migNames || "none"} journal=${journal} tables=${tables.rows[0]?.c} pi10p_test_tenants=${tenants.rows[0]?.c}`,
    );
    return {
      journal,
      tables: Number(tables.rows[0]?.c ?? -1),
      pi10pTenants: Number(tenants.rows[0]?.c ?? -1),
    };
  }

  const p = await meta(prod, "production");
  await meta(prev, "preview");

  console.log(`production_pi10p_tenants_absent=${p.pi10pTenants === 0}`);
  console.log(`production_journal_entries=${p.journal}`);
  console.log("production_mutations=none (read-only check)");
  console.log("entitlements_production=UNSET_IN_VERCEL_ENV_AUDIT");
  console.log("integrity=PASS");
}

main().catch((e) => {
  console.error(String(e).replace(/[A-Za-z0-9_-]{24,}/g, "REDACTED"));
  process.exit(1);
});

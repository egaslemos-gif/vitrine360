/** Read-only PI-10P cohort integrity probe — no mutations. */
import { config } from "dotenv";
import { createClient } from "@libsql/client";

async function main() {
  config({ path: ".env.local" });
  const PRODUCTION_HOST =
    "vitrine360-vercel-icfg-rd8hoku6p0oaszo88ixdwcu4.aws-us-east-1.turso.io";
  const urlRaw = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "";
  const url = urlRaw.startsWith("libsql://")
    ? urlRaw
    : urlRaw.startsWith("https://")
      ? urlRaw
      : `libsql://${urlRaw}`;
  const token =
    process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || "";
  const host = new URL(url.replace(/^libsql:/, "https:")).hostname;
  if (host !== PRODUCTION_HOST || !token) {
    console.error("STOP: not Production");
    process.exit(2);
  }
  const c = createClient({ url, authToken: token });
  const active = await c.execute(
    "SELECT COUNT(*) AS n FROM tenant_plans WHERE status = 'ACTIVE'",
  );
  const rows = await c.execute(
    `SELECT t.slug AS slug, p.key AS plan_key
     FROM tenant_plans tp
     JOIN tenants t ON t.id = tp.tenant_id
     JOIN plans p ON p.id = tp.plan_id
     WHERE tp.status = 'ACTIVE'`,
  );
  const demo = await c.execute(
    `SELECT COUNT(*) AS n FROM tenant_plans
     WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'demo')`,
  );
  console.log(`active_tenant_plans=${active.rows[0]?.n}`);
  console.log(`active_rows=${JSON.stringify(rows.rows)}`);
  console.log(`demo_tenant_plans=${demo.rows[0]?.n}`);
  console.log("cohort_probe=PASS");
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});

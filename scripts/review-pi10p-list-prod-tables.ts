import { config } from "dotenv";
import { createClient } from "@libsql/client";

async function main() {
  config({ path: ".env.local" });
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "";
  const token = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || "";
  const c = createClient({
    url: url.startsWith("libsql") ? url : `libsql://${url}`,
    authToken: token,
  });
  const t = await c.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  console.log("PROD_TABLES=" + t.rows.map((r) => String(r.name)).join(","));
  const i = await c.execute(
    "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  console.log("PROD_INDEX_COUNT=" + i.rows.length);
  console.log(
    "PROD_HAS_CHECKSUM_UIDX=" +
      i.rows.some((r) => String(r.name).includes("checksum")),
  );
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});

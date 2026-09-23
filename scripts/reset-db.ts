/**
 * Destructive local reset: disable FKs, drop all user tables/indexes.
 */
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

config({ path: ".env.local" });

function resolveUrl() {
  const url = process.env.DATABASE_URL ?? "file:./data/vitrine360.db";
  if (url.startsWith("file:")) {
    const filePath = url.replace(/^file:/, "");
    const absolute = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    return { url: `file:${absolute.replace(/\\/g, "/")}`, absolute };
  }
  return { url, absolute: null };
}

async function main() {
  const { url, absolute } = resolveUrl();
  if (absolute && fs.existsSync(absolute)) {
    fs.unlinkSync(absolute);
    for (const suffix of ["-wal", "-shm"]) {
      const p = absolute + suffix;
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    console.log("Deleted", absolute);
  }
  const client = createClient({ url });
  await client.execute("SELECT 1");
  console.log("Empty database ready at", url);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

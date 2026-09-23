import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { mediaAssets } from "../src/db/schema";
import { getMediaStorage } from "../src/services/media";

const id = process.argv[2] ?? "b349398f-282f-44de-b959-8460c2784319";

async function main() {
  const [row] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
  console.log({
    found: !!row,
    id: row?.id,
    storageProvider: row?.storageProvider,
    storageKey: row?.storageKey,
    fileSize: row?.fileSize,
    checksumPrefix: row?.checksum?.slice(0, 24),
  });
  if (!row) return;
  const storage = getMediaStorage();
  console.log("runtimeProvider", storage.name);
  const url = await storage.getUrl(row.storageKey);
  const u = new URL(url);
  console.log("signedPath", u.pathname);
  const res = await fetch(url, { cache: "no-store" });
  console.log("upstream", {
    status: res.status,
    ok: res.ok,
    ct: res.headers.get("content-type"),
    cl: res.headers.get("content-length"),
  });
  if (!res.ok) console.log("upstreamBody", (await res.text()).slice(0, 400));

  // Try tenants/ prefix if missing
  if (!row.storageKey.startsWith("tenants/")) {
    const alt = `tenants/${row.storageKey}`;
    try {
      const url2 = await storage.getUrl(alt);
      const res2 = await fetch(url2, { cache: "no-store" });
      console.log("alt tenants/ prefix", { key: alt, status: res2.status, ok: res2.ok });
    } catch (e) {
      console.log("alt failed", e instanceof Error ? e.message : String(e));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

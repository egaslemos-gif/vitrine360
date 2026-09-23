import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { db } from "../src/db";
import { mediaAssets, contentAssets } from "../src/db/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
  console.log("Auditing Media Assets for duplicates...");
  const duplicates = await db
    .select({
      tenantId: mediaAssets.tenantId,
      checksum: mediaAssets.checksum,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(mediaAssets)
    .groupBy(mediaAssets.tenantId, mediaAssets.checksum)
    .having(sql`count(*) > 1`);

  if (duplicates.length === 0) {
    console.log("No duplicates found. Safe to apply UNIQUE constraint.");
    return;
  }

  console.log(`Found ${duplicates.length} duplicate groups:\n`);

  for (const group of duplicates) {
    console.log(`- Tenant: ${group.tenantId} | Checksum: ${group.checksum} | Count: ${group.count}`);
    
    // Fetch individual assets in this group
    const assets = await db
      .select({
        id: mediaAssets.id,
        fileName: mediaAssets.fileName,
        storageKey: mediaAssets.storageKey,
      })
      .from(mediaAssets)
      .where(
        sql`${mediaAssets.tenantId} = ${group.tenantId} AND ${mediaAssets.checksum} = ${group.checksum}`
      );
    
    for (const asset of assets) {
      // Check content usage
      const contents = await db
        .select()
        .from(contentAssets)
        .where(eq(contentAssets.mediaAssetId, asset.id));
      console.log(`  > Asset ID: ${asset.id} | File: ${asset.fileName} | Used by ${contents.length} contents`);
    }
  }
}

main().catch(console.error);

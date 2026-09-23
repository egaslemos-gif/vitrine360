/**
 * Production smoke helper: create Tenant B + media, print IDs for IDOR checks.
 * Uses TURSO_* from env (same DB as production). Does not modify Phase 3A product code.
 */
import assert from "node:assert/strict";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  if (!process.env.TURSO_DATABASE_URL && !process.env.DATABASE_URL?.startsWith("libsql")) {
    // Prefer Turso for prod smoke
    if (process.env.TURSO_DATABASE_URL) {
      process.env.DATABASE_URL = process.env.TURSO_DATABASE_URL;
    }
  }
  if (process.env.TURSO_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TURSO_DATABASE_URL;
  }
  if (process.env.TURSO_AUTH_TOKEN) {
    process.env.DATABASE_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;
  }

  const { createTenant } = await import("../src/services/tenants");
  const { uploadMediaAsset, getMediaAsset, deleteMediaAsset, createContent } =
    await import("../src/services/contents");

  const stamp = Date.now().toString(36);
  const tenantB = await createTenant({
    name: `Smoke Tenant B ${stamp}`,
    slug: `smoke-b-${stamp}`,
  });

  const PNG_B = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
  const assetB = await uploadMediaAsset({
    fileName: `tenant-b-${stamp}.png`,
    mimeType: "image/png",
    data: PNG_B,
    tenantId: tenantB,
  });

  const tenantA = "cafb0624-3391-4749-a6f9-f55cdc0d94d4";
  assert.equal(await getMediaAsset(assetB.id, tenantA), null);

  await assert.rejects(
    () => deleteMediaAsset(assetB.id, tenantA),
    /not found/i,
  );
  await assert.rejects(
    () =>
      createContent(
        {
          type: "IMAGE",
          title: "IDOR",
          durationMs: 3000,
          payload: {},
          status: "ACTIVE",
          mediaAssetId: assetB.id,
        },
        tenantA,
      ),
    /not found/i,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        tenantB,
        assetBId: assetB.id,
        note: "Service-layer IDOR against production Turso PASS",
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Phase 3C-B — GIF Support (GIF-001 … GIF-010).
 * Contract: GIF = IMAGE + image/gif MediaAsset. No CONTENT_TYPES GIF.
 * Run: npm run test:gif-3c
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { and, eq } from "drizzle-orm";

config({ path: ".env.local" });
config({ path: ".env" });

/** Minimal GIF89a — sniffMime matches GIF magic. */
const GIF = Buffer.from("GIF89a\x01\x00\x01\x00\x00\x00\x00", "binary");
const GIF_B = Buffer.from("GIF89a\x02\x00\x01\x00\x00\x00\x00", "binary");
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const MP4 = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00,
  0x00, 0x00, 0x00, 0x69, 0x73, 0x6f, 0x6d,
]);

async function main() {
  const { db, schema } = await import("../src/db");
  const { createTenant } = await import("../src/services/tenants");
  const { createMembership } = await import("../src/services/memberships");
  const { hashPassword } = await import("../src/lib/auth");
  const { CONTENT_TYPES } = await import("../src/domain/types");
  const { sniffMime } = await import("../src/services/media/paths");
  const {
    isGifMime,
    isImageMime,
    filterMediaAssets,
  } = await import("../src/features/media/media-library-filters");
  const { isGifMime: isGifSupport, GIF_SLIDE_HINT_PT } = await import(
    "../src/features/contents/gif-support"
  );
  const {
    uploadMediaAsset,
    createContent,
    getContent,
    getContentWithPrimaryMedia,
    getContentForPreview,
    listContentsWithUsage,
    assertContentDuration,
    assertMediaCompatibleWithType,
  } = await import("../src/services/contents");
  const { createPlaylist, addPlaylistItem } = await import(
    "../src/services/playlists"
  );
  const { buildDeviceManifest } = await import("../src/services/manifest");

  const stamp = Date.now().toString(36);
  console.log("Phase 3C-B GIF support", stamp);

  // GIF-010 contract freeze
  console.log("GIF-010 no CONTENT_TYPES GIF");
  assert.equal(
    (CONTENT_TYPES as readonly string[]).includes("GIF"),
    false,
    "CONTENT_TYPES must not include GIF",
  );
  assert.ok(CONTENT_TYPES.includes("IMAGE"));
  assert.ok(GIF_SLIDE_HINT_PT.length > 20);
  assert.equal(isGifSupport("image/gif"), true);

  // GIF-001 sniff
  console.log("GIF-001 sniffMime image/gif");
  assert.equal(sniffMime(GIF), "image/gif");
  assert.equal(sniffMime(GIF), "image/gif");

  // GIF-002 Media Library filter
  console.log("GIF-002 Media Library gif filter");
  assert.equal(isGifMime("image/gif"), true);
  assert.equal(isImageMime("image/gif"), false);
  assert.equal(isImageMime("image/png"), true);
  const sample = [
    {
      id: "1",
      fileName: "a.gif",
      mimeType: "image/gif",
      fileSize: 10,
      createdAt: "2026-01-01",
    },
    {
      id: "2",
      fileName: "b.png",
      mimeType: "image/png",
      fileSize: 10,
      createdAt: "2026-01-01",
    },
  ];
  assert.equal(filterMediaAssets(sample, { typeFilter: "gif" }).length, 1);
  assert.equal(
    filterMediaAssets(sample, { typeFilter: "image" })[0]?.mimeType,
    "image/png",
  );

  const tenantA = await createTenant({
    name: `G3C A ${stamp}`,
    slug: `g3c-a-${stamp}`,
  });
  const tenantB = await createTenant({
    name: `G3C B ${stamp}`,
    slug: `g3c-b-${stamp}`,
  });
  const passwordHash = await hashPassword("Phase3Cgif!");
  const editorA = crypto.randomUUID();
  await db.insert(schema.users).values({
    id: editorA,
    email: `g3c-ed-${stamp}@example.com`,
    name: "G3C Editor",
    passwordHash,
    role: "EDITOR",
    tenantId: tenantA,
  });
  await createMembership({
    userId: editorA,
    tenantId: tenantA,
    role: "EDITOR",
    status: "ACTIVE",
  });

  // GIF-001 upload
  console.log("GIF-001 upload MediaAsset");
  const gifAsset = await uploadMediaAsset({
    fileName: `loop-${stamp}.gif`,
    mimeType: "image/gif",
    data: GIF,
    tenantId: tenantA,
    userId: editorA,
  });
  assert.equal(gifAsset.mimeType, "image/gif");

  const vidAsset = await uploadMediaAsset({
    fileName: `vid-${stamp}.mp4`,
    mimeType: "video/mp4",
    data: MP4,
    tenantId: tenantA,
    userId: editorA,
  });

  const gifB = await uploadMediaAsset({
    fileName: `loop-b-${stamp}.gif`,
    mimeType: "image/gif",
    data: GIF_B,
    tenantId: tenantB,
    userId: editorA,
  });

  // GIF-003 create IMAGE + gif
  console.log("GIF-003 create IMAGE + gif");
  assertMediaCompatibleWithType("IMAGE", "image/gif");
  const gifContentId = await createContent(
    {
      type: "IMAGE",
      title: `GIF slide ${stamp}`,
      durationMs: 8000,
      payload: {},
      status: "ACTIVE",
      mediaAssetId: gifAsset.id,
    },
    tenantA,
    editorA,
  );
  const withMedia = await getContentWithPrimaryMedia(gifContentId, tenantA);
  assert.equal(withMedia?.type, "IMAGE");
  assert.equal(withMedia?.media?.mimeType, "image/gif");
  assert.equal(withMedia?.durationMs, 8000);

  const listed = await listContentsWithUsage(tenantA);
  const listedGif = listed.find((c) => c.id === gifContentId);
  assert.equal(listedGif?.primaryMimeType, "image/gif");

  // GIF-004 reject VIDEO + gif
  console.log("GIF-004 reject VIDEO + gif");
  assert.throws(() => assertMediaCompatibleWithType("VIDEO", "image/gif"));
  await assert.rejects(
    () =>
      createContent(
        {
          type: "VIDEO",
          title: `bad gif video ${stamp}`,
          durationMs: 0,
          payload: {},
          status: "ACTIVE",
          mediaAssetId: gifAsset.id,
        },
        tenantA,
        editorA,
      ),
    /not allowed for VIDEO|image\//i,
  );

  // GIF-005 duration > 0
  console.log("GIF-005 IMAGE gif duration > 0");
  assert.throws(() => assertContentDuration("IMAGE", 0), /greater than 0/);
  await assert.rejects(
    () =>
      createContent(
        {
          type: "IMAGE",
          title: `gif zero ${stamp}`,
          durationMs: 0,
          payload: {},
          status: "ACTIVE",
          mediaAssetId: gifAsset.id,
        },
        tenantA,
        editorA,
      ),
    /greater than 0|duration/i,
  );

  // GIF-006 Preview
  console.log("GIF-006 Content Preview");
  const preview = await getContentForPreview(gifContentId, tenantA);
  assert.ok(preview);
  assert.equal(preview!.type, "IMAGE");
  assert.equal(preview!.mimeType, "image/gif");
  assert.ok(preview!.mediaUrl);
  assert.equal(preview!.durationMs, 8000);

  // GIF-007 Manifest type IMAGE + asset mime
  console.log("GIF-007 Manifest");
  const playlistId = await createPlaylist(
    {
      name: `GIF PL ${stamp}`,
    },
    tenantA,
    editorA,
  );
  const itemId = await addPlaylistItem({
    playlistId,
    contentId: gifContentId,
    tenantId: tenantA,
    userId: editorA,
    transition: "cut",
  });
  const deviceId = crypto.randomUUID();
  await db.insert(schema.devices).values({
    id: deviceId,
    deviceCode: `TV-G3C-${stamp}`,
    name: "G3C Device",
    status: "ACTIVE",
    tenantId: tenantA,
    currentPlaylistId: playlistId,
    manifestVersion: 1,
  });
  const [device] = await db
    .select()
    .from(schema.devices)
    .where(eq(schema.devices.id, deviceId))
    .limit(1);
  const manifest = await buildDeviceManifest(device!);
  assert.ok(manifest.playlist);
  const mItem = manifest.playlist!.items.find(
    (i) => i.playlistItemId === itemId,
  );
  assert.ok(mItem);
  assert.equal(mItem!.type, "IMAGE");
  assert.ok(mItem!.assets.some((a) => a.mimeType === "image/gif"));
  assert.equal(mItem!.durationMs, 8000);

  // GIF-008 cross-tenant attach rejected
  console.log("GIF-008 cross-tenant reject");
  await assert.rejects(
    () =>
      createContent(
        {
          type: "IMAGE",
          title: `cross ${stamp}`,
          durationMs: 5000,
          payload: {},
          status: "ACTIVE",
          mediaAssetId: gifB.id,
        },
        tenantA,
        editorA,
      ),
    /not found|Media asset/i,
  );
  assert.equal(await getContent(gifContentId, tenantB), null);

  // GIF-009 dedupe
  console.log("GIF-009 dedupe same gif bytes");
  const again = await uploadMediaAsset({
    fileName: `loop-again-${stamp}.gif`,
    mimeType: "image/gif",
    data: GIF,
    tenantId: tenantA,
    userId: editorA,
  });
  assert.equal(again.id, gifAsset.id);

  // Still IMAGE path in Preview / Studio sources (no Player GIF type)
  console.log("GIF contract sources");
  const typesSrc = fs.readFileSync(
    path.join(process.cwd(), "src/domain/types.ts"),
    "utf8",
  );
  assert.equal(/\b"GIF"\b/.test(typesSrc), false);
  const pngStill = await uploadMediaAsset({
    fileName: `still-${stamp}.png`,
    mimeType: "image/png",
    data: PNG,
    tenantId: tenantA,
  });
  assert.equal(pngStill.mimeType, "image/png");
  void vidAsset;

  // Cleanup tenants (cascade-ish best effort)
  await db.delete(schema.tenants).where(eq(schema.tenants.id, tenantA));
  await db.delete(schema.tenants).where(eq(schema.tenants.id, tenantB));
  // orphan users if FK soft
  await db
    .delete(schema.users)
    .where(and(eq(schema.users.id, editorA)))
    .catch(() => undefined);

  console.log("PASS Phase 3C-B GIF support");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

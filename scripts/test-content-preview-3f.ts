/**
 * Phase 3F — Content Preview (PREVIEW-001 … PREVIEW-020).
 * Run: npm run test:preview-3f
 */
import assert from "node:assert/strict";
import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });
config({ path: ".env" });

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const MP4 = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00,
  0x00, 0x00, 0x00, 0x69, 0x73, 0x6f, 0x6d,
]);

function assertNoForbiddenImports(fileRel: string, forbidden: string[]) {
  const abs = path.join(process.cwd(), fileRel);
  const src = fs.readFileSync(abs, "utf8");
  for (const needle of forbidden) {
    assert.equal(
      src.includes(needle),
      false,
      `${fileRel} must not contain "${needle}"`,
    );
  }
}

async function main() {
  const { db, schema } = await import("../src/db");
  const { createTenant } = await import("../src/services/tenants");
  const { createMembership } = await import("../src/services/memberships");
  const { hashPassword } = await import("../src/lib/auth");
  const {
    uploadMediaAsset,
    createContent,
    getContentForPreview,
    isContentOutsideValidityWindow,
  } = await import("../src/services/contents");

  const stamp = Date.now().toString(36);
  console.log("Phase 3F content preview", stamp);

  const tenantA = await createTenant({
    name: `P3F A ${stamp}`,
    slug: `p3f-a-${stamp}`,
  });
  const tenantB = await createTenant({
    name: `P3F B ${stamp}`,
    slug: `p3f-b-${stamp}`,
  });
  const passwordHash = await hashPassword("Phase3Fpreview!");

  const editorA = crypto.randomUUID();
  await db.insert(schema.users).values({
    id: editorA,
    email: `p3f-ed-${stamp}@example.com`,
    name: "P3F Editor",
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

  const img = await uploadMediaAsset({
    fileName: "p3f.png",
    mimeType: "image/png",
    data: PNG,
    tenantId: tenantA,
    userId: editorA,
  });
  const vid = await uploadMediaAsset({
    fileName: "p3f.mp4",
    mimeType: "video/mp4",
    data: MP4,
    tenantId: tenantA,
    userId: editorA,
  });
  const imgB = await uploadMediaAsset({
    fileName: "p3f-b.png",
    mimeType: "image/png",
    data: PNG,
    tenantId: tenantB,
    userId: editorA,
  });

  // PREVIEW-001 IMAGE
  console.log("PREVIEW-001 IMAGE");
  const imageId = await createContent(
    {
      type: "IMAGE",
      title: "P3F Image",
      durationMs: 5000,
      status: "ACTIVE",
      payload: {},
      mediaAssetId: img.id,
    },
    tenantA,
    editorA,
  );
  const imagePrev = await getContentForPreview(imageId, tenantA);
  assert.ok(imagePrev);
  assert.equal(imagePrev!.type, "IMAGE");
  assert.ok(imagePrev!.mediaUrl);
  assert.equal(imagePrev!.mimeType?.startsWith("image/"), true);
  assert.equal(imagePrev!.status, "ACTIVE");

  // PREVIEW-002 / 003 VIDEO
  console.log("PREVIEW-002/003 VIDEO");
  const videoId = await createContent(
    {
      type: "VIDEO",
      title: "P3F Video natural",
      durationMs: 0,
      status: "ACTIVE",
      payload: {},
      mediaAssetId: vid.id,
    },
    tenantA,
    editorA,
  );
  const videoPrev = await getContentForPreview(videoId, tenantA);
  assert.ok(videoPrev);
  assert.equal(videoPrev!.type, "VIDEO");
  assert.equal(videoPrev!.durationMs, 0);
  assert.ok(videoPrev!.mediaUrl);
  assert.equal(videoPrev!.mimeType?.startsWith("video/"), true);

  // PREVIEW-004 TEXT
  console.log("PREVIEW-004 TEXT");
  const textId = await createContent(
    {
      type: "TEXT",
      title: "P3F Text",
      durationMs: 3000,
      status: "ACTIVE",
      payload: { body: "Hello body", align: "left", fontSize: "large" },
    },
    tenantA,
    editorA,
  );
  const textPrev = await getContentForPreview(textId, tenantA);
  assert.equal(textPrev!.payload.body, "Hello body");
  assert.equal(textPrev!.payload.align, "left");
  assert.equal(textPrev!.mediaUrl, null);

  // PREVIEW-005 NOTICE
  console.log("PREVIEW-005 NOTICE");
  const noticeId = await createContent(
    {
      type: "NOTICE",
      title: "P3F Notice",
      durationMs: 4000,
      status: "ACTIVE",
      payload: { message: "Attenção" },
    },
    tenantA,
    editorA,
  );
  assert.equal(
    (await getContentForPreview(noticeId, tenantA))!.payload.message,
    "Attenção",
  );

  // PREVIEW-006 EVENT
  console.log("PREVIEW-006 EVENT");
  const eventId = await createContent(
    {
      type: "EVENT",
      title: "P3F Event",
      durationMs: 5000,
      status: "ACTIVE",
      payload: {
        description: "Desc",
        date: "2026-10-01",
        time: "18:00",
        location: "Maputo",
      },
    },
    tenantA,
    editorA,
  );
  const eventPrev = await getContentForPreview(eventId, tenantA);
  assert.equal(eventPrev!.payload.location, "Maputo");
  assert.equal(eventPrev!.payload.date, "2026-10-01");

  // PREVIEW-007 NEWS
  console.log("PREVIEW-007 NEWS");
  const newsId = await createContent(
    {
      type: "NEWS",
      title: "P3F News",
      durationMs: 5000,
      status: "ACTIVE",
      payload: { body: "Headline", source: "Wire" },
    },
    tenantA,
    editorA,
  );
  const newsPrev = await getContentForPreview(newsId, tenantA);
  assert.equal(newsPrev!.payload.source, "Wire");

  // PREVIEW-008 QR stub data
  console.log("PREVIEW-008 QR");
  const qrId = await createContent(
    {
      type: "QR_CODE",
      title: "P3F QR",
      durationMs: 5000,
      status: "ACTIVE",
      payload: { url: "https://example.com/x", label: "Open", size: "md" },
    },
    tenantA,
    editorA,
  );
  const qrPrev = await getContentForPreview(qrId, tenantA);
  assert.equal(qrPrev!.payload.url, "https://example.com/x");
  assert.equal(qrPrev!.type, "QR_CODE");

  // PREVIEW-009 CLOCK
  console.log("PREVIEW-009 CLOCK");
  const clockId = await createContent(
    {
      type: "CLOCK",
      title: "P3F Clock",
      durationMs: 60000,
      status: "ACTIVE",
      payload: { showDate: true, showTime: true, format: "24h" },
    },
    tenantA,
    editorA,
  );
  const clockPrev = await getContentForPreview(clockId, tenantA);
  assert.equal(clockPrev!.payload.format, "24h");
  assert.equal(clockPrev!.payload.showDate, true);

  // PREVIEW-010 foreign Content
  console.log("PREVIEW-010/011 cross-tenant");
  const foreign = await getContentForPreview(imageId, tenantB);
  assert.equal(foreign, null);
  const foreignOwn = await getContentForPreview(imageId, tenantA);
  assert.ok(foreignOwn);
  // Foreign media cannot be attached via create — covered by 3B; preview of A never returns B url
  assert.notEqual(foreignOwn!.mediaUrl, null);
  const bOnly = await createContent(
    {
      type: "IMAGE",
      title: "B only",
      durationMs: 3000,
      status: "ACTIVE",
      payload: {},
      mediaAssetId: imgB.id,
    },
    tenantB,
  );
  assert.equal(await getContentForPreview(bOnly, tenantA), null);

  // PREVIEW-012 INACTIVE
  console.log("PREVIEW-012 INACTIVE");
  const inactiveId = await createContent(
    {
      type: "TEXT",
      title: "Inactive",
      durationMs: 2000,
      status: "INACTIVE",
      payload: { body: "x", align: "center", fontSize: "large" },
    },
    tenantA,
    editorA,
  );
  const inactivePrev = await getContentForPreview(inactiveId, tenantA);
  assert.equal(inactivePrev!.status, "INACTIVE");

  // PREVIEW-013 validity helper
  console.log("PREVIEW-013 validity");
  const now = new Date("2026-06-15T12:00:00.000Z");
  assert.equal(
    isContentOutsideValidityWindow("2026-07-01T00:00:00.000Z", null, now),
    true,
  );
  assert.equal(
    isContentOutsideValidityWindow(null, "2026-06-01T00:00:00.000Z", now),
    true,
  );
  assert.equal(
    isContentOutsideValidityWindow(
      "2026-01-01T00:00:00.000Z",
      "2026-12-31T00:00:00.000Z",
      now,
    ),
    false,
  );

  // PREVIEW-014/015 lifecycle — structural: VideoVisual has cleanup effect (static)
  console.log("PREVIEW-014/015 lifecycle source");
  const visualSrc = fs.readFileSync(
    path.join(process.cwd(), "src/features/contents/content-visual.tsx"),
    "utf8",
  );
  assert.match(visualSrc, /el\.pause\(\)/);
  assert.match(visualSrc, /removeAttribute\("src"\)/);
  assert.equal(visualSrc.includes("createObjectURL"), false);
  assert.equal(visualSrc.includes("dangerouslySetInnerHTML"), false);

  // PREVIEW-016..020 import isolation
  console.log("PREVIEW-016..020 isolation");
  const forbidden = [
    "player-app",
    "display-engine",
    "indexed-db",
    "@/player/",
    "playback-resolver",
    "/api/device/media",
    "buildDeviceManifest",
    "createObjectUrl",
  ];
  for (const file of [
    "src/features/contents/content-visual.tsx",
    "src/features/contents/preview-host.tsx",
    "src/features/contents/content-preview-types.ts",
  ]) {
    assertNoForbiddenImports(file, forbidden);
  }
  // Preview modules must not import playlist/schedule services
  assertNoForbiddenImports("src/features/contents/content-visual.tsx", [
    "@/services/playlists",
    "@/services/schedules",
    "@/services/manifest",
  ]);
  assertNoForbiddenImports("src/features/contents/preview-host.tsx", [
    "@/services/playlists",
    "@/services/schedules",
    "@/services/manifest",
  ]);

  // Studio page loads preview helper
  const pageSrc = fs.readFileSync(
    path.join(process.cwd(), "src/app/admin/contents/[id]/page.tsx"),
    "utf8",
  );
  assert.match(pageSrc, /getContentForPreview/);
  assert.match(pageSrc, /PreviewHost/);
  assert.equal(pageSrc.includes("display-engine"), false);

  // QR stub copy present
  assert.match(visualSrc, /QR visual ainda não disponível/);

  // Cleanup tenants (best-effort)
  await db.delete(schema.tenants).where(eq(schema.tenants.id, tenantA));
  await db.delete(schema.tenants).where(eq(schema.tenants.id, tenantB));

  console.log("PASS Phase 3F content preview");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Phase 3B — Content Studio (CONTENT-001 … CONTENT-027).
 * Run: npm run test:content-3b
 */
import assert from "node:assert/strict";
import { config } from "dotenv";
import { and, eq } from "drizzle-orm";

config({ path: ".env.local" });
config({ path: ".env" });

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const PNG_B = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
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
  const { hasPermission } = await import("../src/domain/types");
  const {
    uploadMediaAsset,
    createContent,
    updateContent,
    deleteContent,
    duplicateContent,
    getContent,
    getContentWithPrimaryMedia,
    listContents,
    listMediaAssets,
    assertContentDuration,
    assertMediaCompatibleWithType,
    createContentSchema,
  } = await import("../src/services/contents");
  const { createPlaylist, addPlaylistItem, getPlaylistWithItems } =
    await import("../src/services/playlists");
  const { createSchedule } = await import("../src/services/schedules");
  const { handleApiError } = await import("../src/lib/api");

  const stamp = Date.now().toString(36);
  console.log("Phase 3B content studio", stamp);

  const tenantA = await createTenant({
    name: `C3B A ${stamp}`,
    slug: `c3b-a-${stamp}`,
  });
  const tenantB = await createTenant({
    name: `C3B B ${stamp}`,
    slug: `c3b-b-${stamp}`,
  });
  const passwordHash = await hashPassword("Phase3Bcontent!");

  async function makeUser(
    email: string,
    home: string,
    role: "ADMIN" | "EDITOR" | "VIEWER" | "OPERATOR",
  ) {
    const id = crypto.randomUUID();
    await db.insert(schema.users).values({
      id,
      email,
      name: email.split("@")[0],
      passwordHash,
      role,
      tenantId: home,
    });
    await createMembership({ userId: id, tenantId: home, role, status: "ACTIVE" });
    return id;
  }

  const adminA = await makeUser(`admin-a-${stamp}@ex.com`, tenantA, "ADMIN");
  const editorA = await makeUser(`editor-a-${stamp}@ex.com`, tenantA, "EDITOR");
  const viewerA = await makeUser(`viewer-a-${stamp}@ex.com`, tenantA, "VIEWER");
  void (await makeUser(`op-a-${stamp}@ex.com`, tenantA, "OPERATOR"));

  // Helpers / duration
  console.log("CONTENT-003/004/005 duration helpers");
  assertContentDuration("VIDEO", 0);
  assertContentDuration("VIDEO", 5000);
  assert.throws(() => assertContentDuration("IMAGE", 0), /greater than 0/);
  assert.throws(() => assertMediaCompatibleWithType("IMAGE", "video/mp4"));
  assert.throws(() => assertMediaCompatibleWithType("VIDEO", "image/png"));
  assert.throws(
    () => createContentSchema.parse({ type: "IMAGE", title: "x", durationMs: 0 }),
  );

  const imgA = await uploadMediaAsset({
    fileName: `img-${stamp}.png`,
    mimeType: "image/png",
    data: PNG,
    tenantId: tenantA,
    userId: adminA,
  });
  const vidA = await uploadMediaAsset({
    fileName: `vid-${stamp}.mp4`,
    mimeType: "video/mp4",
    data: MP4,
    tenantId: tenantA,
    userId: adminA,
  });
  const imgB = await uploadMediaAsset({
    fileName: `img-b-${stamp}.png`,
    mimeType: "image/png",
    data: PNG_B,
    tenantId: tenantB,
  });

  // CONTENT-001
  console.log("CONTENT-001 Create IMAGE");
  const imageId = await createContent(
    {
      type: "IMAGE",
      title: `Image ${stamp}`,
      durationMs: 8000,
      payload: {},
      status: "ACTIVE",
      mediaAssetId: imgA.id,
    },
    tenantA,
    editorA,
  );
  assert.ok(imageId);

  // CONTENT-002 / 003
  console.log("CONTENT-002/003 Create VIDEO duration 0");
  const videoNaturalId = await createContent(
    {
      type: "VIDEO",
      title: `Video natural ${stamp}`,
      durationMs: 0,
      payload: {},
      status: "ACTIVE",
      mediaAssetId: vidA.id,
    },
    tenantA,
    editorA,
  );
  const videoNatural = await getContent(videoNaturalId, tenantA);
  assert.equal(videoNatural?.durationMs, 0);

  // CONTENT-004
  console.log("CONTENT-004 VIDEO duration > 0");
  const videoFixedId = await createContent(
    {
      type: "VIDEO",
      title: `Video fixed ${stamp}`,
      durationMs: 12000,
      payload: {},
      status: "ACTIVE",
      mediaAssetId: vidA.id,
    },
    tenantA,
    editorA,
  );
  assert.equal((await getContent(videoFixedId, tenantA))?.durationMs, 12000);

  // CONTENT-006 / 007 edit + reattach
  console.log("CONTENT-006/007 Edit + reattach");
  const imgA2 = await uploadMediaAsset({
    fileName: `img2-${stamp}.png`,
    mimeType: "image/png",
    data: Buffer.concat([PNG, Buffer.from([1, 2, 3, stamp.charCodeAt(0)])]),
    // may fail sniff - use different valid png
    tenantId: tenantA,
  }).catch(() => null);

  // Use PNG_B uploaded to tenant A
  const imgAlt = await uploadMediaAsset({
    fileName: `img-alt-${stamp}.png`,
    mimeType: "image/png",
    data: PNG_B,
    tenantId: tenantA,
  });

  await updateContent(
    imageId,
    { title: `Image edited ${stamp}`, mediaAssetId: imgAlt.id },
    tenantA,
    editorA,
  );
  const edited = await getContentWithPrimaryMedia(imageId, tenantA);
  assert.equal(edited?.title, `Image edited ${stamp}`);
  assert.equal(edited?.media?.id, imgAlt.id);
  // Old media still exists
  assert.ok(await listMediaAssets(tenantA).then((xs) => xs.some((x) => x.id === imgA.id)));

  // CONTENT-008 foreign media
  console.log("CONTENT-008/009/022/023 cross-tenant");
  await assert.rejects(
    () =>
      updateContent(
        imageId,
        { mediaAssetId: imgB.id },
        tenantA,
        adminA,
      ),
    /not found/i,
  );
  assert.equal(await getContent(imageId, tenantB), null);
  await assert.rejects(
    () => updateContent(imageId, { title: "hack" }, tenantB, adminA),
    /not found/i,
  );
  await assert.rejects(
    () =>
      createContent(
        {
          type: "IMAGE",
          title: "idor",
          durationMs: 5000,
          payload: {},
          status: "ACTIVE",
          mediaAssetId: imgB.id,
        },
        tenantA,
        adminA,
      ),
    /not found/i,
  );

  // CONTENT-010..014 duplicate
  console.log("CONTENT-010..014 Duplicate");
  const dupId = await duplicateContent(imageId, tenantA, editorA);
  assert.notEqual(dupId, imageId);
  const dup = await getContentWithPrimaryMedia(dupId, tenantA);
  assert.ok(dup?.title.includes("Cópia"));
  assert.equal(dup?.media?.id, imgAlt.id);
  assert.equal(dup?.type, "IMAGE");

  const pl = await createPlaylist({ name: `pl-${stamp}` }, tenantA, adminA);
  await addPlaylistItem({
    playlistId: pl,
    contentId: imageId,
    tenantId: tenantA,
  });
  const fullPl = await getPlaylistWithItems(pl, tenantA);
  assert.ok(fullPl?.items.every((i) => i.contentId === imageId));
  assert.equal(
    fullPl?.items.some((i) => i.contentId === dupId),
    false,
  );

  const beforeSchedules = await db
    .select()
    .from(schema.schedules)
    .where(eq(schema.schedules.tenantId, tenantA));
  const schedulesAfterDup = await db
    .select()
    .from(schema.schedules)
    .where(eq(schema.schedules.contentId, dupId));
  assert.equal(schedulesAfterDup.length, 0);
  void beforeSchedules;

  // CONTENT-016 playlist delete blocked
  console.log("CONTENT-016/017 Delete safety");
  await assert.rejects(() => deleteContent(imageId, tenantA, adminA), /associado|eliminado/);

  const orphanText = await createContent(
    {
      type: "TEXT",
      title: `orphan text ${stamp}`,
      durationMs: 4000,
      payload: { body: "x" },
      status: "ACTIVE",
    },
    tenantA,
    editorA,
  );
  await createSchedule(
    {
      name: `sched-${stamp}`,
      contentId: orphanText,
      daysOfWeek: [1],
      priority: "NORMAL",
      active: true,
      targets: [{ targetType: "ALL", targetId: null }],
    },
    tenantA,
    adminA,
  );
  await assert.rejects(() => deleteContent(orphanText, tenantA, adminA), /associado|eliminado/);

  // CONTENT-015 delete unused
  console.log("CONTENT-015 Delete unused");
  const unused = await createContent(
    {
      type: "TEXT",
      title: `unused ${stamp}`,
      durationMs: 3000,
      payload: { body: "bye" },
      status: "INACTIVE",
    },
    tenantA,
    editorA,
  );
  await deleteContent(unused, tenantA, editorA);
  assert.equal(await getContent(unused, tenantA), null);
  // media assets untouched
  assert.ok((await listMediaAssets(tenantA)).some((a) => a.id === imgAlt.id));

  // CONTENT-017 already covered by schedule reject above

  // CONTENT-018..021 RBAC matrix (permission + API gate pattern)
  console.log("CONTENT-018..021 RBAC");
  assert.equal(hasPermission("VIEWER", "manage_contents"), false);
  assert.equal(hasPermission("OPERATOR", "manage_contents"), false);
  assert.equal(hasPermission("EDITOR", "manage_contents"), true);
  assert.equal(hasPermission("ADMIN", "manage_contents"), true);
  void viewerA;

  // CONTENT-024 activity
  console.log("CONTENT-024 Activity");
  const [dupLog] = await db
    .select()
    .from(schema.activityLogs)
    .where(
      and(
        eq(schema.activityLogs.tenantId, tenantA),
        eq(schema.activityLogs.action, "CONTENT_DUPLICATED"),
        eq(schema.activityLogs.resourceId, dupId),
      ),
    )
    .limit(1);
  assert.ok(dupLog);

  // CONTENT-025 transaction: failed create leaves no row
  console.log("CONTENT-025 Transaction rollback (failed attach)");
  const beforeCount = (await listContents(tenantA)).length;
  await assert.rejects(
    () =>
      createContent(
        {
          type: "IMAGE",
          title: `fail-${stamp}`,
          durationMs: 5000,
          payload: {},
          status: "ACTIVE",
          mediaAssetId: crypto.randomUUID(),
        },
        tenantA,
        adminA,
      ),
    /not found/i,
  );
  assert.equal((await listContents(tenantA)).length, beforeCount);

  // CONTENT-026/027 pickers use tenant lists
  console.log("CONTENT-026/027 Picker isolation");
  const listA = await listContents(tenantA);
  const listB = await listContents(tenantB);
  assert.ok(!listA.some((c) => listB.some((b) => b.id === c.id)));
  const mediaA = await listMediaAssets(tenantA);
  assert.ok(!mediaA.some((m) => m.id === imgB.id));

  // API 409 mapping
  const conflict = handleApiError(
    new Error(
      "Este conteúdo está associado a uma ou mais playlists ou agendamentos e não pode ser eliminado.",
    ),
  );
  assert.equal(conflict.status, 409);

  // MIME mismatch on create
  await assert.rejects(
    () =>
      createContent(
        {
          type: "VIDEO",
          title: "bad mime",
          durationMs: 0,
          payload: {},
          status: "ACTIVE",
          mediaAssetId: imgA.id,
        },
        tenantA,
        adminA,
      ),
    /not allowed|video/i,
  );

  void imgA2;
  console.log("PASS Phase 3B content studio");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

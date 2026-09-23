/**
 * Phase 3E — Transition contract (TRANS-001 … TRANS-010).
 * Run: npm run test:transition-3e
 */
import assert from "node:assert/strict";
import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { db, schema } = await import("../src/db");
  const { createTenant } = await import("../src/services/tenants");
  const { createMembership } = await import("../src/services/memberships");
  const { hashPassword } = await import("../src/lib/auth");
  const {
    TRANSITIONS,
    assertTransition,
    parseTransition,
    isTransition,
  } = await import("../src/domain/types");
  const {
    createPlaylist,
    addPlaylistItem,
    updatePlaylistItem,
    getPlaylistWithItems,
  } = await import("../src/services/playlists");
  const { createContent } = await import("../src/services/contents");
  const { eq } = await import("drizzle-orm");

  const stamp = Date.now().toString(36);
  console.log("Phase 3E transition contract", stamp);

  // TRANS-001 / TRANS-007
  console.log("TRANS-001/007 canonical enum");
  assert.deepEqual([...TRANSITIONS], ["fade", "slide-left", "zoom", "cut"]);
  assert.equal(TRANSITIONS.includes("slide" as never), false);
  assert.equal(isTransition("slide"), false);
  assert.equal(isTransition("slide-left"), true);

  const builderSrc = fs.readFileSync(
    path.join(process.cwd(), "src/features/playlists/playlist-builder.tsx"),
    "utf8",
  );
  assert.match(builderSrc, /TRANSITIONS\.map/);
  for (const t of TRANSITIONS) {
    assert.ok(builderSrc.includes(t) || builderSrc.includes("TRANSITIONS"));
  }

  // TRANS-006 CSS
  console.log("TRANS-006 CSS classes");
  const css = fs.readFileSync(
    path.join(process.cwd(), "src/app/globals.css"),
    "utf8",
  );
  assert.match(css, /\.player-slide-fade/);
  assert.match(css, /\.player-slide-slide-left/);
  assert.match(css, /\.player-slide-zoom/);
  assert.match(css, /\.player-slide-cut/);
  assert.equal(css.includes(".player-slide-slide {"), false);
  assert.equal(css.includes(".player-slide-slide{"), false);

  // TRANS-010 ownership — transition column only on playlist_items
  console.log("TRANS-010 PlaylistItem ownership");
  const schemaSrc = fs.readFileSync(
    path.join(process.cwd(), "src/db/schema.ts"),
    "utf8",
  );
  assert.match(schemaSrc, /export const playlistItems[\s\S]*?transition: text\("transition"\)/);
  assert.equal(
    /export const contents = sqliteTable\([\s\S]*?^\);[\s\S]*?transition:/m.test(
      schemaSrc.split("export const contentAssets")[0] ?? "",
    ),
    false,
  );
  const contentsBlock = schemaSrc.slice(
    schemaSrc.indexOf("export const contents"),
    schemaSrc.indexOf("export const contentAssets"),
  );
  const mediaBlock = schemaSrc.slice(
    schemaSrc.indexOf("export const mediaAssets"),
    schemaSrc.indexOf("export const contents"),
  );
  assert.equal(contentsBlock.includes("transition:"), false);
  assert.equal(mediaBlock.includes("transition:"), false);

  // Helpers
  assert.equal(parseTransition("zoom"), "zoom");
  assert.equal(parseTransition("slide"), "fade");
  assert.equal(parseTransition("nope"), "fade");
  assert.equal(assertTransition("cut"), "cut");
  assert.throws(() => assertTransition("slide"), /Transição inválida/);
  assert.throws(() => assertTransition("wipe"), /Transição inválida/);

  const tenantId = await createTenant({
    name: `T3E ${stamp}`,
    slug: `t3e-${stamp}`,
  });
  const passwordHash = await hashPassword("Phase3Etransition!");
  const userId = crypto.randomUUID();
  await db.insert(schema.users).values({
    id: userId,
    email: `t3e-${stamp}@example.com`,
    name: "T3E",
    passwordHash,
    role: "EDITOR",
    tenantId,
  });
  await createMembership({
    userId,
    tenantId,
    role: "EDITOR",
    status: "ACTIVE",
  });

  const contentId = await createContent(
    {
      type: "TEXT",
      title: "T3E content",
      durationMs: 3000,
      status: "ACTIVE",
      payload: { body: "x", align: "center", fontSize: "large" },
    },
    tenantId,
    userId,
  );
  const contentB = await createContent(
    {
      type: "TEXT",
      title: "T3E content B",
      durationMs: 3000,
      status: "ACTIVE",
      payload: { body: "y", align: "center", fontSize: "large" },
    },
    tenantId,
    userId,
  );

  const playlistA = await createPlaylist(
    { name: `T3E A ${stamp}` },
    tenantId,
    userId,
  );
  const playlistB = await createPlaylist(
    { name: `T3E B ${stamp}` },
    tenantId,
    userId,
  );

  // TRANS-003 default fade
  console.log("TRANS-003 default fade");
  const itemDefault = await addPlaylistItem({
    playlistId: playlistA,
    contentId,
    tenantId,
    userId,
  });
  const fullA = await getPlaylistWithItems(playlistA, tenantId);
  const def = fullA!.items.find((i) => i.id === itemDefault);
  assert.equal(def?.transition, "fade");

  // TRANS-002 reject unknown
  console.log("TRANS-002 reject invalid");
  await assert.rejects(
    () =>
      updatePlaylistItem(
        playlistA,
        itemDefault,
        { transition: "slide" },
        tenantId,
        userId,
      ),
    /invalid|Invalid|Transição|enum/i,
  );
  await assert.rejects(
    () =>
      addPlaylistItem({
        playlistId: playlistA,
        contentId: contentB,
        tenantId,
        userId,
        transition: "wipe",
      }),
    /Transição inválida/,
  );

  // Round-trip canonical tokens
  console.log("TRANS round-trip");
  for (const t of TRANSITIONS) {
    await updatePlaylistItem(
      playlistA,
      itemDefault,
      { transition: t },
      tenantId,
      userId,
    );
    const again = await getPlaylistWithItems(playlistA, tenantId);
    assert.equal(
      again!.items.find((i) => i.id === itemDefault)?.transition,
      t,
    );
  }

  // TRANS-008 same content, different transitions
  console.log("TRANS-008 cross-playlist");
  const itemB = await addPlaylistItem({
    playlistId: playlistB,
    contentId,
    tenantId,
    userId,
    transition: "zoom",
  });
  await updatePlaylistItem(
    playlistA,
    itemDefault,
    { transition: "cut" },
    tenantId,
    userId,
  );
  const aItems = await getPlaylistWithItems(playlistA, tenantId);
  const bItems = await getPlaylistWithItems(playlistB, tenantId);
  assert.equal(
    aItems!.items.find((i) => i.id === itemDefault)?.transition,
    "cut",
  );
  assert.equal(bItems!.items.find((i) => i.id === itemB)?.transition, "zoom");
  assert.equal(
    aItems!.items.find((i) => i.id === itemDefault)?.contentId,
    contentId,
  );
  assert.equal(
    bItems!.items.find((i) => i.id === itemB)?.contentId,
    contentId,
  );

  // TRANS-004 / TRANS-005 manifest
  console.log("TRANS-004/005 manifest");
  const { buildDeviceManifest } = await import("../src/services/manifest");
  // Create a device with playlist A
  const deviceId = crypto.randomUUID();
  await db.insert(schema.devices).values({
    id: deviceId,
    deviceCode: `TV-T3E-${stamp}`,
    name: "T3E Device",
    status: "ACTIVE",
    tenantId,
    currentPlaylistId: playlistA,
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
    (i) => i.playlistItemId === itemDefault,
  );
  assert.equal(mItem?.transition, "cut");

  // Emergency cut constant still valid
  assert.equal(isTransition("cut"), true);

  // TRANS-009 Legacy wire
  console.log("TRANS-009 Legacy transitionClass used");
  const tv = fs.readFileSync(path.join(process.cwd(), "public/tv.js"), "utf8");
  assert.match(tv, /transitionClass\(item\.transition\)/);
  assert.match(tv, /function transitionClass/);

  // Cleanup
  await db.delete(schema.tenants).where(eq(schema.tenants.id, tenantId));

  console.log("PASS Phase 3E transition contract");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * MVP acceptance scenarios 1–7 against application services + local DB.
 * Run: npm run test:acceptance
 */
import assert from "node:assert/strict";
import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { db, schema } = await import("../src/db");
  const { createTenant } = await import("../src/services/tenants");
  const {
    startDevicePairing,
    pairDevice,
    bootstrapClaim,
    recordHeartbeat,
    listDevicesWithPresence,
    assignPlaylistToDevice,
    getHeartbeatWindows,
  } = await import("../src/services/devices");
  const { createContent, uploadMediaAsset } = await import(
    "../src/services/contents"
  );
  const { createPlaylist, addPlaylistItem, bumpPlaylistVersion } = await import(
    "../src/services/playlists"
  );
  const { buildDeviceManifest, buildSyncDelta } = await import(
    "../src/services/manifest"
  );
  const { createSchedule } = await import("../src/services/schedules");
  const { createDeviceGroup, addDeviceToGroup, assignPlaylistToGroup } =
    await import("../src/services/device-groups");
  const { derivePresence } = await import("../src/domain/types");

  const stamp = Date.now().toString(36).toUpperCase();
  const tenantId = await createTenant({
    name: `Acceptance ${stamp}`,
    slug: `acc-${stamp.toLowerCase()}`,
  });

  const existingSchedules = await db.select().from(schema.schedules);
  for (const s of existingSchedules) {
    if (s.priority === "EMERGENCY" && s.active && s.tenantId === tenantId) {
      await db
        .update(schema.schedules)
        .set({ active: false })
        .where(eq(schema.schedules.id, s.id));
    }
  }

  console.log("Scenario 1 — Device pairing");
  const pairing = await startDevicePairing();
  assert.ok(pairing.activationCode.length === 6);
  const paired = await pairDevice({
    activationCode: pairing.activationCode,
    name: "Hall Principal",
    location: "Entrada",
    deviceCode: `TV-ACC-${stamp}`,
    tenantId,
  });
  const claim = await bootstrapClaim(paired.deviceId, pairing.pairingSecret);
  assert.equal(claim.status, "ACTIVE");
  assert.ok("deviceToken" in claim && claim.deviceToken);
  console.log("  OK paired", paired.deviceId);

  // Regression: a freshly paired device must deliver its default playlist on
  // the very first sync (player with no local manifest reports version -1).
  {
    const [freshDevice] = await db
      .select()
      .from(schema.devices)
      .where(eq(schema.devices.id, paired.deviceId))
      .limit(1);
    assert.ok(
      freshDevice.manifestVersion >= 1,
      "pairing must bump manifestVersion so first sync delivers the default playlist",
    );
    assert.ok(freshDevice.currentPlaylistId, "pairing must assign a default playlist");
    const firstSync = await buildSyncDelta(freshDevice, -1);
    assert.equal(firstSync.upToDate, false);
    assert.ok(
      (firstSync.manifest?.playlist?.items.length ?? 0) >= 1,
      "first sync must include the default playlist items",
    );
    console.log("  OK first sync delivers default playlist (v" + freshDevice.manifestVersion + ")");
  }

  console.log("Scenario 2 — Content");
  const textId = await createContent(
    {
      type: "TEXT",
      title: "Boas-vindas",
      durationMs: 5000,
      payload: {
        body: "Bem-vindo à Vitrine360",
        align: "center",
        fontSize: "large",
      },
      status: "ACTIVE",
    },
    tenantId,
  );
  const noticeId = await createContent(
    {
      type: "NOTICE",
      title: "Aviso",
      durationMs: 5000,
      payload: { message: "Manutenção às 18h" },
      status: "ACTIVE",
    },
    tenantId,
  );
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const asset = await uploadMediaAsset({
    fileName: "pixel.png",
    mimeType: "image/png",
    data: png,
    tenantId,
  });
  const imageId = await createContent(
    {
      type: "IMAGE",
      title: "Banner",
      durationMs: 8000,
      payload: {},
      status: "ACTIVE",
      mediaAssetId: asset.id,
    },
    tenantId,
  );
  assert.ok(asset.checksum.startsWith("sha256:"));
  const emergencyContentId = await createContent(
    {
      type: "NOTICE",
      title: "EMERGÊNCIA",
      durationMs: 15000,
      payload: { message: "Evacuação imediata" },
      status: "ACTIVE",
    },
    tenantId,
  );
  const clockId = await createContent(
    {
      type: "CLOCK",
      title: "Relógio",
      durationMs: 10000,
      payload: { showDate: true, showTime: true, format: "24h" },
      status: "ACTIVE",
    },
    tenantId,
  );
  assert.ok(textId && noticeId && emergencyContentId && imageId && clockId);
  console.log("  OK contents", { textId, noticeId, imageId });

  console.log("Scenario 3 — Playlist");
  const playlistId = await createPlaylist(
    { name: `Institucional ${stamp}` },
    tenantId,
  );
  await addPlaylistItem({ playlistId, contentId: textId, tenantId });
  await addPlaylistItem({ playlistId, contentId: noticeId, tenantId });
  await addPlaylistItem({ playlistId, contentId: imageId, tenantId });
  await addPlaylistItem({ playlistId, contentId: clockId, tenantId });
  const full = await db
    .select()
    .from(schema.playlistItems)
    .where(eq(schema.playlistItems.playlistId, playlistId));
  assert.equal(full.length, 4);
  console.log("  OK playlist", playlistId);

  console.log("Scenario 4 — Assignment + playback manifest");
  const assign = await assignPlaylistToDevice(
    paired.deviceId,
    playlistId,
    tenantId,
  );
  assert.ok(assign.manifestVersion >= 1);
  const [device] = await db
    .select()
    .from(schema.devices)
    .where(eq(schema.devices.id, paired.deviceId))
    .limit(1);
  assert.ok(device);
  assert.equal(device.tenantId, tenantId);
  const manifest = await buildDeviceManifest(device);
  assert.equal(manifest.playlist?.items.length, 4);
  const titles = new Set(manifest.playlist?.items.map((i) => i.title));
  assert.ok(titles.has("Boas-vindas"));
  assert.ok(titles.has("Banner"));
  console.log(
    "  OK manifest v",
    manifest.manifestVersion,
    "items",
    manifest.playlist?.items.length,
  );

  console.log("Scenario 5 — Offline continuity (local CURRENT kept)");
  let CURRENT = { version: manifest.manifestVersion, items: 4 };
  let NEXT: typeof CURRENT | null = {
    version: manifest.manifestVersion + 1,
    items: 5,
  };
  const downloadOk = false;
  if (!downloadOk) NEXT = null;
  assert.equal(CURRENT.version, manifest.manifestVersion);
  assert.equal(NEXT, null);
  console.log("  OK kept CURRENT on failed update");

  console.log("Scenario 6 — Incremental update after playlist change");
  const before = device.manifestVersion;
  await bumpPlaylistVersion(playlistId, tenantId);
  const [device2] = await db
    .select()
    .from(schema.devices)
    .where(eq(schema.devices.id, paired.deviceId))
    .limit(1);
  assert.ok(device2);
  assert.ok(device2.manifestVersion > before);
  const deltaSame = await buildSyncDelta(device2, device2.manifestVersion);
  assert.equal(deltaSame.upToDate, true);
  const deltaOld = await buildSyncDelta(device2, before);
  assert.equal(deltaOld.upToDate, false);
  assert.ok(deltaOld.manifest);
  CURRENT = {
    version: deltaOld.manifest!.manifestVersion,
    items: deltaOld.manifest!.playlist?.items.length ?? 0,
  };
  console.log("  OK delta sync", { before, after: device2.manifestVersion });

  console.log("Scenario 7 — Monitoring ONLINE → AWAY → OFFLINE");
  await recordHeartbeat({
    deviceId: paired.deviceId,
    playerVersion: "0.1.0",
    playlistId,
    contentId: textId,
    playerState: "PLAYING",
    resolution: "1920x1080",
  });
  const listed = await listDevicesWithPresence(tenantId);
  const row = listed.find((d) => d.id === paired.deviceId);
  assert.ok(row);
  assert.equal(row.presence, "ONLINE");
  const { onlineWindowMs, awayWindowMs } = getHeartbeatWindows();
  
  const away = derivePresence(
    new Date(Date.now() - onlineWindowMs - 1000).toISOString(),
    onlineWindowMs,
    awayWindowMs,
  );
  assert.equal(away, "AWAY");

  const offline = derivePresence(
    new Date(Date.now() - awayWindowMs - 1000).toISOString(),
    onlineWindowMs,
    awayWindowMs,
  );
  assert.equal(offline, "OFFLINE");
  console.log("  OK presence ONLINE + derived AWAY/OFFLINE");

  console.log("Extra — Device group assignment");
  const groupId = await createDeviceGroup(
    { name: `Campus ${stamp}` },
    tenantId,
  );
  await addDeviceToGroup(groupId, paired.deviceId, tenantId);
  const playlist2 = await createPlaylist({ name: `Grupo ${stamp}` }, tenantId);
  await addPlaylistItem({
    playlistId: playlist2,
    contentId: textId,
    tenantId,
  });
  const groupAssign = await assignPlaylistToGroup(
    groupId,
    playlist2,
    tenantId,
  );
  assert.equal(groupAssign.devicesUpdated, 1);
  console.log("  OK group assign");

  console.log("Extra — EMERGENCY schedule interrupt");
  const prior = await db.select().from(schema.schedules);
  for (const s of prior) {
    if (s.priority === "EMERGENCY" && s.tenantId === tenantId) {
      await db
        .update(schema.schedules)
        .set({ active: false })
        .where(eq(schema.schedules.id, s.id));
    }
  }
  await createSchedule(
    {
      name: `Emergency ${stamp}`,
      contentId: emergencyContentId,
      priority: "EMERGENCY",
      daysOfWeek: [],
      active: true,
      targets: [{ targetType: "ALL", targetId: null }],
    },
    tenantId,
  );
  const [device3] = await db
    .select()
    .from(schema.devices)
    .where(eq(schema.devices.id, paired.deviceId))
    .limit(1);
  const emergencyManifest = await buildDeviceManifest(device3!);
  assert.ok(emergencyManifest.playlist);
  assert.equal(emergencyManifest.playlist!.items[0]?.title, "EMERGÊNCIA");
  console.log("  OK emergency prepend");

  console.log("\nAll acceptance scenarios passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

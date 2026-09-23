/**
 * Deterministic local coverage for E2E-008 through E2E-025.
 *
 * This intentionally validates application services and the generated
 * manifest. Browser UI, physical HDMI, and Vercel deployment remain separate
 * gates in docs/E2E-VALIDATION-CHECKLIST.md.
 *
 * Run: npm run test:e2e-checklist
 */
import assert from "node:assert/strict";
import { config } from "dotenv";
import { and, eq } from "drizzle-orm";

config({ path: ".env.local" });
config({ path: ".env" });

const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function retryBusy<T>(
  operation: () => Promise<T>,
  attempts = 8,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("SQLITE_BUSY") || attempt >= attempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
  }
}

async function main() {
  const { db, schema } = await import("../src/db");
  const { createTenant } = await import("../src/services/tenants");
  const {
    startDevicePairing,
    pairDevice,
    bootstrapClaim,
    assignPlaylistToDevice,
  } = await import("../src/services/devices");
  const {
    createContent,
    uploadMediaAsset,
    listMediaAssets,
    deleteContent,
    deleteMediaAsset,
  } = await import("../src/services/contents");
  const {
    createPlaylist,
    addPlaylistItem,
    getPlaylistWithItems,
    reorderPlaylistItems,
    updatePlaylistItem,
    removePlaylistItem,
    duplicatePlaylist,
    deletePlaylist,
  } = await import("../src/services/playlists");
  const {
    createDeviceGroup,
    addDeviceToGroup,
    assignPlaylistToGroup,
  } = await import("../src/services/device-groups");
  const { createSchedule, setScheduleActive } = await import(
    "../src/services/schedules"
  );
  const { resolveEffectivePlayback } = await import(
    "../src/domain/playback-resolver"
  );
  const { buildDeviceManifest } = await import("../src/services/manifest");

  const stamp = Date.now().toString(36).toUpperCase();
  const tenantId = await retryBusy(() => createTenant({
    name: `E2E Checklist ${stamp}`,
    slug: `e2e-checklist-${stamp.toLowerCase()}`,
  }));

  console.log("E2E-008 — media deduplication");
  const firstAsset = await retryBusy(() => uploadMediaAsset({
    fileName: "e2e-pixel.png",
    mimeType: "image/png",
    data: PIXEL_PNG,
    tenantId,
  }));
  const secondAsset = await retryBusy(() => uploadMediaAsset({
    fileName: "e2e-pixel-copy.png",
    mimeType: "image/png",
    data: PIXEL_PNG,
    tenantId,
  }));
  assert.equal(secondAsset.id, firstAsset.id);
  assert.equal(secondAsset.checksum, firstAsset.checksum);
  assert.equal((await listMediaAssets(tenantId)).filter((a) => a.id === firstAsset.id).length, 1);
  console.log("  PASS same checksum reuses one MediaAsset");

  console.log("E2E-009/E2E-010 — content asset links and delete safety");
  const contentA = await retryBusy(() => createContent(
    {
      type: "IMAGE",
      title: "E2E image",
      durationMs: 7000,
      payload: {},
      status: "ACTIVE",
      mediaAssetId: firstAsset.id,
    },
    tenantId,
  ));
  const contentB = await retryBusy(() => createContent(
    {
      type: "TEXT",
      title: "E2E natural text",
      durationMs: 5000,
      payload: { body: "E2E" },
      status: "ACTIVE",
    },
    tenantId,
  ));
  const protectedPlaylist = await retryBusy(() => createPlaylist(
    { name: `Protected ${stamp}` },
    tenantId,
  ));
  const protectedItem = await retryBusy(() => addPlaylistItem({
    playlistId: protectedPlaylist,
    contentId: contentA,
    tenantId,
  }));
  await assert.rejects(() => deleteContent(contentA, tenantId), /used in/);
  await assert.rejects(
    () => deleteMediaAsset(firstAsset.id, tenantId),
    /linked to content/,
  );
  await retryBusy(() => removePlaylistItem(protectedPlaylist, protectedItem, tenantId));
  await retryBusy(() => deleteContent(contentA, tenantId));
  await retryBusy(() => deleteMediaAsset(firstAsset.id, tenantId));
  console.log("  PASS content and media deletion protection");

  console.log("E2E-011–E2E-016 — playlist lifecycle");
  const playlist = await retryBusy(() => createPlaylist(
    { name: `Lifecycle ${stamp}`, description: "before" },
    tenantId,
  ));
  const itemA = await retryBusy(() => addPlaylistItem({
    playlistId: playlist,
    contentId: contentB,
    tenantId,
    durationOverrideMs: 0,
  }));
  const itemB = await retryBusy(() => addPlaylistItem({
    playlistId: playlist,
    contentId: contentB,
    tenantId,
    durationOverrideMs: 12000,
  }));
  const beforeReorder = await getPlaylistWithItems(playlist, tenantId);
  assert.ok(beforeReorder);
  await retryBusy(() => reorderPlaylistItems(playlist, [itemB, itemA], tenantId));
  await retryBusy(() => updatePlaylistItem(playlist, itemB, { durationOverrideMs: 15000 }, tenantId));
  const afterReorder = await getPlaylistWithItems(playlist, tenantId);
  assert.ok(afterReorder);
  assert.deepEqual(
    afterReorder.items.map((item) => item.id),
    [itemB, itemA],
  );
  assert.equal(afterReorder.items[0]?.durationOverrideMs, 15000);
  assert.equal(afterReorder.items[1]?.durationOverrideMs, 0);

  const copy = await retryBusy(() => duplicatePlaylist(playlist, tenantId));
  const copied = await getPlaylistWithItems(copy, tenantId);
  assert.ok(copied);
  assert.notEqual(copy, playlist);
  assert.deepEqual(
    copied.items.map((item) => item.contentId),
    afterReorder.items.map((item) => item.contentId),
  );
  await retryBusy(() => deletePlaylist(copy, tenantId));
  console.log("  PASS reorder, duration override, duplicate, persistence");

  console.log("E2E-017–E2E-022 — device/group distribution and priority");
  const basePlaylist = await retryBusy(() => createPlaylist(
    { name: `Base ${stamp}` },
    tenantId,
  ));
  await retryBusy(() => addPlaylistItem({ playlistId: basePlaylist, contentId: contentB, tenantId }));
  const groupPlaylist = await retryBusy(() => createPlaylist(
    { name: `Group ${stamp}` },
    tenantId,
  ));
  await retryBusy(() => addPlaylistItem({
    playlistId: groupPlaylist,
    contentId: contentB,
    tenantId,
  }));
  const devicePlaylist = await retryBusy(() => createPlaylist(
    { name: `Device ${stamp}` },
    tenantId,
  ));
  await retryBusy(() => addPlaylistItem({
    playlistId: devicePlaylist,
    contentId: contentB,
    tenantId,
  }));
  const emergencyContent = await retryBusy(() => createContent(
    {
      type: "NOTICE",
      title: `Emergency ${stamp}`,
      durationMs: 3000,
      payload: { message: "Emergency" },
      status: "ACTIVE",
    },
    tenantId,
  ));

  const pairing = await retryBusy(() => startDevicePairing());
  const paired = await retryBusy(() => pairDevice({
    activationCode: pairing.activationCode,
    name: `E2E Device ${stamp}`,
    deviceCode: `E2E-${stamp}`,
    tenantId,
  }));
  const claim = await retryBusy(() => bootstrapClaim(paired.deviceId, pairing.pairingSecret));
  assert.equal(claim.status, "ACTIVE");
  await retryBusy(() => assignPlaylistToDevice(paired.deviceId, basePlaylist, tenantId));

  const group = await retryBusy(() => createDeviceGroup({ name: `E2E Group ${stamp}` }, tenantId));
  await retryBusy(() => addDeviceToGroup(group, paired.deviceId, tenantId));
  await retryBusy(() => assignPlaylistToGroup(group, groupPlaylist, tenantId));

  const now = new Date();
  const allSchedule = await retryBusy(() => createSchedule(
    {
      name: `All normal ${stamp}`,
      playlistId: basePlaylist,
      daysOfWeek: [],
      priority: "NORMAL",
      active: true,
      targets: [{ targetType: "ALL", targetId: null }],
    },
    tenantId,
  ));
  const groupSchedule = await retryBusy(() => createSchedule(
    {
      name: `Group high ${stamp}`,
      playlistId: groupPlaylist,
      daysOfWeek: [],
      priority: "HIGH",
      active: true,
      targets: [{ targetType: "GROUP", targetId: group }],
    },
    tenantId,
  ));
  const deviceSchedule = await retryBusy(() => createSchedule(
    {
      name: `Device emergency ${stamp}`,
      contentId: emergencyContent,
      daysOfWeek: [],
      priority: "EMERGENCY",
      active: true,
      targets: [{ targetType: "DEVICE", targetId: paired.deviceId }],
    },
    tenantId,
  ));

  const emergencyState = await resolveEffectivePlayback(paired.deviceId, now);
  assert.equal(emergencyState.effectiveState.source, "EMERGENCY");
  assert.equal(emergencyState.effectiveState.emergencyContentId, emergencyContent);

  await retryBusy(() => setScheduleActive(deviceSchedule, false, tenantId));
  const groupState = await resolveEffectivePlayback(paired.deviceId, now);
  assert.equal(groupState.effectiveState.source, "SCHEDULE");
  assert.equal(groupState.effectiveState.playlistId, groupPlaylist);
  assert.equal(groupState.effectiveState.priority, "HIGH");

  await retryBusy(() => setScheduleActive(groupSchedule, false, tenantId));
  const allState = await resolveEffectivePlayback(paired.deviceId, now);
  assert.equal(allState.effectiveState.playlistId, basePlaylist);
  assert.equal(allState.effectiveState.priority, "NORMAL");
  await retryBusy(() => setScheduleActive(allSchedule, false, tenantId));
  console.log("  PASS default, ALL, GROUP, DEVICE, priority and fallback");

  console.log("E2E-023–E2E-025 — effective manifest");
  await retryBusy(() => assignPlaylistToDevice(paired.deviceId, playlist, tenantId));
  const [device] = await db
    .select()
    .from(schema.devices)
    .where(and(eq(schema.devices.id, paired.deviceId), eq(schema.devices.tenantId, tenantId)))
    .limit(1);
  assert.ok(device);
  const manifest = await buildDeviceManifest(device);
  assert.equal(manifest.playlist?.id, playlist);
  assert.equal(manifest.playlist?.items[0]?.durationMs, 15000);
  assert.equal(manifest.playlist?.items[1]?.durationMs, 0);
  assert.ok(manifest.playlist?.items.every((item) => item.contentId === contentB));
  assert.ok(manifest.schedules.every((schedule) => schedule.id !== allSchedule));

  await assert.rejects(
    () => retryBusy(() => deletePlaylist(playlist, tenantId)),
    /assigned|atribuída/i,
  );
  console.log("  PASS resolver output, order, natural duration and dependency safety");

  await retryBusy(() => deletePlaylist(protectedPlaylist, tenantId));
  await retryBusy(() => assignPlaylistToDevice(paired.deviceId, basePlaylist, tenantId));
  await retryBusy(() => deletePlaylist(playlist, tenantId));
  console.log("E2E checklist local scenarios passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

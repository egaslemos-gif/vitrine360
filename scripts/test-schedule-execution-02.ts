/**
 * Phase SCHED-02 — Schedule execution & wall-clock effective playback.
 * Run: npm run test:sched-02
 */
import assert from "node:assert/strict";
import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { db, schema, ensureSchema } = await import("../src/db");
  await ensureSchema();
  const { createTenant } = await import("../src/services/tenants");
  const {
    normalizeTimeToHHmm,
    isWithinDailyWindow,
  } = await import("../src/domain/schedule-time");
  const { resolveEffectivePlayback } = await import(
    "../src/domain/playback-resolver"
  );
  const { effectivePlaybackKey } = await import(
    "../src/domain/effective-playback-key"
  );
  const {
    createSchedule,
    createScheduleSchema,
    bumpManifestForScheduleTargets,
  } = await import("../src/services/schedules");
  const { createPlaylist, addPlaylistItem } = await import(
    "../src/services/playlists"
  );
  const { createContent } = await import("../src/services/contents");
  const { buildSyncDelta, buildDeviceManifest } = await import(
    "../src/services/manifest"
  );

  const stamp = Date.now().toString(36);
  console.log("Phase SCHED-02", stamp);

  // SCHED-005 time helpers
  console.log("SCHED-005 time normalize");
  assert.equal(normalizeTimeToHHmm("08:00:00"), "08:00");
  assert.equal(normalizeTimeToHHmm("8:05"), "08:05");
  assert.equal(isWithinDailyWindow("08:00", "08:00:00", "12:00:00"), true);
  assert.equal(isWithinDailyWindow("07:59", "08:00", "12:00"), false);
  assert.equal(isWithinDailyWindow("11:59", "08:00", "12:00"), true);
  // half-open: end exclusive
  assert.equal(isWithinDailyWindow("12:00", "08:00", "12:00"), false);
  assert.equal(isWithinDailyWindow("12:01", "08:00", "12:00"), false);
  assert.equal(isWithinDailyWindow("23:00", "22:00", "06:00"), true);
  assert.equal(isWithinDailyWindow("05:00", "22:00", "06:00"), true);
  assert.equal(isWithinDailyWindow("06:00", "22:00", "06:00"), false);
  assert.equal(isWithinDailyWindow("12:00", "22:00", "06:00"), false);

  assert.throws(() =>
    createScheduleSchema.parse({
      name: "x",
      priority: "EMERGENCY",
      targets: [{ targetType: "ALL", targetId: null }],
    }),
  );

  const tenantId = (
    await createTenant({ name: `S02 ${stamp}`, slug: `s02-${stamp}` })
  );
  const playlistDefault = await createPlaylist(
    { name: `Default ${stamp}` },
    tenantId,
  );
  const playlistSched = await createPlaylist(
    { name: `SchedPL ${stamp}` },
    tenantId,
  );

  const textId = await createContent(
    {
      type: "TEXT",
      title: `T ${stamp}`,
      durationMs: 5000,
      payload: { body: "hi" },
      status: "ACTIVE",
    },
    tenantId,
  );
  await addPlaylistItem({
    playlistId: playlistDefault,
    contentId: textId,
    tenantId,
  });
  await addPlaylistItem({
    playlistId: playlistSched,
    contentId: textId,
    tenantId,
  });

  const deviceId = crypto.randomUUID();
  await db.insert(schema.devices).values({
    id: deviceId,
    deviceCode: `TV-S02-${stamp}`,
    name: "S02 Device",
    status: "ACTIVE",
    tenantId,
    currentPlaylistId: playlistDefault,
    manifestVersion: 3,
    timezone: "UTC",
  });

  // SCHED-006 outside window → DEFAULT
  console.log("SCHED-006 outside window");
  const schOut = await createSchedule(
    {
      name: `out ${stamp}`,
      playlistId: playlistSched,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startTime: "02:00:00",
      endTime: "03:00:00",
      priority: "HIGH",
      active: true,
      targets: [{ targetType: "DEVICE", targetId: deviceId }],
    },
    tenantId,
  );
  const noon = new Date("2026-09-22T12:00:00Z");
  const resOut = await resolveEffectivePlayback(deviceId, noon);
  assert.equal(resOut.effectiveState.source, "DEFAULT");
  assert.equal(resOut.effectiveState.playlistId, playlistDefault);

  // SCHED-001/002/007 create + bump + HH:mm:ss window match
  console.log("SCHED-001/007 create bumps version");
  const [before] = await db
    .select()
    .from(schema.devices)
    .where(eq(schema.devices.id, deviceId))
    .limit(1);
  const vBefore = before!.manifestVersion;

  const schIn = await createSchedule(
    {
      name: `in ${stamp}`,
      playlistId: playlistSched,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startTime: "08:00:00",
      endTime: "18:00:00",
      priority: "NORMAL",
      active: true,
      targets: [{ targetType: "ALL", targetId: null }],
    },
    tenantId,
  );
  void schOut;
  void schIn;

  const [afterCreate] = await db
    .select()
    .from(schema.devices)
    .where(eq(schema.devices.id, deviceId))
    .limit(1);
  assert.ok(afterCreate!.manifestVersion > vBefore);
  assert.equal(afterCreate!.effectivePlaybackKey, null);

  const morning = new Date("2026-09-22T10:00:00Z");
  const resIn = await resolveEffectivePlayback(deviceId, morning);
  assert.equal(resIn.effectiveState.source, "SCHEDULE");
  assert.equal(resIn.effectiveState.playlistId, playlistSched);

  // Exact start minute with :ss stored
  const atStart = new Date("2026-09-22T08:00:00Z");
  const resStart = await resolveEffectivePlayback(deviceId, atStart);
  assert.equal(resStart.effectiveState.source, "SCHEDULE");

  // SCHED-008 sync after create
  console.log("SCHED-008 sync delta");
  const [dev] = await db
    .select()
    .from(schema.devices)
    .where(eq(schema.devices.id, deviceId))
    .limit(1);
  // Simulate "Date" by resolving — buildSyncDelta uses Date.now().
  // For deterministic window we temporarily rely on FIXED schedule covering "now"
  // Re-create a schedule covering a wide window relative to wall clock:
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2, "0");
  // Use UTC device timezone; set window to all-day
  await db.delete(schema.schedules).where(eq(schema.schedules.tenantId, tenantId));
  await createSchedule(
    {
      name: `now ${stamp}`,
      playlistId: playlistSched,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startTime: "00:00",
      endTime: undefined,
      priority: "HIGH",
      active: true,
      targets: [{ targetType: "DEVICE", targetId: deviceId }],
    },
    tenantId,
  );
  const [dev2] = await db
    .select()
    .from(schema.devices)
    .where(eq(schema.devices.id, deviceId))
    .limit(1);
  const clientV = dev2!.manifestVersion;
  // Mark key as DEFAULT so wall-clock path also works when versions match
  await db
    .update(schema.devices)
    .set({
      manifestVersion: clientV,
      effectivePlaybackKey: effectivePlaybackKey({
        source: "DEFAULT",
        playlistId: playlistDefault,
        scheduleId: null,
        emergencyContentId: null,
        priority: "NONE",
      }),
    })
    .where(eq(schema.devices.id, deviceId));

  const [dev3] = await db
    .select()
    .from(schema.devices)
    .where(eq(schema.devices.id, deviceId))
    .limit(1);
  const delta = await buildSyncDelta(dev3!, clientV);
  assert.equal(delta.upToDate, false);
  assert.ok(delta.manifest);
  assert.equal(delta.manifest!.playlist?.id, playlistSched);
  assert.equal(delta.manifest!.effectivePlayback?.source, "SCHEDULE");

  // Second sync same key → upToDate
  const [dev4] = await db
    .select()
    .from(schema.devices)
    .where(eq(schema.devices.id, deviceId))
    .limit(1);
  const delta2 = await buildSyncDelta(dev4!, dev4!.manifestVersion);
  assert.equal(delta2.upToDate, true);

  // SCHED-009 wall-clock: change key without prior bump — simulate DEFAULT key while schedule active
  console.log("SCHED-009 wall-clock refresh");
  await db
    .update(schema.devices)
    .set({
      effectivePlaybackKey: "DEFAULT|old||NONE",
    })
    .where(eq(schema.devices.id, deviceId));
  const [dev5] = await db
    .select()
    .from(schema.devices)
    .where(eq(schema.devices.id, deviceId))
    .limit(1);
  const delta3 = await buildSyncDelta(dev5!, dev5!.manifestVersion);
  assert.equal(delta3.upToDate, false);
  assert.ok(delta3.manifest?.effectivePlayback?.key);

  // SCHED-004 priority
  console.log("SCHED-004 priority HIGH > NORMAL");
  await db.delete(schema.schedules).where(eq(schema.schedules.tenantId, tenantId));
  const plNormal = await createPlaylist({ name: `Norm ${stamp}` }, tenantId);
  const plHigh = await createPlaylist({ name: `High ${stamp}` }, tenantId);
  await addPlaylistItem({
    playlistId: plNormal,
    contentId: textId,
    tenantId,
  });
  await addPlaylistItem({
    playlistId: plHigh,
    contentId: textId,
    tenantId,
  });
  await createSchedule(
    {
      name: `lo ${stamp}`,
      playlistId: plNormal,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startTime: "00:00",
      endTime: undefined,
      priority: "NORMAL",
      active: true,
      targets: [{ targetType: "ALL", targetId: null }],
    },
    tenantId,
  );
  await createSchedule(
    {
      name: `hi ${stamp}`,
      playlistId: plHigh,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startTime: "00:00",
      endTime: undefined,
      priority: "HIGH",
      active: true,
      targets: [{ targetType: "ALL", targetId: null }],
    },
    tenantId,
  );
  const ranked = await resolveEffectivePlayback(deviceId);
  assert.equal(ranked.effectiveState.playlistId, plHigh);
  assert.equal(ranked.effectiveState.priority, "HIGH");

  // SCHED-02B update / deactivate / delete
  console.log("SCHED-02B update/active/delete");
  const { updateSchedule, setScheduleActive, deleteSchedule, getSchedule } =
    await import("../src/services/schedules");
  const editable = await createSchedule(
    {
      name: `edit-me ${stamp}`,
      playlistId: plNormal,
      daysOfWeek: [1, 2, 3],
      startTime: "10:00",
      endTime: "11:00",
      priority: "NORMAL",
      active: true,
      targets: [{ targetType: "DEVICE", targetId: deviceId }],
    },
    tenantId,
  );
  await updateSchedule(
    editable,
    {
      name: `edited ${stamp}`,
      playlistId: plHigh,
      daysOfWeek: [1, 2, 3, 4, 5],
      startTime: "09:00:00",
      endTime: "17:00",
      priority: "HIGH",
      active: true,
      targets: [{ targetType: "ALL", targetId: null }],
    },
    tenantId,
  );
  const got = await getSchedule(editable, tenantId);
  assert.ok(got);
  assert.equal(got!.name, `edited ${stamp}`);
  assert.equal(got!.playlistId, plHigh);
  assert.equal(got!.startTime, "09:00");
  assert.equal(got!.targets[0]?.targetType, "ALL");

  await setScheduleActive(editable, false, tenantId);
  assert.equal((await getSchedule(editable, tenantId))!.active, false);

  await deleteSchedule(editable, tenantId);
  assert.equal(await getSchedule(editable, tenantId), null);

  // bump helper
  const n = await bumpManifestForScheduleTargets(tenantId, [
    { targetType: "DEVICE", targetId: deviceId },
  ]);
  assert.equal(n, 1);

  const man = await buildDeviceManifest(
    (
      await db
        .select()
        .from(schema.devices)
        .where(eq(schema.devices.id, deviceId))
        .limit(1)
    )[0]!,
  );
  assert.ok(man.effectivePlayback);

  await db.delete(schema.tenants).where(eq(schema.tenants.id, tenantId));
  console.log("PASS Phase SCHED-02", hh);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

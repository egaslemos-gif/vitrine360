/**
 * Phase SCHED-02B — Schedule Management CRUD & Lifecycle
 * Run: npm run test:sched-mgmt
 *
 * Covers SCHED-MGMT-001 … 023 + E2E control-plane flow.
 */
import assert from "node:assert/strict";
import { config } from "dotenv";
import { and, eq, inArray } from "drizzle-orm";
import { toZonedTime, format } from "date-fns-tz";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { db, schema, ensureSchema } = await import("../src/db");
  await ensureSchema();
  const { createTenant } = await import("../src/services/tenants");
  const { createPlaylist, addPlaylistItem } = await import(
    "../src/services/playlists"
  );
  const { createContent } = await import("../src/services/contents");
  const {
    createSchedule,
    getSchedule,
    updateSchedule,
    setScheduleActive,
    deleteSchedule,
    listSchedules,
    SCHEDULE_ACTIVITY,
  } = await import("../src/services/schedules");
  const { resolveEffectivePlayback } = await import(
    "../src/domain/playback-resolver"
  );
  const { isWithinDailyWindow, normalizeTimeToHHmm } = await import(
    "../src/domain/schedule-time"
  );
  const { buildSyncDelta } = await import("../src/services/manifest");
  const { hasPermission } = await import("../src/domain/types");
  const { createDeviceGroup, addDeviceToGroup } = await import(
    "../src/services/device-groups"
  );

  const stamp = Date.now().toString(36);
  console.log("Phase SCHED-MGMT", stamp);

  const tenantA = await createTenant({
    name: `SM A ${stamp}`,
    slug: `sm-a-${stamp}`,
  });
  const tenantB = await createTenant({
    name: `SM B ${stamp}`,
    slug: `sm-b-${stamp}`,
  });

  async function makePlaylist(tenantId: string, name: string) {
    const pl = await createPlaylist({ name }, tenantId);
    const textId = await createContent(
      {
        type: "TEXT",
        title: `${name} text`,
        durationMs: 5000,
        payload: { body: name },
        status: "ACTIVE",
      },
      tenantId,
    );
    await addPlaylistItem({ playlistId: pl, contentId: textId, tenantId });
    return pl;
  }

  async function makeDevice(
    tenantId: string,
    code: string,
    playlistId: string,
    timezone = "UTC",
  ) {
    const id = crypto.randomUUID();
    await db.insert(schema.devices).values({
      id,
      deviceCode: code,
      name: code,
      status: "ACTIVE",
      tenantId,
      currentPlaylistId: playlistId,
      manifestVersion: 1,
      timezone,
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return id;
  }

  async function deviceRow(id: string) {
    const [row] = await db
      .select()
      .from(schema.devices)
      .where(eq(schema.devices.id, id))
      .limit(1);
    return row!;
  }

  async function lastActivity(tenantId: string, action: string) {
    const rows = await db
      .select()
      .from(schema.activityLogs)
      .where(
        and(
          eq(schema.activityLogs.tenantId, tenantId),
          eq(schema.activityLogs.action, action),
        ),
      );
    return rows[rows.length - 1] ?? null;
  }

  const plDefaultA = await makePlaylist(tenantA, `DefA ${stamp}`);
  const plSchedA = await makePlaylist(tenantA, `SchedA ${stamp}`);
  const plSchedA2 = await makePlaylist(tenantA, `SchedA2 ${stamp}`);
  const plDefaultB = await makePlaylist(tenantB, `DefB ${stamp}`);

  const device1 = await makeDevice(tenantA, `TV-SM1-${stamp}`, plDefaultA);
  const device2 = await makeDevice(tenantA, `TV-SM2-${stamp}`, plDefaultA);
  const device3 = await makeDevice(tenantA, `TV-SM3-${stamp}`, plDefaultA);
  const device4 = await makeDevice(tenantA, `TV-SM4-${stamp}`, plDefaultA);
  const device5 = await makeDevice(tenantA, `TV-SM5-${stamp}`, plDefaultA);
  const deviceB = await makeDevice(tenantB, `TV-SMB-${stamp}`, plDefaultB);

  const groupA = await createDeviceGroup(
    { name: `GA ${stamp}` },
    tenantA,
  );
  const groupB = await createDeviceGroup(
    { name: `GB ${stamp}` },
    tenantA,
  );
  await addDeviceToGroup(groupA, device1, tenantA);
  await addDeviceToGroup(groupA, device2, tenantA);
  await addDeviceToGroup(groupA, device3, tenantA);
  await addDeviceToGroup(groupB, device4, tenantA);
  await addDeviceToGroup(groupB, device5, tenantA);

  // ---- SCHED-MGMT-019/020/021 windows ----
  console.log("SCHED-MGMT-019/020/021 windows");
  assert.equal(normalizeTimeToHHmm("08:00:00"), "08:00");
  assert.equal(isWithinDailyWindow("08:00", "08:00", "18:00"), true);
  assert.equal(isWithinDailyWindow("12:00", "08:00", "18:00"), true);
  assert.equal(isWithinDailyWindow("17:59", "08:00", "18:00"), true);
  assert.equal(isWithinDailyWindow("18:00", "08:00", "18:00"), false);
  assert.equal(isWithinDailyWindow("22:30", "22:00", "02:00"), true);
  assert.equal(isWithinDailyWindow("00:30", "22:00", "02:00"), true);
  assert.equal(isWithinDailyWindow("01:59", "22:00", "02:00"), true);
  assert.equal(isWithinDailyWindow("02:00", "22:00", "02:00"), false);

  // ---- SCHED-MGMT-001 Create ----
  console.log("SCHED-MGMT-001 create");
  const schedId = await createSchedule(
    {
      name: `SM ${stamp}`,
      playlistId: plSchedA,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startTime: "00:00",
      endTime: undefined,
      priority: "HIGH",
      active: true,
      targets: [{ targetType: "DEVICE", targetId: device1 }],
    },
    tenantA,
  );
  const createdAct = await lastActivity(tenantA, SCHEDULE_ACTIVITY.CREATED);
  assert.ok(createdAct);
  assert.equal(createdAct!.resourceId, schedId);

  // ---- SCHED-MGMT-002 Read ----
  console.log("SCHED-MGMT-002 read");
  const got = await getSchedule(schedId, tenantA);
  assert.ok(got);
  assert.equal(got!.name, `SM ${stamp}`);
  assert.equal(got!.playlistId, plSchedA);
  assert.equal(got!.startTime, "00:00");
  assert.equal(got!.targets.length, 1);

  // ---- Create bumps device1 ----
  const d1AfterCreate = await deviceRow(device1);
  assert.ok((d1AfterCreate.manifestVersion ?? 0) > 1);
  assert.equal(d1AfterCreate.effectivePlaybackKey, null);

  // Sync → scheduled playlist effective
  console.log("E2E create→sync→effective");
  const sync1 = await buildSyncDelta(await deviceRow(device1), -1);
  assert.ok(sync1.manifest);
  assert.equal(sync1.manifest!.playlist?.id, plSchedA);
  assert.equal(sync1.manifest!.effectivePlayback?.source, "SCHEDULE");
  const resolved1 = await resolveEffectivePlayback(device1);
  assert.equal(resolved1.effectiveState.source, "SCHEDULE");
  assert.equal(resolved1.effectiveState.playlistId, plSchedA);
  assert.equal(resolved1.effectiveState.scheduleId, schedId);

  // ---- SCHED-MGMT-003/004 Update + targets ----
  console.log("SCHED-MGMT-003/004 update targets");
  const v1Before = (await deviceRow(device1)).manifestVersion ?? 0;
  const v4Before = (await deviceRow(device4)).manifestVersion ?? 0;
  const v5Before = (await deviceRow(device5)).manifestVersion ?? 0;
  const v2Before = (await deviceRow(device2)).manifestVersion ?? 0;
  const v3Before = (await deviceRow(device3)).manifestVersion ?? 0;

  // Retarget: GROUP-A (1,2,3) → GROUP-B (4,5)  — also change playlist
  await updateSchedule(
    schedId,
    {
      name: `SM edited ${stamp}`,
      playlistId: plSchedA2,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startTime: "00:00",
      endTime: undefined,
      priority: "HIGH",
      active: true,
      targets: [{ targetType: "GROUP", targetId: groupB }],
    },
    tenantA,
  );

  const updated = await getSchedule(schedId, tenantA);
  assert.equal(updated!.name, `SM edited ${stamp}`);
  assert.equal(updated!.playlistId, plSchedA2);
  assert.equal(updated!.targets[0]?.targetType, "GROUP");
  assert.equal(updated!.targets[0]?.targetId, groupB);

  const updatedAct = await lastActivity(tenantA, SCHEDULE_ACTIVITY.UPDATED);
  assert.ok(updatedAct);

  // ---- SCHED-MGMT-008/009/010 union invalidation ----
  console.log("SCHED-MGMT-008/009/010 union invalidation");
  // Old target was DEVICE device1 — must bump
  assert.ok(
    ((await deviceRow(device1)).manifestVersion ?? 0) > v1Before,
    "old DEVICE target bumped",
  );
  // New GROUP-B members 4,5
  assert.ok(
    ((await deviceRow(device4)).manifestVersion ?? 0) > v4Before,
    "new target device4 bumped",
  );
  assert.ok(
    ((await deviceRow(device5)).manifestVersion ?? 0) > v5Before,
    "new target device5 bumped",
  );
  // device2/3 were never targets of this schedule (only device1, then groupB)
  // After first create only device1 was bumped; after update groupB only.
  // device2/3 versions may stay unless earlier ALL — they should NOT need bump from this schedule's old DEVICE-only target.
  void v2Before;
  void v3Before;

  // Now update GROUP-A → GROUP-B style: create fresh schedule on groupA then move to groupB
  const schedMove = await createSchedule(
    {
      name: `move ${stamp}`,
      playlistId: plSchedA,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startTime: "00:00",
      endTime: undefined,
      priority: "NORMAL",
      active: true,
      targets: [{ targetType: "GROUP", targetId: groupA }],
    },
    tenantA,
  );
  const beforeMove = {
    d1: (await deviceRow(device1)).manifestVersion ?? 0,
    d2: (await deviceRow(device2)).manifestVersion ?? 0,
    d3: (await deviceRow(device3)).manifestVersion ?? 0,
    d4: (await deviceRow(device4)).manifestVersion ?? 0,
    d5: (await deviceRow(device5)).manifestVersion ?? 0,
  };
  await updateSchedule(
    schedMove,
    {
      name: `moved ${stamp}`,
      playlistId: plSchedA,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startTime: "00:00",
      endTime: undefined,
      priority: "NORMAL",
      active: true,
      targets: [{ targetType: "GROUP", targetId: groupB }],
    },
    tenantA,
  );
  assert.ok(((await deviceRow(device1)).manifestVersion ?? 0) > beforeMove.d1);
  assert.ok(((await deviceRow(device2)).manifestVersion ?? 0) > beforeMove.d2);
  assert.ok(((await deviceRow(device3)).manifestVersion ?? 0) > beforeMove.d3);
  assert.ok(((await deviceRow(device4)).manifestVersion ?? 0) > beforeMove.d4);
  assert.ok(((await deviceRow(device5)).manifestVersion ?? 0) > beforeMove.d5);

  // Sync device4 → new playlist from schedId (HIGH beats NORMAL move)
  const sync4 = await buildSyncDelta(await deviceRow(device4), -1);
  assert.equal(sync4.manifest!.playlist?.id, plSchedA2);

  // ---- SCHED-MGMT-005/006 Activate / Deactivate ----
  console.log("SCHED-MGMT-005/006 activate deactivate");
  const v4DeactBefore = (await deviceRow(device4)).manifestVersion ?? 0;
  await setScheduleActive(schedId, false, tenantA);
  assert.equal((await getSchedule(schedId, tenantA))!.active, false);
  assert.ok(
    ((await deviceRow(device4)).manifestVersion ?? 0) > v4DeactBefore,
  );
  const deactAct = await lastActivity(tenantA, SCHEDULE_ACTIVITY.DEACTIVATED);
  assert.ok(deactAct);

  // SCHED-MGMT-012 deactivate → default playlist
  console.log("SCHED-MGMT-012 deactivate → default");
  // Also deactivate move schedule so device4 has no schedule
  await setScheduleActive(schedMove, false, tenantA);
  const afterDeact = await resolveEffectivePlayback(device4);
  assert.equal(afterDeact.effectiveState.source, "DEFAULT");
  assert.equal(afterDeact.effectiveState.playlistId, plDefaultA);
  const syncDeact = await buildSyncDelta(await deviceRow(device4), -1);
  assert.equal(syncDeact.manifest!.playlist?.id, plDefaultA);

  await setScheduleActive(schedId, true, tenantA);
  assert.equal((await getSchedule(schedId, tenantA))!.active, true);
  const actAct = await lastActivity(tenantA, SCHEDULE_ACTIVITY.ACTIVATED);
  assert.ok(actAct);
  const afterAct = await resolveEffectivePlayback(device4);
  assert.equal(afterAct.effectiveState.playlistId, plSchedA2);

  // ---- SCHED-MGMT-007/011/013 Delete ----
  console.log("SCHED-MGMT-007/011/013 delete");
  const v4DelBefore = (await deviceRow(device4)).manifestVersion ?? 0;
  await deleteSchedule(schedId, tenantA);
  assert.equal(await getSchedule(schedId, tenantA), null);
  assert.ok(((await deviceRow(device4)).manifestVersion ?? 0) > v4DelBefore);
  const delAct = await lastActivity(tenantA, SCHEDULE_ACTIVITY.DELETED);
  assert.ok(delAct);

  const afterDel = await resolveEffectivePlayback(device4);
  assert.equal(afterDel.effectiveState.source, "DEFAULT");
  assert.equal(afterDel.effectiveState.playlistId, plDefaultA);
  const syncDel = await buildSyncDelta(await deviceRow(device4), -1);
  assert.equal(syncDel.manifest!.playlist?.id, plDefaultA);

  // ---- SCHED-MGMT-014 RBAC ----
  console.log("SCHED-MGMT-014 RBAC");
  assert.equal(hasPermission("VIEWER", "manage_schedules"), false);
  assert.equal(hasPermission("EDITOR", "manage_schedules"), true);
  assert.equal(hasPermission("OPERATOR", "manage_schedules"), true);
  assert.equal(hasPermission("ADMIN", "manage_schedules"), true);

  // ---- SCHED-MGMT-015..018 tenant isolation ----
  console.log("SCHED-MGMT-015..018 tenant isolation");
  await assert.rejects(
    () =>
      createSchedule(
        {
          name: "cross-pl",
          playlistId: plDefaultB,
          daysOfWeek: [1],
          startTime: "08:00",
          endTime: "18:00",
          priority: "NORMAL",
          active: true,
          targets: [{ targetType: "ALL", targetId: null }],
        },
        tenantA,
      ),
    /Playlist not found/,
  );
  await assert.rejects(
    () =>
      createSchedule(
        {
          name: "cross-dev",
          playlistId: plSchedA,
          daysOfWeek: [1],
          startTime: "08:00",
          endTime: "18:00",
          priority: "NORMAL",
          active: true,
          targets: [{ targetType: "DEVICE", targetId: deviceB }],
        },
        tenantA,
      ),
    /not found in tenant/,
  );
  const groupOtherTenant = await createDeviceGroup(
    { name: `Gx ${stamp}` },
    tenantB,
  );
  await assert.rejects(
    () =>
      createSchedule(
        {
          name: "cross-grp",
          playlistId: plSchedA,
          daysOfWeek: [1],
          startTime: "08:00",
          endTime: "18:00",
          priority: "NORMAL",
          active: true,
          targets: [{ targetType: "GROUP", targetId: groupOtherTenant }],
        },
        tenantA,
      ),
    /not found in tenant/,
  );
  assert.equal(await getSchedule(schedMove, tenantB), null);
  const listedB = await listSchedules(tenantB);
  assert.ok(!listedB.some((s) => s.id === schedMove));

  // ---- SCHED-MGMT-022 Timezone ----
  console.log("SCHED-MGMT-022 timezone");
  const tzDevice = await makeDevice(
    tenantA,
    `TV-TZ-${stamp}`,
    plDefaultA,
    "America/New_York",
  );
  // Build a window that is "now" in America/New_York
  const zoned = toZonedTime(new Date(), "America/New_York");
  const day = zoned.getDay();
  const hhmm = format(zoned, "HH:mm");
  const [hStr, mStr] = hhmm.split(":");
  const startM = Number(hStr) * 60 + Number(mStr);
  const endM = (startM + 30) % (24 * 60);
  const startHh = `${String(Math.floor(startM / 60)).padStart(2, "0")}:${String(startM % 60).padStart(2, "0")}`;
  const endHh = `${String(Math.floor(endM / 60)).padStart(2, "0")}:${String(endM % 60).padStart(2, "0")}`;
  await createSchedule(
    {
      name: `tz ${stamp}`,
      playlistId: plSchedA,
      daysOfWeek: [day],
      startTime: startHh,
      endTime: endHh,
      priority: "HIGH",
      active: true,
      targets: [{ targetType: "DEVICE", targetId: tzDevice }],
    },
    tenantA,
  );
  const tzResolved = await resolveEffectivePlayback(tzDevice);
  assert.equal(tzResolved.effectiveState.timezone, "America/New_York");
  assert.equal(tzResolved.effectiveState.playlistId, plSchedA);
  assert.equal(tzResolved.effectiveState.source, "SCHEDULE");

  // ---- SCHED-MGMT-023 Priority ----
  console.log("SCHED-MGMT-023 priority");
  await db.delete(schema.schedules).where(eq(schema.schedules.tenantId, tenantA));
  const prioDev = await makeDevice(tenantA, `TV-PR-${stamp}`, plDefaultA);
  await createSchedule(
    {
      name: `n ${stamp}`,
      playlistId: plSchedA,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startTime: "00:00",
      priority: "NORMAL",
      active: true,
      targets: [{ targetType: "DEVICE", targetId: prioDev }],
    },
    tenantA,
  );
  await createSchedule(
    {
      name: `h ${stamp}`,
      playlistId: plSchedA2,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startTime: "00:00",
      priority: "HIGH",
      active: true,
      targets: [{ targetType: "DEVICE", targetId: prioDev }],
    },
    tenantA,
  );
  const prio = await resolveEffectivePlayback(prioDev);
  assert.equal(prio.effectiveState.priority, "HIGH");
  assert.equal(prio.effectiveState.playlistId, plSchedA2);

  // Cleanup tenants
  await db.delete(schema.tenants).where(
    inArray(schema.tenants.id, [tenantA, tenantB]),
  );

  console.log("PASS Phase SCHED-MGMT");
}

main().catch((err) => {
  console.error("FAIL SCHED-MGMT", err);
  process.exit(1);
});

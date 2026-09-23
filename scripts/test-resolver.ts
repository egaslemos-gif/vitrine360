import { db } from "../src/db";
import {
  tenants,
  devices,
  deviceGroups,
  deviceGroupMembers,
  playlists,
  contents,
  schedules,
  scheduleTargets,
} from "../src/db/schema";
import { resolveEffectivePlayback } from "../src/domain/playback-resolver";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import assert from "node:assert/strict";

async function runTests() {
  console.log("Starting Resolver Tests...");
  
  // Setup isolated tenant
  const tenantId = randomUUID();
  await db.insert(tenants).values({
    id: tenantId,
    name: "Test Tenant",
    slug: `test-${tenantId}`,
    timezone: "UTC",
  });

  const deviceId = randomUUID();
  await db.insert(devices).values({
    id: deviceId,
    name: "Test Device",
    activationCode: "000000",
    tenantId,
    currentPlaylistId: "default-playlist",
    timezone: "Europe/Lisbon" // specific timezone for timezone tests
  });

  const groupId = randomUUID();
  await db.insert(deviceGroups).values({
    id: groupId,
    name: "Test Group",
    tenantId,
  });

  await db.insert(deviceGroupMembers).values({
    deviceId,
    groupId,
  });

  try {
    // Caso 1: Nenhum schedule
    const res1 = await resolveEffectivePlayback(deviceId);
    assert.equal(res1.effectiveState.source, "DEFAULT");
    assert.equal(res1.effectiveState.playlistId, "default-playlist");
    console.log("Caso 1 OK");

    // Caso 2: Schedule ALL ativo
    const sch1 = randomUUID();
    await db.insert(playlists).values({ id: "playlist-all", name: "P All", tenantId });
    await db.insert(schedules).values({
      id: sch1,
      name: "Sch1",
      playlistId: "playlist-all",
      priority: "NORMAL",
      active: true,
      tenantId,
    });
    await db.insert(scheduleTargets).values({
      id: randomUUID(),
      scheduleId: sch1,
      targetType: "ALL",
      targetId: null
    });

    const res2 = await resolveEffectivePlayback(deviceId);
    assert.equal(res2.effectiveState.source, "SCHEDULE");
    assert.equal(res2.effectiveState.playlistId, "playlist-all");
    console.log("Caso 2 OK");

    // Caso 5: Schedule DEVICE aplica
    const sch2 = randomUUID();
    await db.insert(playlists).values({ id: "playlist-device", name: "P Dev", tenantId });
    await db.insert(schedules).values({
      id: sch2,
      name: "Sch2",
      playlistId: "playlist-device",
      priority: "HIGH", // High beats Normal
      active: true,
      tenantId,
    });
    await db.insert(scheduleTargets).values({
      id: randomUUID(),
      scheduleId: sch2,
      targetType: "DEVICE",
      targetId: deviceId
    });

    const res3 = await resolveEffectivePlayback(deviceId);
    assert.equal(res3.effectiveState.source, "SCHEDULE");
    assert.equal(res3.effectiveState.playlistId, "playlist-device"); // High priority wins
    console.log("Caso 5 OK (e Caso 7 Prioridade HIGH > NORMAL)");

    // Caso 12: Timezone (Europe/Lisbon = UTC+1 no verão, UTC no inverno, agora Setembro = UTC+1)
    // Server time = now. Let's provide a custom `now` to the resolver!
    // UTC 08:00 = 09:00 Lisbon
    const customNow = new Date("2026-09-17T08:00:00Z");
    
    // Create a schedule that only runs at 09:00 local time
    const schTimezone = randomUUID();
    await db.insert(playlists).values({ id: "playlist-tz", name: "P TZ", tenantId });
    await db.insert(contents).values({ id: "emergency-tz", title: "Emergency TZ", type: "VIDEO", tenantId });
    await db.insert(schedules).values({
      id: schTimezone,
      name: "SchTZ",
      playlistId: "playlist-tz",
      priority: "EMERGENCY",
      startTime: "08:55",
      endTime: "09:05",
      active: true,
      tenantId,
      contentId: "emergency-tz"
    });
    await db.insert(scheduleTargets).values({
      id: randomUUID(),
      scheduleId: schTimezone,
      targetType: "ALL",
    });

    const res4 = await resolveEffectivePlayback(deviceId, customNow);
    assert.equal(res4.effectiveState.source, "EMERGENCY");
    assert.equal(res4.effectiveState.emergencyContentId, "emergency-tz");
    console.log("Caso 12 OK (Timezone respetado, UTC 08h atinge schedule 09h Lisbon)");

  } finally {
    console.log("Cleaning up...");
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  }
}

runTests().then(() => {
  console.log("All tests passed");
  process.exit(0);
}).catch((e) => {
  console.error("Test failed", e);
  process.exit(1);
});

/**
 * Multi-tenant isolation: tenant A must not see tenant B resources.
 */
import assert from "node:assert/strict";
import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { db, schema } = await import("../src/db");
  const { createTenant } = await import("../src/services/tenants");
  const { createContent, listContents } = await import(
    "../src/services/contents"
  );
  const { createPlaylist, listPlaylists, addPlaylistItem } = await import(
    "../src/services/playlists"
  );
  const {
    startDevicePairing,
    pairDevice,
    listDevicesWithPresence,
  } = await import("../src/services/devices");
  const { hashPassword } = await import("../src/lib/auth");

  const stamp = Date.now().toString(36);
  const tenantA = await createTenant({
    name: `Tenant A ${stamp}`,
    slug: `tenant-a-${stamp}`,
  });
  const tenantB = await createTenant({
    name: `Tenant B ${stamp}`,
    slug: `tenant-b-${stamp}`,
  });

  const contentA = await createContent(
    {
      type: "TEXT",
      title: "Only A",
      durationMs: 5000,
      payload: { body: "secret-a" },
      status: "ACTIVE",
    },
    tenantA,
  );
  const contentB = await createContent(
    {
      type: "TEXT",
      title: "Only B",
      durationMs: 5000,
      payload: { body: "secret-b" },
      status: "ACTIVE",
    },
    tenantB,
  );

  const listA = await listContents(tenantA);
  const listB = await listContents(tenantB);
  assert.ok(listA.some((c) => c.id === contentA));
  assert.ok(!listA.some((c) => c.id === contentB));
  assert.ok(listB.some((c) => c.id === contentB));
  assert.ok(!listB.some((c) => c.id === contentA));

  const plA = await createPlaylist({ name: "A Playlist" }, tenantA);
  await addPlaylistItem({
    playlistId: plA,
    contentId: contentA,
    tenantId: tenantA,
  });
  try {
    await addPlaylistItem({
      playlistId: plA,
      contentId: contentB,
      tenantId: tenantA,
    });
    assert.fail("should not attach foreign tenant content");
  } catch (e) {
    assert.ok(e instanceof Error);
  }

  const pairing = await startDevicePairing();
  await pairDevice({
    activationCode: pairing.activationCode,
    name: "Dev A",
    deviceCode: `TV-A-${stamp.toUpperCase()}`,
    tenantId: tenantA,
  });
  const devicesA = await listDevicesWithPresence(tenantA);
  const devicesB = await listDevicesWithPresence(tenantB);
  assert.equal(devicesA.filter((d) => d.status === "ACTIVE").length >= 1, true);
  assert.equal(
    devicesB.filter((d) => d.deviceCode?.startsWith("TV-A-")).length,
    0,
  );

  // Same email allowed in different tenants
  const hash = await hashPassword("Password123!");
  await db.insert(schema.users).values({
    id: crypto.randomUUID(),
    email: `shared-${stamp}@example.com`,
    name: "User A",
    passwordHash: hash,
    role: "ADMIN",
    tenantId: tenantA,
  });
  await db.insert(schema.users).values({
    id: crypto.randomUUID(),
    email: `shared-${stamp}@example.com`,
    name: "User B",
    passwordHash: hash,
    role: "ADMIN",
    tenantId: tenantB,
  });
  const usersA = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.tenantId, tenantA));
  assert.ok(usersA.some((u) => u.email === `shared-${stamp}@example.com`));

  const playlistsB = await listPlaylists(tenantB);
  assert.ok(!playlistsB.some((p) => p.id === plA));

  // Cross-tenant assign / schedule / claim
  const {
    assignPlaylistToDevice,
    bootstrapClaim,
  } = await import("../src/services/devices");
  const { createSchedule } = await import("../src/services/schedules");
  const plB = await createPlaylist({ name: "B Playlist" }, tenantB);
  const deviceA = devicesA.find((d) => d.deviceCode?.startsWith("TV-A-"));
  assert.ok(deviceA);
  await assert.rejects(() =>
    assignPlaylistToDevice(deviceA!.id, plB, tenantA),
  );
  await assert.rejects(() =>
    createSchedule(
      {
        name: "x",
        playlistId: plB,
        daysOfWeek: [],
        targets: [{ targetType: "ALL", targetId: null }],
        priority: "NORMAL",
        active: true,
      },
      tenantA,
    ),
  );
  const badClaim = await bootstrapClaim(deviceA!.id, "not-the-real-secret!!");
  assert.equal(badClaim.status, "FORBIDDEN");

  console.log("tenant isolation tests passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

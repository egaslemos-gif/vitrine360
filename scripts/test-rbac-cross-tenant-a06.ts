/**
 * A-06 / F-03 / F-04 — RBAC + cross-tenant isolation suite (local disposable DB).
 *
 * Refuses shared/remote DBs. Creates synthetic tenants A/B and asserts:
 * - list/get isolation
 * - mutate with wrong tenantId is no-op / reject
 * - bumpPlaylistVersion requires tenantId and scopes devices
 * - role permission matrix for privileged ops
 * - media asset tenant filter
 *
 * Run:
 *   DATABASE_URL=file:./data/rbac-a06-test.db npm run test:rbac-a06
 *
 * Does NOT hit Production or shared Preview. Does NOT mutate real content.
 */
import assert from "node:assert/strict";
import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";

config({ path: ".env.local" });
config({ path: ".env" });

function assertIsolatedDb() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("file:") || !/rbac-a06/i.test(url)) {
    throw new Error(
      `Refusing: set DATABASE_URL=file:./data/rbac-a06-test.db (got "${url.slice(0, 40)}")`,
    );
  }
  // Never allow Turso remote URLs
  if (/libsql:|turso\.io|http/i.test(url)) {
    throw new Error("Refusing remote DATABASE_URL for A-06 suite");
  }
}

type CaseResult = { id: string; status: "PASS" | "FAIL"; detail?: string };
const results: CaseResult[] = [];

function record(id: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      results.push({ id, status: "PASS" });
      console.log(`PASS ${id}`);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      results.push({ id, status: "FAIL", detail });
      console.error(`FAIL ${id}: ${detail}`);
      throw e;
    }
  })();
}

async function main() {
  assertIsolatedDb();
  process.env.AUTH_SECRET =
    process.env.AUTH_SECRET ?? "rbac-a06-test-secret-min-32-chars!!";

  const { db, schema, ensureSchema } = await import("../src/db");
  const { eq, and } = await import("drizzle-orm");
  const { createTenant } = await import("../src/services/tenants");
  const { hashPassword } = await import("../src/lib/auth");
  const { createMembership } = await import("../src/services/memberships");
  const { hasPermission } = await import("../src/domain/types");
  const {
    createContent,
    listContents,
    updateContent,
    deleteContent,
  } = await import("../src/services/contents");
  const {
    createPlaylist,
    listPlaylists,
    deletePlaylist,
    bumpPlaylistVersion,
    addPlaylistItem,
  } = await import("../src/services/playlists");
  const {
    startDevicePairing,
    pairDevice,
    assignPlaylistToDevice,
    listDevicesWithPresence,
  } = await import("../src/services/devices");

  await ensureSchema();
  // Best-effort schema push for empty file DB
  try {
    const { execSync } = await import("node:child_process");
    execSync("npx drizzle-kit push --force", {
      stdio: "pipe",
      env: { ...process.env },
      timeout: 120_000,
    });
  } catch {
    // ensureSchema + inserts may still work if tables exist from prior push
  }

  const stamp = Date.now().toString(36);
  const tenantA = await createTenant({
    name: `A06 A ${stamp}`,
    slug: `a06-a-${stamp}`,
  });
  const tenantB = await createTenant({
    name: `A06 B ${stamp}`,
    slug: `a06-b-${stamp}`,
  });

  const passwordHash = await hashPassword("A06TestPass!");
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
    await createMembership({
      userId: id,
      tenantId: home,
      role,
      status: "ACTIVE",
    });
    return id;
  }

  const adminA = await makeUser(`admin-a-${stamp}@a06.test`, tenantA, "ADMIN");
  const viewerA = await makeUser(`viewer-a-${stamp}@a06.test`, tenantA, "VIEWER");
  await makeUser(`editor-a-${stamp}@a06.test`, tenantA, "EDITOR");
  await makeUser(`admin-b-${stamp}@a06.test`, tenantB, "ADMIN");

  // --- Role matrix (A-06) ---
  await record("A06-ROLE-01 viewer lacks manage_users", () => {
    assert.equal(hasPermission("VIEWER", "manage_users"), false);
    assert.equal(hasPermission("VIEWER", "manage_devices"), false);
    assert.equal(hasPermission("VIEWER", "manage_contents"), false);
  });
  await record("A06-ROLE-02 editor lacks manage_devices/users", () => {
    assert.equal(hasPermission("EDITOR", "manage_devices"), false);
    assert.equal(hasPermission("EDITOR", "manage_users"), false);
    assert.equal(hasPermission("EDITOR", "manage_contents"), true);
  });
  await record("A06-ROLE-03 operator lacks manage_contents/users", () => {
    assert.equal(hasPermission("OPERATOR", "manage_contents"), false);
    assert.equal(hasPermission("OPERATOR", "manage_users"), false);
    assert.equal(hasPermission("OPERATOR", "manage_devices"), true);
  });

  // --- Content isolation ---
  const contentA = await createContent(
    {
      type: "TEXT",
      title: `secret-a-${stamp}`,
      durationMs: 5000,
      payload: { body: "a" },
      status: "ACTIVE",
    },
    tenantA,
    adminA,
  );
  const contentB = await createContent(
    {
      type: "TEXT",
      title: `secret-b-${stamp}`,
      durationMs: 5000,
      payload: { body: "b" },
      status: "ACTIVE",
    },
    tenantB,
  );

  await record("A06-CT-01 listContents no cross-tenant leak", async () => {
    const listA = await listContents(tenantA);
    const listB = await listContents(tenantB);
    assert.ok(listA.some((c) => c.id === contentA));
    assert.ok(!listA.some((c) => c.id === contentB));
    assert.ok(listB.some((c) => c.id === contentB));
    assert.ok(!listB.some((c) => c.id === contentA));
  });

  await record("A06-CT-02 updateContent wrong tenant no-op/reject", async () => {
    await assert.rejects(() =>
      updateContent(
        contentA,
        { title: "hijacked" },
        tenantB,
        adminA,
      ),
    );
    const [row] = await db
      .select()
      .from(schema.contents)
      .where(eq(schema.contents.id, contentA))
      .limit(1);
    assert.equal(row?.title, `secret-a-${stamp}`);
  });

  await record("A06-CT-03 deleteContent wrong tenant no effect", async () => {
    await assert.rejects(() => deleteContent(contentA, tenantB, adminA));
    const [row] = await db
      .select()
      .from(schema.contents)
      .where(eq(schema.contents.id, contentA))
      .limit(1);
    assert.ok(row);
  });

  // --- Playlist + bump ---
  const plA = await createPlaylist({ name: `pl-a-${stamp}` }, tenantA, adminA);
  const plB = await createPlaylist({ name: `pl-b-${stamp}` }, tenantB);

  await record("A06-PL-01 listPlaylists isolation", async () => {
    assert.equal(
      (await listPlaylists(tenantA)).some((p) => p.id === plB),
      false,
    );
    assert.equal(
      (await listPlaylists(tenantB)).some((p) => p.id === plA),
      false,
    );
  });

  await record("A06-PL-02 deletePlaylist wrong tenant rejected", async () => {
    await assert.rejects(() => deletePlaylist(plA, tenantB, adminA));
    const [row] = await db
      .select()
      .from(schema.playlists)
      .where(eq(schema.playlists.id, plA))
      .limit(1);
    assert.ok(row);
  });

  await record("A06-PL-03 bumpPlaylistVersion requires tenantId", async () => {
    await assert.rejects(
      // @ts-expect-error intentional missing arg
      () => bumpPlaylistVersion(plA),
    );
    await assert.rejects(() => bumpPlaylistVersion(plA, ""));
    await assert.rejects(() => bumpPlaylistVersion(plA, "   "));
  });

  await record("A06-PL-04 bump wrong tenant is no-op", async () => {
    const [before] = await db
      .select()
      .from(schema.playlists)
      .where(eq(schema.playlists.id, plA))
      .limit(1);
    assert.ok(before);
    await bumpPlaylistVersion(plA, tenantB);
    const [after] = await db
      .select()
      .from(schema.playlists)
      .where(eq(schema.playlists.id, plA))
      .limit(1);
    assert.equal(after?.version, before!.version);
  });

  await record("A06-PL-05 bump same tenant increments", async () => {
    const [before] = await db
      .select()
      .from(schema.playlists)
      .where(eq(schema.playlists.id, plA))
      .limit(1);
    await bumpPlaylistVersion(plA, tenantA);
    const [after] = await db
      .select()
      .from(schema.playlists)
      .where(eq(schema.playlists.id, plA))
      .limit(1);
    assert.equal(after!.version, before!.version + 1);
  });

  // Device + playlist assign isolation
  const pairing = await startDevicePairing();
  await pairDevice({
    activationCode: pairing.activationCode,
    name: "A06 Dev A",
    deviceCode: `A06-A-${stamp.toUpperCase()}`,
    tenantId: tenantA,
  });
  const devicesA = await listDevicesWithPresence(tenantA);
  const deviceA = devicesA.find((d) => d.deviceCode?.startsWith("A06-A-"));
  assert.ok(deviceA);

  await record("A06-DV-01 assign foreign playlist rejected", async () => {
    await assert.rejects(() =>
      assignPlaylistToDevice(deviceA!.id, plB, tenantA),
    );
  });

  await assignPlaylistToDevice(deviceA!.id, plA, tenantA);
  const [devBefore] = await db
    .select()
    .from(schema.devices)
    .where(eq(schema.devices.id, deviceA!.id))
    .limit(1);

  await record("A06-DV-02 bump scopes device manifest same tenant", async () => {
    await bumpPlaylistVersion(plA, tenantA);
    const [devAfter] = await db
      .select()
      .from(schema.devices)
      .where(
        and(
          eq(schema.devices.id, deviceA!.id),
          eq(schema.devices.tenantId, tenantA),
        ),
      )
      .limit(1);
    assert.equal(devAfter!.manifestVersion, devBefore!.manifestVersion + 1);
  });

  await record("A06-PL-06 foreign content cannot attach to playlist", async () => {
    await assert.rejects(() =>
      addPlaylistItem({
        playlistId: plA,
        contentId: contentB,
        tenantId: tenantA,
      }),
    );
  });

  // Media asset row isolation (DB layer)
  const assetA = crypto.randomUUID();
  const assetB = crypto.randomUUID();
  await db.insert(schema.mediaAssets).values({
    id: assetA,
    tenantId: tenantA,
    fileName: "a.png",
    mimeType: "image/png",
    fileSize: 10,
    checksum: `a06-a-${stamp}`,
    storageKey: `${tenantA}/${assetA}.png`,
    storageProvider: "local",
    url: `/api/media/${tenantA}/${assetA}.png`,
  });
  await db.insert(schema.mediaAssets).values({
    id: assetB,
    tenantId: tenantB,
    fileName: "b.png",
    mimeType: "image/png",
    fileSize: 10,
    checksum: `a06-b-${stamp}`,
    storageKey: `${tenantB}/${assetB}.png`,
    storageProvider: "local",
    url: `/api/media/${tenantB}/${assetB}.png`,
  });

  await record("A06-MD-01 mediaAssets query filters by tenant", async () => {
    const rowsA = await db
      .select()
      .from(schema.mediaAssets)
      .where(
        and(
          eq(schema.mediaAssets.id, assetB),
          eq(schema.mediaAssets.tenantId, tenantA),
        ),
      );
    assert.equal(rowsA.length, 0);
    const rowsOk = await db
      .select()
      .from(schema.mediaAssets)
      .where(
        and(
          eq(schema.mediaAssets.id, assetA),
          eq(schema.mediaAssets.tenantId, tenantA),
        ),
      );
    assert.equal(rowsOk.length, 1);
  });

  await record("A06-RBAC-01 viewer permission cannot manage users", () => {
    assert.equal(hasPermission("VIEWER", "manage_users"), false);
    void viewerA;
  });

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const outDir = path.join("docs", "security");
  fs.mkdirSync(outDir, { recursive: true });
  const evidencePath = path.join(outDir, "RBAC-A06-LOCAL-RESULTS.json");
  fs.writeFileSync(
    evidencePath,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        database: "file:./data/rbac-a06-test.db",
        headNote: "security/rbac-p0-p1 worktree",
        passed,
        failed,
        results,
      },
      null,
      2,
    ),
  );
  console.log(
    `\nA-06 local suite: ${passed} PASS, ${failed} FAIL → ${evidencePath}`,
  );
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

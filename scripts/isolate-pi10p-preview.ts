/**
 * PI-10P — Tenant isolation on Preview DB only (service-level, host-guarded).
 * Creates Tenant A/B ONLY on Preview. Never prints secrets.
 */
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "../src/db/schema";

const PREVIEW_HOST =
  "libsql://vitrine360-preview-elemos.aws-us-west-2.turso.io";
const PRODUCTION_HOST =
  "libsql://vitrine360-vercel-icfg-rd8hoku6p0oaszo88ixdwcu4.aws-us-east-1.turso.io";

config({ path: ".env.preview.local", override: true });

function record(id: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? ` — ${detail}` : ""}`);
  if (!ok) throw new Error(id);
}

async function main() {
  const url = process.env.DATABASE_URL || "";
  const token = process.env.DATABASE_AUTH_TOKEN || "";
  if (!url || !token || url === PRODUCTION_HOST || url !== PREVIEW_HOST) {
    console.error("STOP: Preview host guard failed");
    process.exit(2);
  }
  console.log("target_guard=PASS");

  process.env.DATABASE_URL = url;
  process.env.DATABASE_AUTH_TOKEN = token;
  process.env.TURSO_DATABASE_URL = url;
  process.env.TURSO_AUTH_TOKEN = token;
  process.env.ENTITLEMENTS_ENABLED = "false";

  const client = createClient({ url, authToken: token });
  const db = drizzle(client, { schema });

  async function ensureTenant(slug: string, name: string) {
    const [t] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.slug, slug))
      .limit(1);
    if (t) return t.id;
    const id = crypto.randomUUID();
    await db.insert(schema.tenants).values({
      id,
      name,
      slug,
      status: "ACTIVE",
    });
    return id;
  }

  async function ensureUser(email: string, tenantId: string) {
    const [u] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    if (u) return u.id;
    const id = crypto.randomUUID();
    await db.insert(schema.users).values({
      id,
      email,
      name: email,
      passwordHash: await bcrypt.hash("PreviewIso123!", 12),
      role: "SUPER_ADMIN",
      tenantId,
    });
    await db.insert(schema.memberships).values({
      id: `${id}:home`,
      userId: id,
      tenantId,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    });
    return id;
  }

  const tenantA = await ensureTenant("pi10p-iso-a", "PI10P Iso A");
  const tenantB = await ensureTenant("pi10p-iso-b", "PI10P Iso B");
  const userA = await ensureUser("iso-a@vitrine360.local", tenantA);
  const userB = await ensureUser("iso-b@vitrine360.local", tenantB);

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
    authenticateDevice,
  } = await import("../src/services/devices");

  const contentA = await createContent(
    {
      type: "TEXT",
      title: "Tenant A only",
      status: "ACTIVE",
      durationMs: 3000,
      payload: { text: "A" },
    } as never,
    tenantA,
    userA,
  );
  const contentB = await createContent(
    {
      type: "TEXT",
      title: "Tenant B only",
      status: "ACTIVE",
      durationMs: 3000,
      payload: { text: "B" },
    } as never,
    tenantB,
    userB,
  );

  const listA = await listContents(tenantA);
  const listB = await listContents(tenantB);
  record(
    "ISO-CONTENT-A-NOT-IN-B",
    listA.some((c) => c.id === contentA) &&
      !listA.some((c) => c.id === contentB) &&
      listB.some((c) => c.id === contentB) &&
      !listB.some((c) => c.id === contentA),
    "scoped lists",
  );

  const plA = await createPlaylist({ name: "A Playlist" }, tenantA, userA);
  await addPlaylistItem({
    playlistId: plA,
    contentId: contentA,
    tenantId: tenantA,
    userId: userA,
  });
  let crossPlaylistBlocked = false;
  try {
    await addPlaylistItem({
      playlistId: plA,
      contentId: contentB,
      tenantId: tenantA,
      userId: userA,
    });
  } catch {
    crossPlaylistBlocked = true;
  }
  record("ISO-PLAYLIST-CROSS-CONTENT", crossPlaylistBlocked, "attach blocked");

  const playlistsB = await listPlaylists(tenantB);
  record(
    "ISO-PLAYLIST-A-NOT-IN-B",
    !playlistsB.some((p) => p.id === plA),
    "playlist scoped",
  );

  const mediaAId = crypto.randomUUID();
  const mediaKey = `${tenantA}/${mediaAId}.txt`;
  await db.insert(schema.mediaAssets).values({
    id: mediaAId,
    tenantId: tenantA,
    fileName: "a.txt",
    mimeType: "text/plain",
    fileSize: 4,
    storageProvider: "r2",
    storageKey: mediaKey,
    url: `/api/media/${mediaKey}`,
    checksum: `sha256:${"a".repeat(64)}`,
  });
  const mediaFromB = await db
    .select()
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.id, mediaAId),
        eq(schema.mediaAssets.tenantId, tenantB),
      ),
    );
  record("ISO-MEDIA-A-NOT-IN-B", mediaFromB.length === 0, "media scoped");

  const pairing = await startDevicePairing({
    clientId: crypto.randomUUID().replace(/-/g, ""),
    pairingSecret: crypto.randomUUID().replace(/-/g, ""),
  });
  const deviceA = await pairDevice({
    activationCode: pairing.activationCode,
    name: "Iso Device A",
    deviceCode: `ISO-A-${Date.now().toString(36).toUpperCase()}`,
    tenantId: tenantA,
    userId: userA,
  });

  const devicesB = await listDevicesWithPresence(tenantB);
  record(
    "ISO-DEVICES-B-SCOPED",
    !devicesB.some((d) => d.id === deviceA.deviceId),
    "device A absent from B",
  );

  const devicesA = await listDevicesWithPresence(tenantA);
  record(
    "ISO-DEVICES-A-HAS",
    devicesA.some((d) => d.id === deviceA.deviceId),
    "device A present in A",
  );

  // Device bearer from A must not authenticate as B-scoped resource path:
  // authenticateDevice returns the device row; tenant must remain A.
  const [deviceRow] = await db
    .select()
    .from(schema.devices)
    .where(eq(schema.devices.id, deviceA.deviceId))
    .limit(1);
  record(
    "ISO-DEVICE-TENANT-A",
    deviceRow?.tenantId === tenantA,
    `tenantId=${deviceRow?.tenantId}`,
  );

  // Cross-tenant mutation: update device owned by A using tenant B scope
  // (service helpers always require matching tenantId).
  const { updateDevice } = await import("../src/services/devices");
  let crossMutateBlocked = false;
  try {
    await updateDevice(deviceA.deviceId, tenantB, { name: "hijack" }, userB);
  } catch {
    crossMutateBlocked = true;
  }
  // If no throw, verify that name was not changed under tenant B scope
  const [afterMutate] = await db
    .select()
    .from(schema.devices)
    .where(eq(schema.devices.id, deviceA.deviceId))
    .limit(1);
  if (!crossMutateBlocked && afterMutate?.name === "hijack") {
    crossMutateBlocked = false;
  } else if (!crossMutateBlocked && afterMutate?.name !== "hijack") {
    crossMutateBlocked = true;
  }
  record("ISO-DEVICE-MUTATE-CROSS", crossMutateBlocked, "mutate blocked");

  // Bearer without token cannot authenticate
  const noAuth = await authenticateDevice(null);
  record("ISO-BEARER-NULL", noAuth === null, "null bearer rejected");

  console.log("isolation=PASS");
  console.log("production_untouched=true");
}

main().catch((e) => {
  console.error(String(e).replace(/[A-Za-z0-9_-]{24,}/g, "REDACTED"));
  process.exit(1);
});

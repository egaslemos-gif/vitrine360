/**
 * Bump playlist version for network-recovery test: add a TEXT item titled RECOVERY-V2.
 * Usage: BASE_URL=http://127.0.0.1:3000 DEVICE_ID=<uuid> npx tsx scripts/bump-playlist-v2.ts
 */
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const DEVICE_ID = process.env.DEVICE_ID;

async function loginCookie() {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@vitrine360.local",
      password: "Admin123!",
    }),
  });
  assert.equal(loginRes.status, 200, "login failed");
  return (loginRes.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");
}

async function main() {
  assert.ok(DEVICE_ID, "Set DEVICE_ID");
  const cookie = await loginCookie();
  const headers = {
    "Content-Type": "application/json",
    Cookie: cookie,
  };

  const devicesRes = await fetch(`${BASE}/api/admin/devices`, { headers: { Cookie: cookie } });
  assert.equal(devicesRes.status, 200);
  const devicesJson = (await devicesRes.json()) as {
    devices: { id: string; currentPlaylistId: string | null; name: string }[];
  };
  const device = devicesJson.devices.find((d) => d.id === DEVICE_ID);
  assert.ok(device?.currentPlaylistId, "device has no playlist");

  const textRes = await fetch(`${BASE}/api/admin/contents`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: "TEXT",
      title: "RECOVERY-V2",
      durationMs: 8000,
      payload: {
        body: "Network recovery activated v2",
        align: "center",
        fontSize: "large",
      },
      status: "ACTIVE",
    }),
  });
  const textText = await textRes.text();
  assert.equal(textRes.status, 200, textText);
  const text = JSON.parse(textText) as { id: string };

  const addRes = await fetch(`${BASE}/api/admin/playlists`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      action: "add_item",
      playlistId: device.currentPlaylistId,
      contentId: text.id,
    }),
  });
  const addText = await addRes.text();
  assert.equal(addRes.status, 200, addText);

  console.log(
    JSON.stringify(
      {
        ok: true,
        deviceId: DEVICE_ID,
        playlistId: device.currentPlaylistId,
        contentId: text.id,
        title: "RECOVERY-V2",
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

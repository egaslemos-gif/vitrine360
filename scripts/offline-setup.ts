/**
 * Complete browser-assisted offline setup:
 * 1. Pass ACTIVATION_CODE from /player pairing screen
 * 2. Pairs device, creates TEXT content + playlist, assigns
 * 3. Prints deviceId for verification
 *
 * Usage:
 *   ACTIVATION_CODE=123456 BASE_URL=http://127.0.0.1:3001 npx tsx scripts/offline-setup.ts
 */
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const CODE = process.env.ACTIVATION_CODE;
const DEVICE_CODE =
  process.env.DEVICE_CODE ?? `TV-OFF-${Date.now().toString(36).toUpperCase()}`;

async function main() {
  assert.ok(CODE && CODE.length === 6, "Set ACTIVATION_CODE=######");

  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@vitrine360.local",
      password: "Admin123!",
    }),
  });
  assert.equal(loginRes.status, 200);
  const cookie = (loginRes.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");

  const pairRes = await fetch(`${BASE}/api/admin/devices`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      activationCode: CODE,
      name: "Offline Browser Test",
      location: "Lab",
      deviceCode: DEVICE_CODE,
    }),
  });
  const pairBody = await pairRes.json();
  assert.equal(pairRes.status, 200, JSON.stringify(pairBody));

  const contentRes = await fetch(`${BASE}/api/admin/contents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      type: "TEXT",
      title: "Offline Banner",
      durationMs: 10000,
      payload: {
        body: "Conteudo offline verificado",
        align: "center",
        fontSize: "large",
      },
      status: "ACTIVE",
    }),
  });
  const content = (await contentRes.json()) as { id: string };
  assert.ok(content.id);

  const plRes = await fetch(`${BASE}/api/admin/playlists`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ name: `Offline ${DEVICE_CODE}` }),
  });
  const pl = (await plRes.json()) as { id: string };

  await fetch(`${BASE}/api/admin/playlists`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      action: "add_item",
      playlistId: pl.id,
      contentId: content.id,
    }),
  });

  const devicesRes = await fetch(`${BASE}/api/admin/devices`, {
    headers: { Cookie: cookie },
  });
  const devicesBody = (await devicesRes.json()) as {
    devices: Array<{ id: string; deviceCode: string | null }>;
  };
  const device = devicesBody.devices.find((d) => d.deviceCode === DEVICE_CODE);
  assert.ok(device);

  const assignRes = await fetch(
    `${BASE}/api/admin/devices/${device.id}/assign`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ playlistId: pl.id }),
    },
  );
  assert.equal(assignRes.status, 200);

  console.log(
    JSON.stringify(
      {
        ok: true,
        deviceCode: DEVICE_CODE,
        deviceId: device.id,
        playlistId: pl.id,
        contentId: content.id,
        next: "Wait for player to claim + sync, then go offline and reload /player",
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

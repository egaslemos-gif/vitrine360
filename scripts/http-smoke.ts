/**
 * HTTP smoke: login, pair device via Admin+Device APIs, dashboard stats.
 * Expects `next start` or `next dev` on BASE_URL.
 */
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";

async function main() {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@vitrine360.local",
      password: "Admin123!",
    }),
  });
  assert.equal(loginRes.status, 200, "login failed");
  const cookie = loginRes.headers.getSetCookie?.() ?? [];
  const cookieHeader = cookie.map((c) => c.split(";")[0]).join("; ");
  assert.ok(cookieHeader.includes("v360_session"), "session cookie missing");

  const pairStart = await fetch(`${BASE}/api/device/bootstrap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "pair_start",
      clientId: `smoke-${Date.now()}-client`,
      pairingSecret: `smoke-${Date.now()}-pairing-secret`,
    }),
  });
  assert.equal(pairStart.status, 200);
  const pending = (await pairStart.json()) as {
    deviceId: string;
    activationCode: string;
    pairingSecret: string;
  };
  assert.ok(pending.pairingSecret);

  const code = `TV-HTTP-${Date.now().toString(36).toUpperCase()}`;
  const adminPair = await fetch(`${BASE}/api/admin/devices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      activationCode: pending.activationCode,
      name: "HTTP Smoke",
      location: "Lab",
      deviceCode: code,
    }),
  });
  assert.equal(adminPair.status, 200, await adminPair.text());

  const claim = await fetch(`${BASE}/api/device/bootstrap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "claim",
      deviceId: pending.deviceId,
      pairingSecret: pending.pairingSecret,
    }),
  });
  const claimBody = (await claim.json()) as {
    status: string;
    deviceToken?: string;
  };
  assert.equal(claimBody.status, "ACTIVE");
  assert.ok(claimBody.deviceToken);

  const hb = await fetch(`${BASE}/api/device/heartbeat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${claimBody.deviceToken}`,
    },
    body: JSON.stringify({
      playerVersion: "0.1.0",
      playerState: "PLAYING",
      resolution: "1920x1080",
    }),
  });
  assert.equal(hb.status, 200);

  const dash = await fetch(`${BASE}/api/admin/dashboard`, {
    headers: { Cookie: cookieHeader },
  });
  assert.equal(dash.status, 200);
  const stats = (await dash.json()) as { totalDevices: number; online: number };
  assert.ok(stats.totalDevices >= 1);
  assert.ok(stats.online >= 1);

  console.log("HTTP smoke passed", { deviceCode: code, online: stats.online });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

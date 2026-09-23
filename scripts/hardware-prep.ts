/**
 * On-site hardware validation prep.
 * Pairs a Player activation code, seeds TEXT + IMAGE + VIDEO, assigns playlist.
 * Operator then runs the physical checklist on the Android TV Box (HDMI).
 *
 * Usage (produção — caminho HDMI recomendado):
 *   $env:BASE_URL='https://vitrine360-psi.vercel.app'
 *   $env:ACTIVATION_CODE='123456'
 *   npm run hardware:prep
 *
 * Lab local:
 *   $env:BASE_URL='http://127.0.0.1:3000'
 *   $env:ACTIVATION_CODE='123456'
 *   npm run hardware:prep
 *
 * Optional:
 *   VIDEO_FILE=./other.mp4   (default: ./fixtures/hw-sample.mp4)
 *   VIDEO_FILE=none          skip video seed
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const BASE = (process.env.BASE_URL ?? "https://vitrine360-psi.vercel.app").replace(
  /\/$/,
  "",
);
const CODE = process.env.ACTIVATION_CODE;
const DEVICE_CODE =
  process.env.DEVICE_CODE ?? `TV-HW-${Date.now().toString(36).toUpperCase()}`;
const VIDEO_FILE =
  process.env.VIDEO_FILE === "none"
    ? undefined
    : (process.env.VIDEO_FILE ?? "./fixtures/hw-sample.mp4");

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function loginCookie() {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@vitrine360.local",
      password: "Admin123!",
    }),
  });
  assert.equal(loginRes.status, 200, "login failed — seed DEV admin?");
  return (loginRes.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");
}

async function main() {
  assert.ok(CODE && CODE.length === 6, "Set ACTIVATION_CODE=###### from /player");

  const cookie = await loginCookie();
  const jsonHeaders = {
    "Content-Type": "application/json",
    Cookie: cookie,
  };

  const pairRes = await fetch(`${BASE}/api/admin/devices`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      activationCode: CODE,
      name: "Android TV Hardware Validation",
      location: "HDMI Lab",
      deviceCode: DEVICE_CODE,
    }),
  });
  assert.equal(pairRes.status, 200, await pairRes.text());

  const textRes = await fetch(`${BASE}/api/admin/contents`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      type: "TEXT",
      title: "HW Text Banner",
      durationMs: 8000,
      payload: {
        body: "Vitrine360 Passive Runtime — hardware validation",
        align: "center",
        fontSize: "large",
      },
      status: "ACTIVE",
    }),
  });
  const text = (await textRes.json()) as { id: string };
  assert.ok(text.id);

  const form = new FormData();
  form.append(
    "file",
    new Blob([PNG_1X1], { type: "image/png" }),
    "hw-pixel.png",
  );
  const mediaRes = await fetch(`${BASE}/api/admin/media`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  const mediaText = await mediaRes.text();
  assert.equal(mediaRes.status, 200, mediaText);
  const media = JSON.parse(mediaText) as { id: string; checksum?: string };

  const imageRes = await fetch(`${BASE}/api/admin/contents`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      type: "IMAGE",
      title: "HW Image",
      durationMs: 8000,
      payload: {},
      status: "ACTIVE",
      mediaAssetId: media.id,
    }),
  });
  const image = (await imageRes.json()) as { id: string };
  assert.ok(image.id);

  const contentIds = [text.id, image.id];
  let videoMeta: Record<string, unknown> | null = null;

  if (VIDEO_FILE) {
    const abs = path.resolve(VIDEO_FILE);
    assert.ok(fs.existsSync(abs), `VIDEO_FILE not found: ${abs}`);
    const buf = fs.readFileSync(abs);
    const vForm = new FormData();
    vForm.append(
      "file",
      new Blob([buf], { type: "video/mp4" }),
      path.basename(abs),
    );
    const vMediaRes = await fetch(`${BASE}/api/admin/media`, {
      method: "POST",
      headers: { Cookie: cookie },
      body: vForm,
    });
    const vMediaText = await vMediaRes.text();
    assert.equal(vMediaRes.status, 200, vMediaText);
    const vMedia = JSON.parse(vMediaText) as {
      id: string;
      checksum?: string;
    };
    const videoRes = await fetch(`${BASE}/api/admin/contents`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        type: "VIDEO",
        title: "HW Video",
        durationMs: 15000,
        payload: {},
        status: "ACTIVE",
        mediaAssetId: vMedia.id,
      }),
    });
    const video = (await videoRes.json()) as { id: string };
    contentIds.push(video.id);
    videoMeta = {
      file: abs,
      bytes: buf.length,
      sha256: createHash("sha256").update(buf).digest("hex"),
      contentId: video.id,
      mediaAssetId: vMedia.id,
      checksum: vMedia.checksum,
      note: "Record codec/resolution/duration in android-tv-checklist.md after playback",
    };
  }

  const plRes = await fetch(`${BASE}/api/admin/playlists`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ name: `HW ${DEVICE_CODE}` }),
  });
  const pl = (await plRes.json()) as { id: string };

  for (const contentId of contentIds) {
    const add = await fetch(`${BASE}/api/admin/playlists`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({
        action: "add_item",
        playlistId: pl.id,
        contentId,
      }),
    });
    assert.equal(add.status, 200, await add.text());
  }

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
      headers: jsonHeaders,
      body: JSON.stringify({ playlistId: pl.id }),
    },
  );
  assert.equal(assignRes.status, 200);

  if (VIDEO_FILE) {
    assert.equal(
      contentIds.length,
      3,
      "HDMI prep must seed TEXT + IMAGE + VIDEO",
    );
    assert.ok(videoMeta, "video metadata missing after VIDEO_FILE seed");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl: BASE,
        playerUrl: `${BASE}/player`,
        adminUrl: `${BASE}/admin/devices`,
        deviceCode: DEVICE_CODE,
        deviceId: device.id,
        playlistId: pl.id,
        contentIds,
        video: videoMeta,
        nextSteps: [
          `Confirm the Box is open on ${BASE}/player and claimed ACTIVE`,
          "Confirm playback of TEXT + IMAGE + VIDEO on the HDMI TV",
          "Drop screenshots into docs/evidence/hw-pending/ (see README.md)",
          "Offline → reboot box → confirm local resume (hw-reboot-offline.png)",
          "Fill docs/evidence/hw-pending/RESULTS-TEMPLATE.md then npm run hardware:evidence",
        ],
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

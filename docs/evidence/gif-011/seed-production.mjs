/**
 * GIF-011 one-shot production seed (validation only — not product code).
 * Run: npx tsx docs/evidence/gif-011/seed-production.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.BASE_URL ?? "https://vitrine360-psi.vercel.app").replace(
  /\/$/,
  "",
);
const gifPath = path.join(__dirname, "gif-011-animated.gif");

async function main() {
  const gif = fs.readFileSync(gifPath);
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@vitrine360.local",
      password: "Admin123!",
    }),
  });
  console.log("login", loginRes.status);
  const setCookie = loginRes.headers.getSetCookie?.() ?? [];
  let cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  if (!cookie) {
    const txt = await loginRes.text();
    console.log("login body", txt.slice(0, 300));
    throw new Error("no session cookie — check admin credentials on production");
  }

  const form = new FormData();
  form.set(
    "file",
    new Blob([gif], { type: "image/gif" }),
    "gif-011-animated.gif",
  );
  const up = await fetch(`${BASE}/api/admin/media`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  const upText = await up.text();
  console.log("upload", up.status, upText.slice(0, 400));
  if (!up.ok) throw new Error("upload failed");
  const asset = JSON.parse(upText);
  fs.writeFileSync(
    path.join(__dirname, "upload-response.json"),
    JSON.stringify(asset, null, 2),
  );

  const create = await fetch(`${BASE}/api/admin/contents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      type: "IMAGE",
      title: "GIF-011 Hisense Validation",
      durationMs: 9000,
      status: "ACTIVE",
      mediaAssetId: asset.id,
      payload: {},
    }),
  });
  const createText = await create.text();
  console.log("content", create.status, createText.slice(0, 400));
  if (!create.ok) throw new Error("content create failed");
  const content = JSON.parse(createText);
  fs.writeFileSync(
    path.join(__dirname, "content-response.json"),
    JSON.stringify(content, null, 2),
  );

  const devicesRes = await fetch(`${BASE}/api/admin/devices`, {
    headers: { Cookie: cookie },
  });
  const devicesText = await devicesRes.text();
  console.log("devices", devicesRes.status);
  fs.writeFileSync(path.join(__dirname, "devices-snapshot.json"), devicesText);

  const plRes = await fetch(`${BASE}/api/admin/playlists`, {
    headers: { Cookie: cookie },
  });
  const plText = await plRes.text();
  console.log("playlists", plRes.status);
  fs.writeFileSync(path.join(__dirname, "playlists-snapshot.json"), plText);

  let devices = [];
  try {
    const parsed = JSON.parse(devicesText);
    devices = Array.isArray(parsed) ? parsed : parsed.devices ?? parsed.items ?? [];
  } catch {
    devices = [];
  }

  const hisense =
    devices.find((d) =>
      /hisense|sraf|vidaa|smart\s*tv|tv\.html/i.test(
        `${d.name ?? ""} ${d.location ?? ""} ${d.deviceCode ?? ""} ${d.softwareVersion ?? ""}`,
      ),
    ) ??
    devices.find((d) => d.status === "ACTIVE" && d.currentPlaylistId) ??
    devices[0];

  console.log(
    "targetDevice",
    hisense
      ? {
          id: hisense.id,
          name: hisense.name,
          code: hisense.deviceCode,
          playlist: hisense.currentPlaylistId,
          status: hisense.status,
        }
      : null,
  );

  if (hisense?.currentPlaylistId && content.id) {
    const add = await fetch(
      `${BASE}/api/admin/playlists/${hisense.currentPlaylistId}/items`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          contentId: content.id,
          transition: "cut",
        }),
      },
    );
    const addText = await add.text();
    console.log("playlistItem", add.status, addText.slice(0, 400));
    fs.writeFileSync(
      path.join(__dirname, "playlist-item-response.json"),
      JSON.stringify({ status: add.status, body: addText }, null, 2),
    );
  } else {
    console.log("SKIP playlist attach — no device playlist found");
  }

  console.log("SEED DONE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

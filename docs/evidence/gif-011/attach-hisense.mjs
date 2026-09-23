import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "https://vitrine360-psi.vercel.app";
const contentId = JSON.parse(
  fs.readFileSync(path.join(__dirname, "content-response.json"), "utf8"),
).id;
const asset = JSON.parse(
  fs.readFileSync(path.join(__dirname, "upload-response.json"), "utf8"),
);
const HISENSE_PLAYLIST = "f2ea84e4-4b5a-4784-9f78-debd3e4f9692";
const HISENSE_DEVICE = "463c0c7d-e588-4913-9ce8-572e83a0ab4d";

const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "admin@vitrine360.local",
    password: "Admin123!",
  }),
});
const cookie = (loginRes.headers.getSetCookie?.() ?? [])
  .map((c) => c.split(";")[0])
  .join("; ");
console.log("login", loginRes.status);

const mediaOne = await fetch(`${BASE}/api/admin/media/${asset.id}`, {
  headers: { Cookie: cookie },
});
const mediaText = await mediaOne.text();
console.log("mediaGet", mediaOne.status, mediaText.slice(0, 500));
fs.writeFileSync(path.join(__dirname, "media-get.json"), mediaText);

const contentGet = await fetch(`${BASE}/api/admin/contents/${contentId}`, {
  headers: { Cookie: cookie },
});
const contentText = await contentGet.text();
console.log("contentGet", contentGet.status, contentText.slice(0, 500));
fs.writeFileSync(path.join(__dirname, "content-get.json"), contentText);

const add = await fetch(`${BASE}/api/admin/playlists`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify({
    action: "add_item",
    playlistId: HISENSE_PLAYLIST,
    contentId,
  }),
});
const addText = await add.text();
console.log("add_item", add.status, addText);
fs.writeFileSync(
  path.join(__dirname, "playlist-item-response.json"),
  JSON.stringify(
    {
      status: add.status,
      body: (() => {
        try {
          return JSON.parse(addText);
        } catch {
          return addText;
        }
      })(),
      hisensePlaylistId: HISENSE_PLAYLIST,
      hisenseDeviceId: HISENSE_DEVICE,
      contentId,
      mediaAssetId: asset.id,
    },
    null,
    2,
  ),
);

const mediaList = await fetch(`${BASE}/api/admin/media`, {
  headers: { Cookie: cookie },
});
const mediaJson = await mediaList.json();
const items =
  mediaJson.assets || mediaJson.media || mediaJson.items || mediaJson;
const match = (Array.isArray(items) ? items : []).find((a) => a.id === asset.id);
console.log("listed", match);

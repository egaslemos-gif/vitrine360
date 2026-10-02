/**
 * PLAYER-PRO-02A — STOP during media loading, real Chrome.
 *
 * The media request is held by the test (Playwright route) so the <video> stays in LOADING;
 * STOP is pressed BEFORE loadedmetadata/loadeddata/canplay; then the response is released and
 * the real native events arrive late.
 *   A) Stop -> late native events                       -> stays STOPPED, element paused
 *   B) Stop -> NEXT (generation change) -> late events of the old element -> new item unaffected
 *
 *   DATABASE_URL=file:./data/authz02-e2e.db MEDIA_STORAGE_PROVIDER=local \
 *   MEDIA_LOCAL_DIR=./data/authz02-media npx next start -p 3150
 *   BASE_URL=http://localhost:3150 npx tsx scripts/live-player-pro-02a-validate.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { chromium, type Page } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3150";
const OUT = "docs/evidence/player-pro-02";
const seed = JSON.parse(fs.readFileSync("data/authz02-e2e-seed.json", "utf8")) as {
  password: string;
  tenants: { ok: { users: { ADMIN: string } } };
};
const SAMPLE = fs.readFileSync(path.join(process.cwd(), "public", "hw-sample.mp4"));
const INSTRUMENT_JS = fs.readFileSync(path.join(OUT, "instrument.js"), "utf8");

const rows: { id: string; ok: boolean; detail: string }[] = [];
function check(id: string, ok: boolean, detail = "") {
  rows.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? " — " + detail : ""}`);
}

function crc32(buf: Buffer) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]!) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function png() {
  const chunk = (t: string, d: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t), d]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(64, 0); ihdr.writeUInt32BE(36, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: 64 }, () => [60, 120, 200]).flat())]);
  const raw = Buffer.concat(Array.from({ length: 36 }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const snap = (p: Page) =>
  p.evaluate(() => {
    const root = document.querySelector("[data-playback-status]");
    const vids = Array.from(document.querySelectorAll("video"));
    const m = vids[0] as HTMLVideoElement | undefined;
    return {
      status: root?.getAttribute("data-playback-status") ?? "-",
      gen: Number(root?.getAttribute("data-playback-generation") ?? -1),
      idx: Number(root?.getAttribute("data-playback-index") ?? -1),
      kind: document.querySelector("[data-media-kind]")?.getAttribute("data-media-kind") ?? "-",
      videos: vids.length,
      anyVideoPlaying: vids.some((v) => !v.paused),
      paused: m ? m.paused : null,
      cur: m ? Number(m.currentTime.toFixed(2)) : null,
      readyState: m ? m.readyState : null,
    };
  });
const evCount = (p: Page, name: string) =>
  p.evaluate((n) => ((window as unknown as { __pp: { ev: { k: string }[] } }).__pp.ev).filter((e) => e.k === n).length, name);

async function scenario(variant: "A" | "B", ctxApi: { stamp: string; playlistId: string }, browser: import("playwright").Browser, api: import("playwright").APIRequestContext) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.addInitScript({ content: INSTRUMENT_JS });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // hold every device-media response until released
  let release: () => void = () => undefined;
  const gate = new Promise<void>((r) => { release = r; });
  let held = 0;
  await page.route(/\/api\/device\/media\//, async (route) => {
    held++;
    await gate;
    await route.continue();
  });

  await page.goto(`${BASE}/player`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-activation-code]", { timeout: 30000 });
  const code = (await page.locator("[data-activation-code]").getAttribute("data-activation-code")) ?? "";
  const dev = `P2A${variant}-${ctxApi.stamp.toUpperCase()}`;
  assert.equal((await api.post(`${BASE}/api/admin/devices`, { data: { activationCode: code, name: `PP02A ${variant} ${ctxApi.stamp}`, deviceCode: dev } })).status(), 200);
  const devs = (await (await api.get(`${BASE}/api/admin/devices`)).json()) as { devices: { id: string; deviceCode: string }[] };
  const did = devs.devices.find((d) => d.deviceCode === dev)!.id;
  assert.equal((await api.post(`${BASE}/api/admin/devices/${did}/assign`, { data: { playlistId: ctxApi.playlistId } })).status(), 200);

  // wait for the video element to exist while its media request is held (LOADING, no metadata)
  const t0 = Date.now();
  let s = await snap(page);
  while (Date.now() - t0 < 30000 && !(s.videos === 1 && s.readyState === 0 && held > 0)) {
    await page.waitForTimeout(150);
    s = await snap(page);
  }
  check(`${variant}-00 precondition: video element in LOADING with its media request held`, s.videos === 1 && s.readyState === 0 && s.status === "LOADING" && held > 0, JSON.stringify(s));
  const genBefore = s.gen;
  const metaBefore = await evCount(page, "loadedmetadata");

  await page.mouse.move(640, 600);
  await page.locator('[data-playback-controls] button[aria-label="Stop"]').first().click({ force: true });
  await page.waitForTimeout(400);
  const stopped = await snap(page);
  check(`${variant}-01 STOP during loading (before canplay) -> STOPPED`, stopped.status === "STOPPED" && stopped.readyState === 0, JSON.stringify(stopped));

  if (variant === "B") {
    await page.locator('[data-playback-controls] button[aria-label="Next"]').first().click({ force: true });
    await page.waitForTimeout(500);
    const nx = await snap(page);
    check("B-02 NEXT after STOP changes generation and moves to the image item", nx.gen > genBefore && nx.idx === 1, JSON.stringify(nx));
  }

  release(); // loadedmetadata / loadeddata / canplay now arrive late (real native events)
  await page.waitForTimeout(3000);
  const metaAfter = await evCount(page, "loadedmetadata");
  const after = await snap(page);

  if (variant === "A") {
    check("A-02 late native events really arrived (loadedmetadata fired after STOP)", metaAfter > metaBefore, `before=${metaBefore} after=${metaAfter}`);
    check("A-03 no spontaneous playback: STOPPED, element paused, time 0", after.status === "STOPPED" && after.paused === true && (after.cur ?? 9) < 0.3 && !after.anyVideoPlaying, JSON.stringify(after));
    check("A-04 generation unchanged (nothing re-armed the item)", after.gen === genBefore + 0 || after.gen === stopped.gen, `gen before=${genBefore} stop=${stopped.gen} after=${after.gen}`);
    await page.locator('[data-playback-controls] button[aria-label="Play"]').first().click({ force: true });
    await page.waitForTimeout(1500);
    const pl = await snap(page);
    check("A-05 Play afterwards starts normally", pl.status === "PLAYING" && pl.paused === false, JSON.stringify(pl));
  } else {
    check("B-03 late events of the old generation did not touch the new item (still PLAYING the image)", after.status === "PLAYING" && after.idx === 1 && after.kind === "still" && !after.anyVideoPlaying, JSON.stringify(after));
    // let the playlist wrap back to the video: it must play normally (nothing left over)
    const t1 = Date.now();
    let w = after;
    while (Date.now() - t1 < 15000 && !(w.idx === 0 && w.kind === "video" && w.paused === false)) {
      await page.waitForTimeout(300);
      w = await snap(page);
    }
    check("B-04 playlist wraps to the video and it plays normally afterwards", w.idx === 0 && w.status === "PLAYING" && w.paused === false, JSON.stringify(w));
  }
  check(`${variant}-99 no page errors`, errors.length === 0, errors.join(" | ").slice(0, 150));
  await page.screenshot({ path: `${OUT}/stop-loading-${variant}.png` });
  await ctx.close();
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", args: ["--autoplay-policy=document-user-activation-required"] });
  const ctx = await browser.newContext();
  const api = ctx.request;
  assert.equal((await api.post(`${BASE}/api/auth/login`, { data: { email: seed.tenants.ok.users.ADMIN, password: seed.password } })).status(), 200);
  const stamp = Date.now().toString(36);
  const mk = async (title: string, type: string, file: Buffer, mime: string, ext: string, durationMs: string) => {
    const r = await api.post(`${BASE}/api/admin/contents`, {
      multipart: { file: { name: `${title}.${ext}`, mimeType: mime, buffer: file }, type, title, durationMs },
    });
    assert.equal(r.status(), 200, `upload ${title}: ${r.status()}`);
    return ((await r.json()) as { id: string }).id;
  };
  const vid = await mk(`VID ${stamp}`, "VIDEO", SAMPLE, "video/mp4", "mp4", "0");
  const img = await mk(`IMG ${stamp}`, "IMAGE", png(), "image/png", "png", "3000");
  const pl = await api.post(`${BASE}/api/admin/playlists`, { data: { name: `PP02A ${stamp}` } });
  const playlistId = ((await pl.json()) as { id: string }).id;
  for (const c of [vid, img]) await api.patch(`${BASE}/api/admin/playlists`, { data: { action: "add_item", playlistId, contentId: c } });

  await scenario("A", { stamp, playlistId }, browser, api);
  await scenario("B", { stamp, playlistId }, browser, api);
  await browser.close();

  const failed = rows.filter((r) => !r.ok);
  fs.writeFileSync(`${OUT}/stop-loading-results.json`, JSON.stringify({ at: new Date().toISOString(), rows }, null, 1));
  console.log(`\n${rows.length - failed.length}/${rows.length} PASS`);
  if (failed.length) { console.log("FAILED:", failed.map((x) => x.id).join("; ")); process.exit(1); }
}

main().catch((e) => { console.error(e); process.exit(2); });

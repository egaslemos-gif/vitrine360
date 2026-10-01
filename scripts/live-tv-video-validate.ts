/**
 * Smart TV runtime (public/tv.js) — live video validation in a real browser.
 *
 * Pairs the real /tv.html as a device, gives it a playlist [NATURAL video, FIXED-window video]
 * and checks that video actually plays, that natural vs fixed durations are not confused,
 * that the playlist repeats, and that the media proxy is hit with HTTP Range (206).
 *
 * Throwaway DB + local storage only:
 *   DATABASE_URL=file:./data/authz02-e2e.db MEDIA_STORAGE_PROVIDER=local \
 *   MEDIA_LOCAL_DIR=./data/authz02-media npx next start -p 3150
 *   BASE_URL=http://localhost:3150 npx tsx scripts/live-tv-video-validate.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3150";
const seed = JSON.parse(fs.readFileSync("data/authz02-e2e-seed.json", "utf8")) as {
  password: string;
  tenants: { ok: { users: { ADMIN: string } } };
};

const rows: { id: string; ok: boolean; detail: string }[] = [];
function check(id: string, ok: boolean, detail = "") {
  rows.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? " — " + detail : ""}`);
}

const SAMPLE = path.join(process.cwd(), "public", "hw-sample.mp4"); // real H.264 MP4

async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const api = ctx.request;

  const login = await api.post(`${BASE}/api/auth/login`, {
    data: { email: seed.tenants.ok.users.ADMIN, password: seed.password },
  });
  assert.equal(login.status(), 200, "admin login");

  // natural length of the real sample, measured by the browser itself
  const probe = await ctx.newPage();
  await probe.goto(`${BASE}/admin/login`);
  const naturalS = await probe.evaluate(
    (u) =>
      new Promise<number>((resolve) => {
        const v = document.createElement("video");
        v.preload = "metadata";
        v.onloadedmetadata = () => resolve(v.duration);
        v.onerror = () => resolve(0);
        v.src = u;
      }),
    `${BASE}/hw-sample.mp4`,
  );
  await probe.close();
  assert.ok(naturalS > 1 && Number.isFinite(naturalS), `sample length ${naturalS}`);
  const FIXED_WINDOW_MS = Math.round(naturalS * 1.8 * 1000); // longer than the media → must loop
  console.log(`sample natural length ${naturalS.toFixed(1)} s, fixed window ${(FIXED_WINDOW_MS / 1000).toFixed(1)} s`);
  const buf = fs.readFileSync(SAMPLE);
  const stamp = Date.now().toString(36);
  const mk = async (title: string) => {
    const r = await api.post(`${BASE}/api/admin/contents`, {
      multipart: {
        file: { name: `${title}.mp4`, mimeType: "video/mp4", buffer: buf },
        type: "VIDEO",
        title,
        durationMs: "0",
      },
    });
    assert.equal(r.status(), 200, `content ${title}: ${r.status()} ${await r.text()}`);
    return ((await r.json()) as { id: string }).id;
  };
  const natural = await mk(`Natural ${stamp}`);
  const fixedC = await mk(`Janela ${stamp}`);

  const pl = await api.post(`${BASE}/api/admin/playlists`, { data: { name: `TV video ${stamp}` } });
  const playlistId = ((await pl.json()) as { id: string }).id;
  await api.patch(`${BASE}/api/admin/playlists`, { data: { action: "add_item", playlistId, contentId: natural } });
  await api.patch(`${BASE}/api/admin/playlists`, {
    data: { action: "add_item", playlistId, contentId: fixedC, durationOverrideMs: FIXED_WINDOW_MS },
  });

  // the real Smart TV runtime, paired through the real flow
  const page = await ctx.newPage();
  const media: { status: number; range: string | null; url: string }[] = [];
  page.on("response", (res) => {
    const u = res.url();
    if (u.includes("/api/device/media/") || u.includes("/api/media/")) {
      media.push({ status: res.status(), range: res.request().headers()["range"] ?? null, url: u.replace(/token=[^&]+/, "token=***") });
    }
  });
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await page.goto(`${BASE}/tv.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".code", { timeout: 20000 });
  const code = (await page.locator(".code").innerText()).replace(/\D/g, "");
  assert.equal(code.length, 6, `activation code "${code}"`);

  const pair = await api.post(`${BASE}/api/admin/devices`, {
    data: { activationCode: code, name: `TV ${stamp}`, deviceCode: `TVV-${stamp.toUpperCase()}` },
  });
  assert.equal(pair.status(), 200, `pair ${pair.status()} ${await pair.text()}`);
  const devs = (await (await api.get(`${BASE}/api/admin/devices`)).json()) as { devices: { id: string; deviceCode: string }[] };
  const dev = devs.devices.find((d) => d.deviceCode === `TVV-${stamp.toUpperCase()}`);
  assert.ok(dev, "device listed");
  const as = await api.post(`${BASE}/api/admin/devices/${dev!.id}/assign`, { data: { playlistId } });
  assert.equal(as.status(), 200, "assign playlist");

  // observe 40 s: which video is on screen, is it advancing, when does it change
  type Sample = { t: number; vid: number; src: string; cur: number; ready: number; shown: boolean; paused: boolean };
  const samples: Sample[] = [];
  const idle = new Map<string, number>();
  const t0 = Date.now();
  const OBSERVE_MS = Math.min(100000, Math.round((naturalS * 2 + FIXED_WINDOW_MS / 1000 + 10) * 1000));
  while (Date.now() - t0 < OBSERVE_MS) {
    const s = await page.evaluate(() => {
      const v = document.getElementById("v360-video") as HTMLVideoElement | null;
      if (!v) return null;
      const layer = v.parentElement as HTMLElement;
      // New <video> per slide; loops inside a fixed window reuse the same element.
      const w = window as unknown as { __vid?: number };
      const el = v as unknown as { __id?: number };
      if (!el.__id) el.__id = (w.__vid = (w.__vid ?? 0) + 1);
      return { vid: el.__id, src: v.currentSrc || v.src, cur: v.currentTime, ready: v.readyState, shown: layer.style.left === "0px", paused: v.paused };
    });
    if (s) samples.push({ t: Date.now() - t0, ...s });
    else {
      const txt = await page.evaluate(() => (document.getElementById("root")?.innerText ?? "").replace(/\s+/g, " ").slice(0, 70));
      idle.set(txt, (idle.get(txt) ?? 0) + 1);
    }
    await page.waitForTimeout(500);
  }

  console.log("screen when no <video>:", JSON.stringify([...idle.entries()]));
  console.log("video samples:", JSON.stringify(samples.slice(0, 12).map((x) => [x.t, Math.round(x.cur * 10) / 10, x.ready, x.shown, x.paused])));
  const shown = samples.filter((s) => s.shown && s.cur > 0.5);
  check("TV-VIDEO-01: a video becomes visible and advances", shown.length > 4, `visible+advancing samples=${shown.length}/${samples.length}`);
  const firstShown = samples.find((s) => s.shown && s.cur > 0);
  check("TV-VIDEO-02: first frame within 10 s", !!firstShown && firstShown.t < 10000, `firstShown at ${firstShown?.t} ms`);

  // Items = distinct <video> elements; media loops inside a FIXED window = same element.
  const items: { vid: number; from: number; to: number; loops: number }[] = [];
  for (const sm of samples) {
    const cur = items[items.length - 1];
    if (!cur || cur.vid !== sm.vid) items.push({ vid: sm.vid, from: sm.t, to: sm.t, loops: 0 });
    else cur.to = sm.t;
  }
  let prevCur = -1;
  let prevVid = -1;
  for (const sm of samples) {
    if (sm.vid === prevVid && prevCur > 1.0 && sm.cur < 0.6) items[items.findIndex((i) => i.vid === sm.vid)]!.loops += 1;
    prevCur = sm.cur;
    prevVid = sm.vid;
  }
  const lasted = (i: number) => (items[i + 1] ? items[i + 1]!.from - items[i]!.from : items[i]!.to - items[i]!.from) / 1000;
  console.log("items:", JSON.stringify(items.map((it, i) => ({ item: i + 1, lasted: Number(lasted(i).toFixed(1)), loops: it.loops }))));

  check("TV-REPEAT-01: playlist repeats (3+ item starts, A→B→A)", items.length >= 3, `items=${items.length}`);
  if (items.length >= 3) {
    const w = FIXED_WINDOW_MS / 1000;
    check("TV-DURATION-01: NATURAL item ends with the media (not a fixed default)", Math.abs(lasted(0) - naturalS) < 2.5 && items[0]!.loops === 0, `lasted ${lasted(0).toFixed(1)} s (media ${naturalS.toFixed(1)} s), loops=${items[0]!.loops}`);
    check("TV-DURATION-02: FIXED window honoured: longer than the media, media loops inside it", Math.abs(lasted(1) - w) < 3 && lasted(1) > naturalS + 1 && items[1]!.loops >= 1, `lasted ${lasted(1).toFixed(1)} s (window ${w.toFixed(1)} s, media ${naturalS.toFixed(1)} s), loops=${items[1]!.loops}`);
    check("TV-DURATION-03: after the fixed window the playlist wraps back to the natural item", Math.abs(lasted(2) - naturalS) < 2.5, `third item lasted ${lasted(2).toFixed(1)} s`);
  } else {
    check("TV-DURATION: enough items to measure", false, `items=${items.length}`);
  }

  const ranged = media.filter((m) => m.url.includes("/api/device/media/"));
  check("TV-RANGE-01: proxy served video as 206 Partial Content", ranged.some((m) => m.status === 206), `proxy responses=${ranged.map((m) => m.status).join(",") || "none"}`);
  check("TV-RANGE-02: no 4xx/5xx from the media proxy", ranged.every((m) => m.status < 400), "");
  check("TV-ERR-01: no page errors", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 160));
  const lastErr = await page.evaluate(() => localStorage.getItem("v360-tv-last-media-error"));
  check("TV-ERR-02: no media failure recorded", !lastErr, lastErr ?? "");

  await page.screenshot({ path: "data/tv-video-validate.png" });
  await browser.close();

  const failed = rows.filter((r) => !r.ok);
  console.log(`\n${rows.length - failed.length}/${rows.length} PASS`);
  if (failed.length) {
    console.log("FAILED:", failed.map((f) => f.id).join("; "));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

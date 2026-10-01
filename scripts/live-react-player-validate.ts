/**
 * Browser (React) player — live validation in a real Chrome.
 *
 * Playlist: [NATURAL video, BROKEN video, FIXED-window video]. Checks that
 *  - video plays through the Range proxy and natural vs fixed durations are not confused;
 *  - a failing item is retried once and then SKIPPED (the playlist never freezes);
 *  - the playlist repeats by default;
 *  - controls/HUD use the translucent glass style (content stays visible);
 *  - keyboard seek (←/→ ±5 s) and fullscreen-on-first-gesture work.
 *
 *   DATABASE_URL=file:./data/authz02-e2e.db MEDIA_STORAGE_PROVIDER=local \
 *   MEDIA_LOCAL_DIR=./data/authz02-media npx next start -p 3150
 *   BASE_URL=http://localhost:3150 npx tsx scripts/live-react-player-validate.ts
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
const SAMPLE = path.join(process.cwd(), "public", "hw-sample.mp4");

const rows: { id: string; ok: boolean; detail: string }[] = [];
function check(id: string, ok: boolean, detail = "") {
  rows.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? " — " + detail : ""}`);
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", args: ["--autoplay-policy=no-user-gesture-required"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const api = ctx.request;
  const login = await api.post(`${BASE}/api/auth/login`, {
    data: { email: seed.tenants.ok.users.ADMIN, password: seed.password },
  });
  assert.equal(login.status(), 200, "admin login");

  // natural length of the real sample
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
  assert.ok(naturalS > 1, "sample length");
  const WINDOW_MS = Math.round(naturalS * 1.8 * 1000);

  const good = fs.readFileSync(SAMPLE);
  // "broken" = valid MP4 signature (accepted by the upload sniffing) followed by garbage → decode error
  const broken = Buffer.concat([good.subarray(0, 32), Buffer.alloc(200_000, 0x7f)]);
  const stamp = Date.now().toString(36);
  const mk = async (title: string, buffer: Buffer) => {
    const r = await api.post(`${BASE}/api/admin/contents`, {
      multipart: { file: { name: `${title}.mp4`, mimeType: "video/mp4", buffer }, type: "VIDEO", title, durationMs: "0" },
    });
    assert.equal(r.status(), 200, `content ${title}: ${r.status()} ${await r.text()}`);
    return ((await r.json()) as { id: string }).id;
  };
  const a = await mk(`A natural ${stamp}`, good);
  const bad = await mk(`B quebrado ${stamp}`, broken);
  const c = await mk(`C janela ${stamp}`, good);
  const pl = await api.post(`${BASE}/api/admin/playlists`, { data: { name: `React player ${stamp}` } });
  const playlistId = ((await pl.json()) as { id: string }).id;
  for (const [contentId, ms] of [[a, undefined], [bad, undefined], [c, WINDOW_MS]] as const) {
    await api.patch(`${BASE}/api/admin/playlists`, {
      data: { action: "add_item", playlistId, contentId, ...(ms ? { durationOverrideMs: ms } : {}) },
    });
  }

  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const proxy: number[] = [];
  page.on("response", (res) => {
    if (res.url().includes("/api/device/media/")) proxy.push(res.status());
  });
  await page.goto(`${BASE}/player`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-activation-code]", { timeout: 30000 });
  const code = (await page.locator("[data-activation-code]").getAttribute("data-activation-code")) ?? "";
  assert.equal(code.length, 6, `code "${code}"`);
  check("PAIR-UI: activation code shown in individual boxes", (await page.locator("[data-activation-code] > span").count()) === 6);

  const stampDev = `RP-${stamp.toUpperCase()}`;
  const pair = await api.post(`${BASE}/api/admin/devices`, { data: { activationCode: code, name: `Browser ${stamp}`, deviceCode: stampDev } });
  assert.equal(pair.status(), 200, `pair ${pair.status()}`);
  const devs = (await (await api.get(`${BASE}/api/admin/devices`)).json()) as { devices: { id: string; deviceCode: string }[] };
  const dev = devs.devices.find((d) => d.deviceCode === stampDev)!;
  assert.equal((await api.post(`${BASE}/api/admin/devices/${dev.id}/assign`, { data: { playlistId } })).status(), 200);

  type S = { t: number; id: number; cur: number; loop: boolean; err: boolean; status: string };
  const samples: S[] = [];
  const t0 = Date.now();
  const OBSERVE_MS = Math.round((naturalS * 3 + WINDOW_MS / 1000 + 22) * 1000);
  let gestureDone = false;
  while (Date.now() - t0 < OBSERVE_MS) {
    const s = await page.evaluate(() => {
      const v = document.querySelector("video.player-media") as HTMLVideoElement | null;
      const st = document.querySelector("[data-playback-status]")?.getAttribute("data-playback-status") ?? "";
      if (!v) return { id: 0, cur: 0, loop: false, err: false, status: st };
      const el = v as unknown as { __id?: number };
      const w = window as unknown as { __vid?: number };
      if (!el.__id) el.__id = (w.__vid = (w.__vid ?? 0) + 1);
      return { id: el.__id, cur: v.currentTime, loop: v.loop, err: !!v.error, status: st };
    });
    samples.push({ t: Date.now() - t0, ...s });
    if (!gestureDone && samples.some((x) => x.id && x.cur > 0.3)) {
      gestureDone = true;
      await page.mouse.click(640, 360); // first user gesture → default full screen + show controls
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(400);
  }

  const tl: string[] = [];
  let lastSt = "";
  for (const x of samples) {
    if (x.status !== lastSt) { tl.push(`${(x.t / 1000).toFixed(1)}s:${x.status || "-"}`); lastSt = x.status; }
  }
  console.log("status timeline:", tl.join(" "));
  // ── playback / durations / repeat ──
  const withVideo = samples.filter((x) => x.id && x.cur > 0.5);
  check("REACT-VIDEO-01: video plays and advances", withVideo.length > 5, `advancing samples=${withVideo.length}`);
  const segs: { id: number; from: number; loops: number; maxLoop: boolean }[] = [];
  let prev: S | null = null;
  for (const x of samples) {
    if (!x.id) continue;
    if (!segs.length || segs[segs.length - 1]!.id !== x.id) segs.push({ id: x.id, from: x.t, loops: 0, maxLoop: x.loop });
    else if (prev && prev.id === x.id && prev.cur > 1 && x.cur < 0.6) segs[segs.length - 1]!.loops += 1;
    if (x.loop) segs[segs.length - 1]!.maxLoop = true;
    prev = x;
  }
  console.log("segments:", JSON.stringify(segs.map((s, i) => ({ n: i + 1, from: s.from, lasted: segs[i + 1] ? segs[i + 1]!.from - s.from : null, loops: s.loops, loopAttr: s.maxLoop }))));
  check("REACT-REPEAT-01: playlist progresses and repeats by default (A → … → A)", segs.length >= 4, `distinct video elements=${segs.length}`);
  const lastedMs = (i: number) => (segs[i + 1] ? segs[i + 1]!.from - segs[i]!.from : 0);
  if (segs.length >= 2) {
    check("REACT-DURATION-01: NATURAL item ends with the media", Math.abs(lastedMs(0) / 1000 - naturalS) < 3, `lasted ${(lastedMs(0) / 1000).toFixed(1)} s (media ${naturalS.toFixed(1)} s)`);
  }
  const fixedSeg = segs.findIndex((s) => s.maxLoop);
  check("REACT-DURATION-02: FIXED window loops the media inside the window", fixedSeg >= 0, `loop attr seen on segment ${fixedSeg + 1}`);
  if (fixedSeg >= 0 && segs[fixedSeg + 1]) {
    const d = lastedMs(fixedSeg) / 1000;
    check("REACT-DURATION-03: FIXED window length honoured (longer than the media)", Math.abs(d - WINDOW_MS / 1000) < 3 && d > naturalS + 1, `lasted ${d.toFixed(1)} s (window ${(WINDOW_MS / 1000).toFixed(1)} s)`);
  }
  const sawError = samples.some((x) => x.status === "ERROR");
  check("REACT-RECOVERY-01: broken item reached ERROR and the playlist did NOT freeze", sawError && withVideo.length > 5 && segs.length >= 3, `sawError=${sawError} segments=${segs.length}`);
  const errStreak = (() => {
    let best = 0;
    let start = -1;
    for (const x of samples) {
      if (x.status === "ERROR") {
        if (start < 0) start = x.t;
        best = Math.max(best, x.t - start);
      } else start = -1;
    }
    return best;
  })();
  check("REACT-RECOVERY-02: no ERROR state parked longer than ~12 s (retry + skip)", errStreak < 12000, `longest ERROR streak ${(errStreak / 1000).toFixed(1)} s`);
  check("REACT-RANGE-01: video served as 206 by the proxy", proxy.includes(206), `proxy statuses=${[...new Set(proxy)].join(",")}`);

  // ── glass UI (content must stay visible) ──
  await page.mouse.move(600, 300);
  await page.waitForTimeout(500);
  const glass = await page.evaluate(() => {
    const pick = ["[data-playback-controls]", "[data-display-identity-hud]"].map((sel) => {
      const e = document.querySelector(sel) as HTMLElement | null;
      if (!e) return null;
      const cs = getComputedStyle(e);
      const m = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor);
      const alpha = m ? Number((m[1].split(",")[3] ?? "1").trim()) : 1;
      const r = e.getBoundingClientRect();
      const bf = cs.backdropFilter || "";
      return { alpha, blur: /blur/.test(bf), w: Math.round(r.width), h: Math.round(r.height) };
    });
    return { controls: pick[0], hud: pick[1], vh: window.innerHeight };
  });
  console.log("glass:", JSON.stringify(glass));
  check("GLASS-01: controls are translucent (alpha ≤ 0.5) with backdrop blur", !!glass.controls && glass.controls.alpha <= 0.5 && glass.controls.blur, JSON.stringify(glass.controls));
  check("GLASS-02: HUD is translucent with backdrop blur", !!glass.hud && glass.hud.alpha <= 0.5 && glass.hud.blur, JSON.stringify(glass.hud));
  check("GLASS-03: controls are compact (≤ 130 px tall, ≤ 800 px wide)", !!glass.controls && glass.controls.h <= 130 && glass.controls.w <= 800, `${glass.controls?.w}x${glass.controls?.h}`);
  await page.screenshot({ path: "data/react-player-glass.png" });

  // ── fullscreen on first gesture ──
  const fs1 = await page.evaluate(() => !!document.fullscreenElement);
  check("FULLSCREEN-01: entered full screen on the first user gesture (default)", fs1, `fullscreenElement=${fs1}`);

  // ── keyboard seek (VLC-like) on a natural item ──
  await page.keyboard.press("Escape").catch(() => undefined);
  const seekOk = await page.evaluate(async () => {
    const root = document.querySelector("[data-playback-chrome]") as HTMLElement | null;
    root?.focus();
    for (let i = 0; i < 80; i++) {
      const v = document.querySelector("video.player-media") as HTMLVideoElement | null;
      if (v && !v.loop && v.duration > 3 && v.currentTime > 3 && v.currentTime < v.duration - 0.8) {
        const before = v.currentTime;
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
        await new Promise((r) => setTimeout(r, 600));
        const same = document.querySelector("video.player-media") === v;
        return { before, after: v.currentTime, sameElement: same };
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    return null;
  });
  check("KEY-01: ArrowLeft seeks back ~5 s inside the same item (not previous item)", !!seekOk && seekOk.sameElement && seekOk.before - seekOk.after > 2, JSON.stringify(seekOk));

  check("REACT-ERR-01: no uncaught page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
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

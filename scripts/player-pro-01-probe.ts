/**
 * PLAYER-PRO-01 — read-only diagnostic probe for the React player (no source changes).
 *
 * Uses Chrome with the REAL autoplay policy (document-user-activation-required) — the earlier
 * live tests forced no-user-gesture-required, which hides audio/autoplay defects.
 * Instrumentation is injected from outside (addInitScript) and records media events, play()
 * rejections and muted/paused state. No tokens are logged (token query is masked).
 *
 *   DATABASE_URL=file:./data/authz02-e2e.db MEDIA_STORAGE_PROVIDER=local \
 *   MEDIA_LOCAL_DIR=./data/authz02-media npx next start -p 3150
 *   BASE_URL=http://localhost:3150 npx tsx scripts/player-pro-01-probe.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { chromium, type Page } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3150";
const OUT = process.env.PROBE_OUT ?? "docs/evidence/player-pro-01";
const seed = JSON.parse(fs.readFileSync("data/authz02-e2e-seed.json", "utf8")) as {
  password: string;
  tenants: { ok: { users: { ADMIN: string } } };
};
const SAMPLE = fs.readFileSync(path.join(process.cwd(), "public", "hw-sample.mp4"));

const findings: { id: string; ok: boolean; detail: string }[] = [];
function rec(id: string, ok: boolean, detail = "") {
  findings.push({ id, ok, detail });
  console.log(`${ok ? "OK  " : "DEFECT"} ${id}${detail ? " — " + detail : ""}`);
}

// ── tiny media fixtures generated in-process ───────────────────────────────
function crc32(buf: Buffer) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]!) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function png(w: number, h: number, rgb: [number, number, number]) {
  const chunk = (t: string, d: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t), d]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
// 2-frame 1x1 GIF89a
const GIF = Buffer.from("R0lGODlhAQABAIAAAP///wAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQJCgAAACwAAAAAAQABAAACAkQBADs=", "base64");
function wav(seconds: number) {
  const rate = 8000, n = rate * seconds;
  const data = Buffer.alloc(n);
  for (let i = 0; i < n; i++) data[i] = 128 + Math.round(40 * Math.sin((i / rate) * 2 * Math.PI * 440));
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + n, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate, 28);
  h.writeUInt16LE(1, 32); h.writeUInt16LE(8, 34); h.write("data", 36); h.writeUInt32LE(n, 40);
  return Buffer.concat([h, data]);
}

const INSTRUMENT_JS = fs.readFileSync(path.join(OUT, "instrument.js"), "utf8");

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", args: ["--autoplay-policy=document-user-activation-required"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const api = ctx.request;
  assert.equal((await api.post(`${BASE}/api/auth/login`, { data: { email: seed.tenants.ok.users.ADMIN, password: seed.password } })).status(), 200);

  const stamp = Date.now().toString(36);
  const mk = async (title: string, type: string, file: Buffer, mime: string, ext: string, durationMs: string) => {
    const r = await api.post(`${BASE}/api/admin/contents`, {
      multipart: { file: { name: `${title}.${ext}`, mimeType: mime, buffer: file }, type, title, durationMs },
    });
    if (r.status() !== 200) { console.log(`upload ${type} -> ${r.status()} ${(await r.text()).slice(0, 120)}`); return null; }
    return ((await r.json()) as { id: string }).id;
  };
  const img = await mk(`IMG ${stamp}`, "IMAGE", png(64, 36, [200, 60, 60]), "image/png", "png", "4000");
  const gif = await mk(`GIF ${stamp}`, "GIF", GIF, "image/gif", "gif", "3000");
  const vid = await mk(`VID ${stamp}`, "VIDEO", SAMPLE, "video/mp4", "mp4", "0");
  const aud = await mk(`AUD ${stamp}`, "AUDIO", wav(5), "audio/wav", "wav", "0");
  console.log("fixtures:", { img: !!img, gif: !!gif, vid: !!vid, aud: !!aud });

  const pl = await api.post(`${BASE}/api/admin/playlists`, { data: { name: `PP01 ${stamp}` } });
  const playlistId = ((await pl.json()) as { id: string }).id;
  for (const c of [vid, img, gif, aud].filter(Boolean)) {
    await api.patch(`${BASE}/api/admin/playlists`, { data: { action: "add_item", playlistId, contentId: c } });
  }

  const SIM = process.env.SIM_POLICY === "1";
  const page = await ctx.newPage();
  if (SIM) await page.addInitScript({ content: "window.__SIM = true;" });
  await page.addInitScript({ content: INSTRUMENT_JS });
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}/player`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-activation-code]", { timeout: 30000 });
  const code = (await page.locator("[data-activation-code]").getAttribute("data-activation-code")) ?? "";
  const dev = `PP-${stamp.toUpperCase()}`;
  assert.equal((await api.post(`${BASE}/api/admin/devices`, { data: { activationCode: code, name: `PP01 ${stamp}`, deviceCode: dev } })).status(), 200);
  const devs = (await (await api.get(`${BASE}/api/admin/devices`)).json()) as { devices: { id: string; deviceCode: string }[] };
  const did = devs.devices.find((d) => d.deviceCode === dev)!.id;
  assert.equal((await api.post(`${BASE}/api/admin/devices/${did}/assign`, { data: { playlistId } })).status(), 200);

  const snap = (p: Page) =>
    p.evaluate(() => {
      const root = document.querySelector("[data-playback-status]");
      const m = document.querySelector("video") as HTMLVideoElement | null;
      return {
        status: root?.getAttribute("data-playback-status") ?? "-",
        idx: root?.getAttribute("data-playback-index") ?? "-",
        kind: document.querySelector("[data-media-kind]")?.getAttribute("data-media-kind") ?? "-",
        paused: m?.paused ?? null, muted: m?.muted ?? null, cur: m ? Number(m.currentTime.toFixed(2)) : null,
        ended: m?.ended ?? null, vol: m?.volume ?? null,
        btnPlay: document.querySelector('[data-playback-controls] button[aria-label="Pause"], [data-playback-controls] button[aria-label="Play"]')?.getAttribute("aria-label") ?? "-",
        btnMute: document.querySelector('[data-playback-controls] button[aria-label="Mute"], [data-playback-controls] button[aria-label="Unmute"]')?.getAttribute("aria-label") ?? "-",
      };
    });
  const waitKind = async (kind: string, ms = 30000) => {
    const t = Date.now();
    while (Date.now() - t < ms) { if ((await snap(page)).kind === kind) return true; await page.waitForTimeout(250); }
    return false;
  };

  // ── A. autoplay BEFORE any user gesture (real signage boot) ──────────────
  await waitKind("video", 25000);
  await page.waitForTimeout(2500);
  const a0 = await snap(page);
  console.log("A0 (no gesture):", JSON.stringify(a0));
  rec("A1 video starts without gesture", a0.status === "PLAYING" && a0.paused === false, JSON.stringify(a0));
  rec("A2 audio state honest: UI says audible vs element muted", !(a0.muted === true && a0.btnMute === "Mute"), `element.muted=${a0.muted} button="${a0.btnMute}" (UI claims audible while element is silent)`);

  if (SIM) {
    const s0 = await snap(page);
    await page.waitForTimeout(1500);
    const sBefore = await snap(page);
    console.log("SIM before gesture:", JSON.stringify(sBefore));
    rec("S1 SIM: blocked-audio start is NOT presented as audible (UI mute state == element)", sBefore.muted === false || sBefore.btnMute === "Unmute", `element.muted=${sBefore.muted} button=${sBefore.btnMute} paused=${sBefore.paused} status=${sBefore.status}`);
    rec("S2 SIM: logical PLAYING matches physical playing", sBefore.status !== "PLAYING" || sBefore.paused === false, JSON.stringify(sBefore));
    await page.mouse.click(640, 360);
    await page.waitForTimeout(1200);
    const sAfter = await snap(page);
    console.log("SIM after gesture:", JSON.stringify(sAfter), "s0", JSON.stringify(s0));
    rec("S3 SIM: first user gesture restores audio automatically", sAfter.muted === false && sAfter.paused === false, JSON.stringify(sAfter));
    await page.mouse.move(640, 600);
    await page.locator('[data-playback-controls] button[aria-label="Pause"]').first().click({ force: true });
    await page.waitForTimeout(500);
    await page.locator('[data-playback-controls] button[aria-label="Play"]').first().click({ force: true });
    await page.waitForTimeout(1500);
    const sFix = await snap(page);
    rec("S4 SIM: manual Pause→Play (2 clicks) is the only recovery", sFix.paused === false, JSON.stringify(sFix));
    const evs = await page.evaluate(() => (window as unknown as { __pp: { ev: { t: number; k: string; d: string }[] } }).__pp.ev.slice(0, 30));
    fs.writeFileSync(`${OUT}/probe-sim-events.json`, JSON.stringify(evs, null, 1));
    const rej0 = await page.evaluate(() => (window as unknown as { __pp: { playRej: string[] } }).__pp.playRej);
    console.log("SIM play() rejections:", JSON.stringify(rej0));
    fs.writeFileSync(`${OUT}/probe-sim-results.json`, JSON.stringify({ at: new Date().toISOString(), findings, rej: rej0 }, null, 1));
    await browser.close();
    return;
  }

  // ── B. controls (with a user gesture now) ────────────────────────────────
  await page.mouse.click(640, 360);
  await page.waitForTimeout(600);
  const b0 = await snap(page);
  console.log("B0 (after first click):", JSON.stringify(b0));
  rec("B1 click anywhere does not leave video paused", b0.paused === false, JSON.stringify(b0));

  const btn = (label: string) => page.locator(`[data-playback-controls] button[aria-label="${label}"]`).first();
  await page.mouse.move(640, 600);
  await page.waitForTimeout(300);

  // pause -> must stay paused
  await btn("Pause").click({ force: true });
  await page.waitForTimeout(600);
  const p1 = await snap(page);
  rec("C1 Pause pauses element", p1.status === "PAUSED" && p1.paused === true, JSON.stringify(p1));
  // seek while paused via keyboard (rootfocus) then see if it silently resumes
  await page.locator("[data-playback-chrome]").focus();
  await page.keyboard.press("Home"); // PRO-02: Home (not +5 s) so the seek cannot run past the end of the sample
  await page.waitForTimeout(1500);
  const p2 = await snap(page);
  rec("C2 seek while PAUSED keeps element paused (no resume)", p2.status === "PAUSED" && p2.paused === true, JSON.stringify(p2));
  // Stop -> must stay stopped
  await btn("Play").click({ force: true });
  await page.waitForTimeout(600);
  await btn("Stop").click({ force: true });
  await page.waitForTimeout(1800);
  const s1 = await snap(page);
  rec("C3 Stop leaves element stopped (no auto-resume on canplay)", s1.status === "STOPPED" && s1.paused === true, JSON.stringify(s1));
  await btn("Play").click({ force: true });
  await page.waitForTimeout(1200);
  const s2 = await snap(page);
  rec("C4 Play after Stop restarts playback", s2.status === "PLAYING" && s2.paused === false, JSON.stringify(s2));

  // mute / volume
  await btn("Mute").click({ force: true });
  await page.waitForTimeout(400);
  const m1 = await snap(page);
  rec("D1 Mute silences element", m1.muted === true && m1.btnMute === "Unmute", JSON.stringify(m1));
  await btn("Unmute").click({ force: true });
  await page.waitForTimeout(800);
  const m2 = await snap(page);
  rec("D2 Unmute restores audio & keeps playing", m2.muted === false && m2.paused === false, JSON.stringify(m2));
  await page.locator('[data-playback-controls] input[aria-label="Volume"]').fill("30");
  await page.waitForTimeout(400);
  const v1 = await snap(page);
  rec("D3 Volume slider applied to element", v1.vol !== null && Math.abs((v1.vol ?? 1) - 0.3) < 0.02, JSON.stringify(v1));

  // seek: same position twice (seekAppliedRef never reset)
  await page.locator("[data-playback-chrome]").focus();
  await page.keyboard.press("Home");
  await page.waitForTimeout(900);
  await page.waitForTimeout(2500); // let it advance well past 0
  const h0 = await snap(page);
  await page.keyboard.press("Home");
  await page.waitForTimeout(900);
  const h1 = await snap(page);
  rec("E1 second Home (SEEK 0) after advancing really rewinds", (h1.cur ?? 99) < (h0.cur ?? 0) - 1, `before=${h0.cur}s after=${h1.cur}s`);

  // repeat
  const rb = page.locator('[data-playback-controls] button[data-repeat-mode], [data-playback-controls] button[aria-label^="Repeat"]').first();
  const lab0 = await rb.getAttribute("aria-label");
  await rb.click({ force: true });
  await rb.click({ force: true });
  await rb.click({ force: true });
  const lab3 = await rb.getAttribute("aria-label");
  rec("F1 repeat default PLAYLIST and cycles back after 3 clicks", /(Repeat PLAYLIST|repetir lista)$/.test(lab0 ?? "") && /(Repeat PLAYLIST|repetir lista)$/.test(lab3 ?? ""), `${lab0} -> ${lab3}`);

  // ── G. transition matrix: VIDEO → IMAGE → GIF → AUDIO → VIDEO (let it run) ──
  await page.locator("[data-playback-chrome]").focus();
  const seen: string[] = [];
  const t0 = Date.now();
  let lastKey = "";
  while (Date.now() - t0 < 75000) {
    const s = await snap(page);
    const key = `${s.idx}:${s.kind}:${s.status}`;
    if (key !== lastKey) { seen.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${key}`); lastKey = key; }
    await page.waitForTimeout(300);
  }
  console.log("transitions:", seen.join(" | "));
  const kinds = new Set(seen.map((x) => x.split(" ")[1]!.split(":")[1]));
  rec("G1 matrix reaches video, still, audio kinds", ["video", "still", "audio"].every((k) => kinds.has(k)), [...kinds].join(","));
  const idxs = seen.map((x) => Number(x.split(" ")[1]!.split(":")[0]));
  rec("G2 playlist wraps last → first (idx sequence revisits 0)", idxs.slice(1).includes(0) && Math.max(...idxs) >= 2, idxs.join(","));

  // ── H. stuck-state detection: PLAYING with paused media element ─────────
  const ev = await page.evaluate(() => (window as unknown as { __pp: { ev: unknown[]; playRej: string[] } }).__pp);
  const rej = (ev as { playRej: string[] }).playRej;
  console.log("play() rejections:", JSON.stringify(rej));
  fs.writeFileSync(`${OUT}/probe-events.json`, JSON.stringify({ rej, events: (ev as { ev: unknown[] }).ev.slice(0, 400), pageErrors }, null, 1));
  await page.screenshot({ path: `${OUT}/probe-final.png` });
  await browser.close();

  fs.writeFileSync(`${OUT}/probe-results.json`, JSON.stringify({ at: new Date().toISOString(), autoplayPolicy: "document-user-activation-required", findings }, null, 1));
  console.log(`\n${findings.filter((f) => f.ok).length}/${findings.length} checks OK; defects: ${findings.filter((f) => !f.ok).map((f) => f.id).join(", ") || "none"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

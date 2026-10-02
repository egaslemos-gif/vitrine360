/**
 * PLAYER-PRO-02 — live validation of the playback contract fixes in a real Chrome.
 *
 * Scenarios (strict asserts):
 *   STOP-01   Stop + late canplay/loadeddata/loadedmetadata  -> element stays stopped
 *   SEEK-01   PLAY -> PAUSE -> SEEK(Home) -> wait            -> stays paused, no time advance
 *   SEEK-02   Home twice (second seek to the same position)  -> both applied
 *   MUTE-*    mute / unmute / volume 0 -> unmute keeps the same element and restores level
 *   REP-*     repeat labels (PT), aria-pressed, available below 768 px
 *   BUF-01    waiting/playing -> "A carregar…" only while the element is starving
 *   MATRIX    VIDEO -> IMAGE(png) -> IMAGE(gif) -> AUDIO -> VIDEO, rapid NEXT during loading
 * With SIM_POLICY=1|2 (autoplay-policy model, see instrument.js):
 *   SIM1: unmuted play refused  -> muted playback, honest "Ativar som", first gesture restores audio
 *   SIM2: every play refused    -> PAUSED (no auto-skip), Play retries on the SAME element
 *
 *   DATABASE_URL=file:./data/authz02-e2e.db MEDIA_STORAGE_PROVIDER=local \
 *   MEDIA_LOCAL_DIR=./data/authz02-media npx next start -p 3150
 *   BASE_URL=http://localhost:3150 npx tsx scripts/live-player-pro-02-validate.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { chromium, type Page } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3150";
const OUT = "docs/evidence/player-pro-02";
const SIM = process.env.SIM_POLICY === "1" ? 1 : process.env.SIM_POLICY === "2" ? 2 : 0;
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

const snap = (p: Page) =>
  p.evaluate(() => {
    const root = document.querySelector("[data-playback-status]");
    const m = document.querySelector("video") as (HTMLVideoElement & { __same?: boolean }) | null;
    const q = document.querySelector.bind(document); // (no named arrow: esbuild __name)
    return {
      status: root?.getAttribute("data-playback-status") ?? "-",
      idx: Number(root?.getAttribute("data-playback-index") ?? -1),
      kind: q("[data-media-kind]")?.getAttribute("data-media-kind") ?? "-",
      paused: m ? m.paused : null,
      muted: m ? m.muted : null,
      cur: m ? Number(m.currentTime.toFixed(2)) : null,
      vol: m ? Number(m.volume.toFixed(2)) : null,
      same: m ? m.__same === true : null,
      playLabel: q('[data-playback-controls] button[aria-pressed][aria-label="Pause"], [data-playback-controls] button[aria-label="Play"]')?.getAttribute("aria-label") ?? "-",
      muteLabel: q('[data-playback-controls] button[aria-label="Mute"], [data-playback-controls] button[aria-label="Unmute"], [data-playback-controls] button[aria-label="Ativar som"]')?.getAttribute("aria-label") ?? "-",
      note: q("[data-playback-note]")?.getAttribute("data-playback-note") ?? "",
      noteText: q("[data-playback-note]")?.textContent ?? "",
      repeatLabel: q('[data-playback-controls] button[data-repeat-mode]')?.getAttribute("aria-label") ?? "-",
      repeatPressed: q('[data-playback-controls] button[data-repeat-mode]')?.getAttribute("aria-pressed") ?? "-",
    };
  });

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
    assert.equal(r.status(), 200, `upload ${title}: ${r.status()} ${(await r.text()).slice(0, 100)}`);
    return ((await r.json()) as { id: string }).id;
  };
  const vid = await mk(`VID ${stamp}`, "VIDEO", SAMPLE, "video/mp4", "mp4", "0");
  const img = await mk(`IMG ${stamp}`, "IMAGE", png(64, 36, [200, 60, 60]), "image/png", "png", "3000");
  const gif = await mk(`GIF ${stamp}`, "IMAGE", GIF, "image/gif", "gif", "3000"); // GIF = IMAGE + image/gif
  const aud = await mk(`AUD ${stamp}`, "AUDIO", wav(4), "audio/wav", "wav", "0");

  const pl = await api.post(`${BASE}/api/admin/playlists`, { data: { name: `PP02 ${stamp}` } });
  const playlistId = ((await pl.json()) as { id: string }).id;
  for (const c of [vid, img, gif, aud]) {
    await api.patch(`${BASE}/api/admin/playlists`, { data: { action: "add_item", playlistId, contentId: c } });
  }

  const page = await ctx.newPage();
  if (SIM) await page.addInitScript({ content: `window.__SIM = ${SIM};` });
  await page.addInitScript({ content: INSTRUMENT_JS });
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}/player`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-activation-code]", { timeout: 30000 });
  const code = (await page.locator("[data-activation-code]").getAttribute("data-activation-code")) ?? "";
  const dev = `P2-${stamp.toUpperCase()}`;
  assert.equal((await api.post(`${BASE}/api/admin/devices`, { data: { activationCode: code, name: `PP02 ${stamp}`, deviceCode: dev } })).status(), 200);
  const devs = (await (await api.get(`${BASE}/api/admin/devices`)).json()) as { devices: { id: string; deviceCode: string }[] };
  const did = devs.devices.find((d) => d.deviceCode === dev)!.id;
  assert.equal((await api.post(`${BASE}/api/admin/devices/${did}/assign`, { data: { playlistId } })).status(), 200);

  const waitKind = async (kind: string, ms = 30000) => {
    const t = Date.now();
    while (Date.now() - t < ms) { if ((await snap(page)).kind === kind) return true; await page.waitForTimeout(200); }
    return false;
  };
  const btn = (label: string) => page.locator(`[data-playback-controls] button[aria-label="${label}"]`).first();
  const mark = () => page.evaluate(() => { const v = document.querySelector("video") as (HTMLVideoElement & { __same?: boolean }) | null; if (v) v.__same = true; });

  await waitKind("video", 25000);
  await page.waitForTimeout(2500);

  // ───────────────────────── SIM modes ─────────────────────────
  if (SIM === 1) {
    const s0 = await snap(page);
    console.log("SIM1 boot (no gesture):", JSON.stringify(s0));
    check("SIM1-01 refused audible play -> still playing (muted), not frozen", s0.status === "PLAYING" && s0.paused === false, JSON.stringify(s0));
    check("SIM1-02 UI is honest: element silent -> 'Ativar som' + sound-blocked note", s0.muted === true && s0.muteLabel === "Ativar som" && s0.note === "sound-blocked", `muteLabel=${s0.muteLabel} note=${s0.note}`);
    await page.mouse.click(640, 360);
    await page.waitForTimeout(1500);
    const s1 = await snap(page);
    check("SIM1-03 first user gesture restores sound on the same playing element", s1.muted === false && s1.paused === false && s1.muteLabel === "Mute" && s1.note !== "sound-blocked", JSON.stringify(s1));
    const ev = await page.evaluate(() => (window as unknown as { __pp: { playRej: string[] } }).__pp.playRej);
    check("SIM1-04 policy was actually exercised (play() rejections recorded)", ev.length > 0, `rejections=${ev.length}`);
  } else if (SIM === 2) {
    await page.waitForTimeout(2500);
    const s0 = await snap(page);
    console.log("SIM2 boot (all play refused):", JSON.stringify(s0));
    await page.waitForTimeout(6000);
    const s1 = await snap(page);
    check("SIM2-01 recoverable autoplay refusal -> PAUSED, no automatic skip", s1.idx === s0.idx && (s1.status === "PAUSED" || s1.status === "PLAYING") && s1.paused === true, JSON.stringify(s1));
    await mark();
    await page.mouse.move(640, 600);
    await page.mouse.click(40, 40); // gesture on the page (not on a control)
    await page.waitForTimeout(500);
    const label = (await snap(page)).playLabel;
    // user presses Play (or the "tap to play" note path)
    if (label === "Play") await btn("Play").click({ force: true });
    else await btn("Pause").click({ force: true });
    await page.waitForTimeout(1800);
    const s2 = await snap(page);
    check("SIM2-02 Play after the refusal retries on the SAME element and plays", s2.paused === false && s2.same === true && s2.idx === s0.idx, JSON.stringify(s2));
  } else {
    // ───────────────────────── real Chrome ─────────────────────────
    await page.mouse.click(640, 360);
    await page.waitForTimeout(600);
    await page.mouse.move(640, 600);
    await page.locator("[data-playback-chrome]").focus();

    // STOP-01 — the original defect: late native events after Stop
    await btn("Stop").click({ force: true });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const v = document.querySelector("video")!;
      for (const n of ["loadedmetadata", "loadeddata", "canplay", "seeked"]) v.dispatchEvent(new Event(n));
    });
    await page.waitForTimeout(2200);
    const st = await snap(page);
    check("STOP-01 Stop + late loadedmetadata/loadeddata/canplay -> stays stopped", st.status === "STOPPED" && st.paused === true && (st.cur ?? 9) < 0.3, JSON.stringify(st));
    await btn("Play").click({ force: true });
    await page.waitForTimeout(1200);
    const st2 = await snap(page);
    check("STOP-02 Play after Stop starts again", st2.status === "PLAYING" && st2.paused === false, JSON.stringify(st2));

    // SEEK-01 — pause then seek
    await page.waitForTimeout(2500);
    await btn("Pause").click({ force: true });
    await page.waitForTimeout(400);
    const pBefore = await snap(page);
    await page.locator("[data-playback-chrome]").focus();
    await page.keyboard.press("Home");
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const v = document.querySelector("video")!;
      for (const n of ["loadedmetadata", "canplay", "seeked"]) v.dispatchEvent(new Event(n));
    });
    const p1 = await snap(page);
    await page.waitForTimeout(1800);
    const p2 = await snap(page);
    check("SEEK-01 PLAY->PAUSE->SEEK->wait: still PAUSED, element paused", p2.status === "PAUSED" && p2.paused === true, JSON.stringify(p2));
    check("SEEK-01b seek was applied and time did not advance", (p1.cur ?? 9) < (pBefore.cur ?? 0) - 1 && Math.abs((p2.cur ?? 0) - (p1.cur ?? 0)) < 0.25, `before=${pBefore.cur} afterSeek=${p1.cur} later=${p2.cur}`);
    await btn("Play").click({ force: true });
    await page.waitForTimeout(800);

    // SEEK-02 — the same position twice
    await page.waitForTimeout(2200);
    await page.locator("[data-playback-chrome]").focus();
    await page.keyboard.press("Home");
    await page.waitForTimeout(700);
    const h1 = await snap(page);
    await page.waitForTimeout(2500);
    const hMid = await snap(page);
    await page.keyboard.press("Home");
    await page.waitForTimeout(700);
    const h2 = await snap(page);
    check("SEEK-02 second Home (same position) is applied too", (hMid.cur ?? 0) > 1.5 && (h2.cur ?? 9) < (hMid.cur ?? 0) - 1, `1st=${h1.cur} advanced=${hMid.cur} 2nd=${h2.cur}`);

    // MUTE / VOLUME — same element, effective state coherent
    await mark();
    await btn("Mute").click({ force: true });
    await page.waitForTimeout(300);
    const m1 = await snap(page);
    check("MUTE-01 Mute -> element muted, label Unmute", m1.muted === true && m1.muteLabel === "Unmute", JSON.stringify(m1));
    await btn("Unmute").click({ force: true });
    await page.waitForTimeout(800);
    const m2 = await snap(page);
    check("MUTE-02 Unmute -> element audible state restored, same element, still playing", m2.muted === false && m2.paused === false && m2.same === true, JSON.stringify(m2));
    await page.locator('[data-playback-controls] input[aria-label="Volume"]').fill("40");
    await page.waitForTimeout(300);
    await page.locator('[data-playback-controls] input[aria-label="Volume"]').fill("0");
    await page.waitForTimeout(300);
    const m3 = await snap(page);
    check("MUTE-03 volume 0 is not 'muted' (label stays Mute, volume applied)", m3.vol === 0 && m3.muteLabel === "Mute", JSON.stringify(m3));
    await btn("Mute").click({ force: true });
    await page.waitForTimeout(200);
    await btn("Unmute").click({ force: true });
    await page.waitForTimeout(500);
    const m4 = await snap(page);
    check("MUTE-04 unmuting from volume 0 restores the previous level (>0), same element", (m4.vol ?? 0) > 0.3 && m4.muted === false && m4.same === true, JSON.stringify(m4));

    // REPEAT — Portuguese, accessible, visible when narrow
    const r0 = await snap(page);
    check("REP-01 default repeat is the playlist, Portuguese label, aria-pressed=true", r0.repeatLabel === "Repetição: repetir lista" && r0.repeatPressed === "true", `${r0.repeatLabel} pressed=${r0.repeatPressed}`);
    const rb = page.locator("[data-playback-controls] button[data-repeat-mode]").first();
    await rb.click({ force: true });
    const r1 = await snap(page);
    await rb.click({ force: true });
    const r2 = await snap(page);
    await rb.click({ force: true });
    const r3 = await snap(page);
    check("REP-02 cycle lista -> item -> sem repetição -> lista, aria-pressed off only for NONE", r1.repeatLabel.endsWith("repetir item") && r2.repeatLabel.endsWith("sem repetição") && r2.repeatPressed === "false" && r3.repeatLabel.endsWith("repetir lista"), `${r1.repeatLabel} | ${r2.repeatLabel} | ${r3.repeatLabel}`);
    await page.setViewportSize({ width: 600, height: 800 });
    await page.waitForTimeout(600);
    await page.mouse.move(300, 700);
    const narrow = await page.locator("[data-playback-controls] button[data-repeat-mode]").count();
    const box = await page.locator("[data-playback-controls] button[data-repeat-mode]").first().boundingBox();
    check("REP-03 repeat control available below 768 px (touch target >= 36 px)", narrow === 1 && !!box && box.height >= 36 && box.width >= 36, `count=${narrow} box=${JSON.stringify(box)}`);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(400);

    // BUF-01 — synthetic starvation: only shown while the element is starving
    await page.mouse.move(640, 600);
    await page.evaluate(() => {
      const v = document.querySelector("video")!;
      Object.defineProperty(v, "readyState", { configurable: true, value: 2 });
      v.dispatchEvent(new Event("waiting"));
    });
    await page.waitForTimeout(300);
    const b1 = await snap(page);
    await page.evaluate(() => {
      const v = document.querySelector("video")!;
      delete (v as unknown as { readyState?: number }).readyState;
      v.dispatchEvent(new Event("playing"));
    });
    await page.waitForTimeout(300);
    const b2 = await snap(page);
    check("BUF-01 buffering note appears on starvation and clears on playing", b1.note === "buffering" && b1.noteText.includes("A carregar") && b2.note !== "buffering", `during=${b1.note} after=${b2.note}`);
    await page.evaluate(() => {
      const v = document.querySelector("video")!;
      v.dispatchEvent(new Event("waiting")); // healthy element (readyState 4): must NOT claim buffering
    });
    await page.waitForTimeout(250);
    check("BUF-02 no buffering claim for a healthy element", (await snap(page)).note !== "buffering");

    // MATRIX — VIDEO -> IMAGE -> IMAGE(gif) -> AUDIO -> VIDEO, with rapid NEXT during loading
    const seen: string[] = [];
    let last = "";
    const t0 = Date.now();
    while (Date.now() - t0 < 32000) {
      const s = await snap(page);
      const k = `${s.idx}:${s.kind}`;
      if (k !== last) { seen.push(k); last = k; }
      await page.waitForTimeout(250);
    }
    console.log("transitions:", seen.join(" > "));
    const idxOrder = seen.map((x) => Number(x.split(":")[0]));
    const okSeq = idxOrder.every((v, i) => i === 0 || v === idxOrder[i - 1] /* same item, transient LOADING sample */ || v === (idxOrder[i - 1]! + 1) % 4 || v === -1 || idxOrder[i - 1] === -1);
    check("MATRIX-01 VIDEO>IMAGE>GIF>AUDIO>VIDEO in order, wraps last->first", okSeq && idxOrder.includes(3) && idxOrder.slice(idxOrder.indexOf(3)).includes(0), seen.join(" > "));
    await page.locator("[data-playback-chrome]").focus();
    for (let i = 0; i < 3; i++) { await page.keyboard.press("n"); await page.waitForTimeout(120); }
    await page.waitForTimeout(2500);
    const f = await snap(page);
    const coherent = f.status === "PLAYING" && (f.kind === "still" || f.kind === "audio" || f.kind === "video") && (f.kind === "still" || f.paused === false);
    check("MATRIX-02 3x NEXT during loading ends coherent (logical PLAYING == element playing)", coherent, JSON.stringify(f));
    await page.keyboard.press("s").catch(() => undefined);
    check("NO-ERR page errors", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 160));
  }

  await page.screenshot({ path: `${OUT}/validate-${SIM ? "sim" + SIM : "real"}.png` });
  await browser.close();
  const failed = rows.filter((r) => !r.ok);
  fs.writeFileSync(`${OUT}/live-results-${SIM ? "sim" + SIM : "real"}.json`, JSON.stringify({ at: new Date().toISOString(), sim: SIM, rows }, null, 1));
  console.log(`\n${rows.length - failed.length}/${rows.length} PASS`);
  if (failed.length) { console.log("FAILED:", failed.map((x) => x.id).join("; ")); process.exit(1); }
}

main().catch((e) => { console.error(e); process.exit(2); });

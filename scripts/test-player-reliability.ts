/**
 * PLAYER-RELIABILITY-01 — static contract guards for the fixes that make Smart TV / browser
 * playback dependable. Live behaviour is covered by:
 *   scripts/test-device-media-range.ts      (HTTP Range / 206 against a running server)
 *   scripts/live-tv-video-validate.ts       (public/tv.js in a real browser)
 *   scripts/live-react-player-validate.ts   (React player in a real browser)
 * Run: npm run test:player-reliability
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createInitialPlaybackState } from "../src/domain/playback-state";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
let n = 0;
function test(id: string, title: string, fn: () => void) {
  fn();
  n += 1;
  console.log(`PASS ${id} — ${title}`);
}

const tv = read("public/tv.js");

test("REL-001", "tv.js stops the pairing clock when playback starts (it repainted the pairing screen over video/images every second)", () => {
  const start = tv.indexOf("function startPlayback(cfg)");
  assert.ok(start > 0);
  const body = tv.slice(start, start + 900);
  assert.ok(/clearInterval\(pairingClockTimer\)/.test(body), "startPlayback clears pairingClockTimer");
  // defensive guard inside the timer itself
  const clock = tv.slice(tv.indexOf("pairingClockTimer = setInterval"), tv.indexOf("pairingClockTimer = setInterval") + 500);
  assert.ok(/playState\.token/.test(clock), "pairing clock bails out once the device is claimed");
});

test("REL-002", "tv.js tries several video sources and never fails silently", () => {
  assert.ok(tv.includes("function videoCandidates"));
  assert.ok(tv.includes("function renderMediaProblem"));
  assert.ok(tv.includes("v360-tv-last-media-error"));
  assert.ok(tv.includes("SOFT_STALL_MS") && tv.includes("HARD_START_MS"), "adaptive start watchdog");
  assert.ok(!/\},\s*8000\);\s*\}\s*\n\s*function showAudio/.test(tv), "old fixed 8 s skip removed");
});

test("REL-003", "tv.js keeps natural and fixed durations apart (0 = native ended, >0 = playlist window)", () => {
  const sv = tv.slice(tv.indexOf("function showVideo"), tv.indexOf("function showAudio"));
  assert.ok(/duration > 0/.test(sv) && /video\.onended/.test(sv));
  assert.ok(/hold\(duration, generation\)/.test(sv), "fixed window ends by the timer");
  assert.ok(/naturalHold/.test(sv), "natural item has an ended safety net");
});

test("REL-004", "tv.js images: no re-download of cached blobs, display time counted from first paint", () => {
  assert.ok(tv.includes('indexOf("blob:") === 0'));
  assert.ok(tv.includes("shownHold"));
});

test("REL-005", "tv.js full screen by default + repeat wraps the playlist", () => {
  assert.ok(tv.includes("armDefaultFullscreen") && tv.includes("requestFullscreen"));
  assert.ok(/playState\.index = \(playState\.index \+ 1\) % playState\.items\.length/.test(tv));
});

test("REL-006", "tv.js stays ES5 (Sraf / Hisense / old Tizen reject modern syntax)", () => {
  const code = tv.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.ok(!/=>/.test(code), "no arrow functions");
  assert.ok(!/(^|[^\w$.])(let|const)\s+[\w$]/m.test(code), "no let/const");
  assert.ok(!/`/.test(code), "no template literals");
  assert.ok(!/\?\./.test(code.replace(/"[^"]*"|'[^']*'/g, "")), "no optional chaining");
});

test("REL-007", "Smart TV shell cache-busters are aligned with the tv.js version", () => {
  const html = read("public/tv.html");
  const sw = read("public/tv-sw.js");
  const m = /tv\.js\?v=(\d+)/.exec(html);
  assert.ok(m, "tv.html references tv.js?v=NNN");
  assert.ok(sw.includes(`v${m![1]}`) && sw.includes(`tv.js?v=${m![1]}`), "service worker uses the same version");
});

const route = read("src/app/api/device/media/[assetId]/route.ts");

test("REL-008", "device media proxy serves HTTP Range (206/416) in chunks below the serverless limit", () => {
  assert.ok(route.includes("parseRangeHeader") && route.includes("status: 206") && route.includes("status: 416"));
  assert.ok(route.includes("Content-Range") && route.includes("MEDIA_RANGE_MAX_CHUNK"));
  assert.ok(route.includes("chunkedStream"), "large objects without Range are streamed, not buffered whole");
});

test("REL-009", "storage providers expose byte ranges", () => {
  assert.ok(read("src/services/media/r2-provider.ts").includes("getObjectRange"));
  assert.ok(read("src/services/media/local-fs-provider.ts").includes("getObjectRange"));
});

test("REL-010", "default repeat mode is PLAYLIST (playlist loops by default)", () => {
  assert.equal(createInitialPlaybackState().repeatMode, "PLAYLIST");
});

test("REL-011", "React player recovers from bad/stalled items and does not re-run autoplay on every render", () => {
  assert.ok(read("src/player/playback/display-engine.tsx").includes("usePlaybackRecovery"));
  const rec = read("src/player/playback/use-playback-recovery.ts");
  assert.ok(rec.includes("MEDIA_TIMEOUT") && rec.includes('type: "NEXT"') && rec.includes('type: "PLAY"'));
  const adapter = read("src/player/playback/playback-renderer-adapter.tsx");
  assert.ok(adapter.includes("setMediaEl") && !/ref=\{\(el\) =>/.test(adapter), "stable media ref");
});

test("REL-012", "React player: media loops inside a FIXED window, natural items use native ended", () => {
  const adapter = read("src/player/playback/playback-renderer-adapter.tsx");
  assert.ok(adapter.includes("loopInWindow") && adapter.includes("loop={loopInWindow}"));
  assert.ok(/if \(!nativeEnded\) return;/.test(adapter), "fixed-window items: timer owns the timeline");
});

test("REL-013", "default full screen on first gesture + VLC-like keyboard", () => {
  assert.ok(read("src/player/playback/playback-chrome.tsx").includes('source: "user"'));
  const kb = read("src/player/playback/use-playback-keyboard.ts");
  for (const k of ["MediaPlayPause", "MediaTrackNext", "SEEK_STEP_MS", "ArrowLeft", "PREVIOUS", "NEXT"]) {
    assert.ok(kb.includes(k), `keyboard handles ${k}`);
  }
});

test("REL-014", "browser UI uses translucent glass (content stays visible)", () => {
  const controls = read("src/player/playback/playback-controls.tsx");
  const hud = read("src/player/playback/display-identity-hud.tsx");
  for (const src of [controls, hud]) {
    assert.ok(/rgba\(20, 18, 44, 0\.34\)/.test(src) && /backdropFilter/.test(src));
  }
});

console.log(`\nPLAYER-RELIABILITY-01: ${n}/${n} PASS`);

/**
 * PLAYER-PRO-02A — EXPERIENCE controls: no fake pause. Run: npm run test:player-pro-02a
 * (STOP-during-loading is browser-only: scripts/live-player-pro-02a-validate.ts)
 *
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createInitialPlaybackState, PLAYBACK_STATUSES } from "../src/domain/playback-state";
import { resolveControlAvailability } from "../src/player/playback/control-availability";
import { PlaybackController } from "../src/player/playback/playback-controller";
import { createCommandDispatcher } from "../src/player/command/command-dispatcher";
import { createDeviceCommand, type DeviceCommand } from "../src/domain/device-command";
import { PlaybackControls } from "../src/player/playback/playback-controls";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
let n = 0;
function test(id: string, title: string, fn: () => void) {
  fn();
  n += 1;
  console.log(`PASS ${id} — ${title}`);
}

const base = { ...createInitialPlaybackState(1), currentContentId: "c1", currentContentType: "EXPERIENCE" as const, durationMs: 12000, currentItemIndex: 0 };

test("PRO02A-001", "EXPERIENCE: Play/Pause and Stop disabled in every status that can show them", () => {
  for (const status of PLAYBACK_STATUSES) {
    if (status === "IDLE") continue;
    const a = resolveControlAvailability({ ...base, status }, { itemCount: 3 });
    assert.equal(a.PLAY_PAUSE.enabled, false, `${status}: play/pause`);
    assert.equal(a.STOP.enabled, false, `${status}: stop`);
  }
});

test("PRO02A-002", "EXPERIENCE: no other control can simulate a pause (seek/volume/mute hidden; only navigation, restart, repeat, fullscreen remain)", () => {
  const a = resolveControlAvailability({ ...base, status: "PLAYING" }, { itemCount: 3 });
  for (const k of ["SEEK", "VOLUME", "MUTE"] as const) assert.equal(a[k].visible, false, `${k} hidden`);
  const enabled = Object.entries(a).filter(([, v]) => v.enabled).map(([k]) => k).sort();
  assert.deepEqual(enabled, ["FULLSCREEN", "NEXT", "PREVIOUS", "REPEAT", "RESTART"]);
});

test("PRO02A-003", "rendered controls: Pause/Play and Stop carry the disabled attribute; no slider, no volume, no pressed play state", () => {
  const html = renderToStaticMarkup(
    createElement(PlaybackControls, { state: { ...base, status: "PLAYING" }, dispatch: () => undefined, itemCount: 3, itemTitle: "Experiência" }),
  );
  const btn = (label: string) => new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`).exec(html)?.[0] ?? "";
  assert.ok(/disabled/.test(btn("Pause")), `Pause disabled: ${btn("Pause")}`);
  assert.ok(/disabled/.test(btn("Stop")), "Stop disabled");
  assert.ok(!/role="slider"/.test(html), "no seek slider");
  assert.ok(!/aria-label="Volume"/.test(html), "no volume");
  assert.ok(!/aria-label="Mute"|aria-label="Unmute"/.test(html), "no mute");
  // control kind that WOULD be a pause for other types is the only pressed-state play button
  const ctlPlaying = renderToStaticMarkup(
    createElement(PlaybackControls, { state: { ...base, status: "PLAYING" }, dispatch: () => undefined, itemCount: 3 }),
  );
  assert.ok(/aria-label="Pause"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*aria-label="Pause"/.test(ctlPlaying), "reference: PLAYING shows Pause (state, not a claim of PAUSED)");
  // a state that is NOT PLAYING must never be produced by this UI for EXPERIENCE
  const ctlVideo = renderToStaticMarkup(
    createElement(PlaybackControls, { state: { ...base, currentContentType: "VIDEO", status: "PLAYING" }, dispatch: () => undefined, itemCount: 3 }),
  );
  assert.ok(!/disabled/.test(/<button[^>]*aria-label="Pause"[^>]*>/.exec(ctlVideo)?.[0] ?? ""), "control group: VIDEO keeps an enabled Pause");
});

test("PRO02A-004", "the local UI has no path that dispatches PAUSE/STOP for EXPERIENCE (controls disabled, keyboard guarded)", () => {
  const kb = read("src/player/playback/use-playback-keyboard.ts");
  const guard = kb.indexOf('const isExperience = st.currentContentType === "EXPERIENCE"');
  const firstPause = kb.indexOf('send({ type: "PAUSE" })');
  const firstStop = kb.indexOf('send({ type: "STOP" })');
  assert.ok(guard > 0 && guard < firstPause && guard < firstStop, "guard precedes every PAUSE/STOP dispatch in the keyboard handler");
  // only these source files dispatch PAUSE/STOP from the UI
  const files = [
    "src/player/playback/playback-controls.tsx",
    "src/player/playback/use-playback-keyboard.ts",
    "src/player/playback/playback-chrome.tsx",
    "src/player/playback/display-engine.tsx",
    "src/player/playback/playback-renderer-adapter.tsx",
    "src/player/playback/experience-slide.tsx",
  ];
  for (const f of files) {
    const src = read(f);
    const hits = (src.match(/type: "(PAUSE|STOP)"/g) ?? []).length;
    if (f.endsWith("playback-controls.tsx")) assert.equal(hits, 2, "controls: Pause + Stop buttons only (both disabled for EXPERIENCE)");
    else if (f.endsWith("use-playback-keyboard.ts")) assert.equal(hits, 3, "keyboard: Space, keyCode 19, Stop (all behind the guard)");
    else assert.equal(hits, 0, `${f}: no PAUSE/STOP dispatch`);
  }
});

test("PRO02A-005", "scope: admission, sandbox, bridge and EXPERIENCE runtime files are untouched by this work", () => {
  const changed = execSync("git status --porcelain", { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .map((l) => l.slice(3).trim());
  const protectedRe = /experience|sandbox|bridge|admission|runtime\/(shell|experience|passive)|public\/tv\./i; // (command-dispatcher is intentionally changed by PRO-02B; its own scope test covers the rest)
  const touched = changed.filter((f) => protectedRe.test(f) && !/^docs\/evidence\//.test(f) && !/scripts\/(test|live)-/.test(f));
  assert.deepEqual(touched, [], `protected files touched: ${touched.join(", ")}`);
  const slide = read("src/player/playback/experience-slide.tsx");
  assert.ok(!/PAUSED|STOPPED|PLAYING|PlaybackState|PlaybackController/.test(slide), "experience slide has no playback-state/pause concept");
});

// ── Remote command path (closed by PLAYER-PRO-02B) ───────────────────────
test("PRO02A-006", "remote PAUSE/STOP (real dispatcher) do not change an EXPERIENCE (formerly KNOWN-GAP, fixed in PRO-02B)", () => {
  const c = new PlaybackController();
  c.dispatch({
    type: "LOAD_PLAYLIST", playlistId: "p", manifestVersion: 1,
    items: [{ playlistItemId: "e1", contentId: "ce", type: "EXPERIENCE", durationMs: 12000 }],
  });
  c.dispatch({ type: "MEDIA_READY", durationMs: 12000, generation: c.getGeneration() });
  const before = c.getState();
  const dispatcher = createCommandDispatcher({
    controller: c,
    getSession: () => ({ sessionId: "s", deviceId: "d", tenantId: "t" }),
    auth: { authorized: true, tenantId: "t", deviceTenantId: "t", deviceId: "d" },
    now: () => 1500,
  });
  for (const type of ["PAUSE", "STOP"] as const) {
    const made = createDeviceCommand({ tenantId: "t", deviceId: "d", sessionId: "s", type, binding: "SESSION_BOUND", issuedAt: 1000, ttlMs: 10_000 });
    assert.ok(made.ok);
    const res = dispatcher.dispatch((made as { ok: true; command: DeviceCommand }).command);
    assert.equal(res.status, "REJECTED");
    assert.equal(res.reason, "NOT_SUPPORTED");
  }
  assert.deepEqual(c.getState(), before);
});

console.log(`
PLAYER-PRO-02A: ${n} PASS`);

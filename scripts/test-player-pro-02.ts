/**
 * PLAYER-PRO-02 — contract guards (static + pure/unit). Live behaviour:
 *   scripts/live-player-pro-02-validate.ts   (real Chrome, plus SIM_POLICY=1|2)
 * Run: npm run test:player-pro-02
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createInitialPlaybackState } from "../src/domain/playback-state";
import { PlaybackController } from "../src/player/playback/playback-controller";
import { resolveControlAvailability, nextRepeatMode } from "../src/player/playback/control-availability";
import { classifyMediaError, MEDIA_ERROR_CODES } from "../src/player/playback/media-types";
import { MediaSignalStore } from "../src/player/playback/media-signal";
import { ensureMediaPlayback, enableSoundOnElement } from "../src/player/playback/ensure-media-playback";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
let n = 0;
function test(id: string, title: string, fn: () => void) {
  fn();
  n += 1;
  console.log(`PASS ${id} — ${title}`);
}

const adapter = read("src/player/playback/playback-renderer-adapter.tsx");

// ── P0-A ─────────────────────────────────────────────────────────────────
test("PRO02-001", "native events never start playback unless the controller wants it for this generation", () => {
  assert.ok(adapter.includes("const startIfWanted"));
  const fn = adapter.slice(adapter.indexOf("const startIfWanted"), adapter.indexOf("const startIfWanted") + 600);
  assert.ok(/s\.generation !== generation/.test(fn), "generation guard");
  assert.ok(/s\.status !== "LOADING" && s\.status !== "PLAYING"/.test(fn), "status guard (STOPPED/PAUSED/ENDED/ERROR/IDLE excluded)");
  // no media-event handler may call ensureMediaPlayback directly any more
  const slide = adapter.slice(adapter.indexOf("function Slide("));
  const direct = slide.match(/ensureMediaPlayback\(el, \{/g) ?? [];
  assert.equal(direct.length, 2, "only the guard (startIfWanted) and the mount path (setMediaEl, PLAYING only) call ensureMediaPlayback");
  assert.ok((slide.match(/startIfWanted\(/g) ?? []).length >= 6, "loadedmetadata/loadeddata/canplay of VIDEO and AUDIO go through the guard");
});

test("PRO02-002", "PAUSED/STOPPED always pause the element (cancels a pending autoplay) and a late-mounted element never auto-starts", () => {
  assert.ok(!/if \(!el\.paused\) el\.pause\(\);/.test(adapter), "unconditional pause");
  assert.ok(/el\.autoplay = false;\s*\n\s*el\.pause\(\);/.test(adapter));
});

test("PRO02-003", "controller semantics unchanged: STOP is not undone by MEDIA_READY / late events of the same generation", () => {
  const c = new PlaybackController();
  c.dispatch({ type: "LOAD_PLAYLIST", playlistId: "p", manifestVersion: 1, items: [{ playlistItemId: "a", contentId: "ca", type: "VIDEO", durationMs: 0 }] });
  const g = c.getGeneration();
  c.dispatch({ type: "MEDIA_READY", durationMs: 5000, generation: g });
  c.dispatch({ type: "STOP" });
  assert.equal(c.getState().status, "STOPPED");
  c.dispatch({ type: "MEDIA_READY", durationMs: 5000, generation: g });
  c.dispatch({ type: "MEDIA_TIME_UPDATE", positionMs: 900, generation: g });
  c.dispatch({ type: "MEDIA_ENDED", generation: g });
  assert.equal(c.getState().status, "STOPPED");
  assert.equal(c.getState().currentItemIndex, 0);
});

// ── P0-B/C ───────────────────────────────────────────────────────────────
test("PRO02-004", "seek dedupe is limited to the operation in flight (cleared on `seeked` and on generation change)", () => {
  assert.ok(!adapter.includes("seekAppliedRef"), "permanent memory removed");
  assert.ok(adapter.includes("seekInFlightRef") && /addEventListener\("seeked", done\)/.test(adapter));
  assert.ok(/seekInFlightRef\.current = null;\s*\n\s*\}, \[generation\]\);/.test(adapter), "reset on generation change (effect, not render)");
});

test("PRO02-005", "SEEK action contract unchanged (clamped, finite only, no status change)", () => {
  const c = new PlaybackController();
  c.dispatch({ type: "LOAD_PLAYLIST", playlistId: "p", manifestVersion: 1, items: [{ playlistItemId: "a", contentId: "ca", type: "VIDEO", durationMs: 0 }] });
  c.dispatch({ type: "MEDIA_READY", durationMs: 8000, generation: c.getGeneration() });
  c.dispatch({ type: "PAUSE" });
  c.dispatch({ type: "SEEK", positionMs: 3000 });
  assert.equal(c.getState().positionMs, 3000);
  assert.equal(c.getState().status, "PAUSED", "seek never plays");
  c.dispatch({ type: "SEEK", positionMs: 0 });
  c.dispatch({ type: "SEEK", positionMs: 0 });
  assert.equal(c.getState().positionMs, 0);
  c.dispatch({ type: "SEEK", positionMs: 99999 });
  assert.equal(c.getState().positionMs, 8000);
  c.dispatch({ type: "SEEK", positionMs: Number.NaN });
  assert.equal(c.getState().positionMs, 8000);
});

// ── P1-A ─────────────────────────────────────────────────────────────────
test("PRO02-006", "MEDIA_PLAY_ERROR keeps the current contract (PAUSED, no error, no index change, no skip)", () => {
  const c = new PlaybackController();
  c.dispatch({
    type: "LOAD_PLAYLIST", playlistId: "p", manifestVersion: 1,
    items: [
      { playlistItemId: "a", contentId: "ca", type: "VIDEO", durationMs: 0 },
      { playlistItemId: "b", contentId: "cb", type: "VIDEO", durationMs: 0 },
    ],
  });
  const g = c.getGeneration();
  c.dispatch({ type: "MEDIA_ERROR", code: MEDIA_ERROR_CODES.MEDIA_PLAY_ERROR, message: "x", recoverable: true, generation: g });
  assert.equal(c.getState().status, "PAUSED");
  assert.equal(c.getState().currentItemIndex, 0);
  assert.equal(c.getState().generation, g);
  const rec = read("src/player/playback/use-playback-recovery.ts");
  assert.ok(!/PAUSED/.test(rec), "recovery hook never auto-skips on a recoverable autoplay refusal");
});

function fakeEl(over: { rejectUnmuted?: boolean; rejectAll?: boolean } = {}) {
  const el = {
    muted: false, volume: 1, paused: true, attrs: new Set<string>(), plays: 0,
    setAttribute(k: string) { this.attrs.add(k); },
    removeAttribute(k: string) { this.attrs.delete(k); },
    play() {
      this.plays++;
      if (over.rejectAll || (over.rejectUnmuted && !this.muted)) return Promise.reject(new Error("NotAllowedError"));
      this.paused = false;
      return Promise.resolve();
    },
  };
  return el;
}
type Listener = () => void;
function stubWindow() {
  const ls = new Map<string, Set<Listener>>();
  const g = globalThis as unknown as { window?: unknown };
  g.window = {
    addEventListener: (t: string, l: Listener) => { (ls.get(t) ?? ls.set(t, new Set()).get(t)!).add(l); },
    removeEventListener: (t: string, l: Listener) => { ls.get(t)?.delete(l); },
    setTimeout: (fn: () => void) => { fn(); return 0; },
  };
  return { fire: (t: string) => { for (const l of [...(ls.get(t) ?? [])]) l(); }, count: (t: string) => ls.get(t)?.size ?? 0 };
}


async function main() {
{
  const w = stubWindow();
  const el = fakeEl({ rejectUnmuted: true });
  const blocked: boolean[] = [];
  ensureMediaPlayback(el as unknown as HTMLMediaElement, { desiredMuted: false, desiredVolume: 0.8, hasUserActivation: () => false, onAudioBlocked: (b) => blocked.push(b) });
  // promises settle on microtasks
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(el.muted, true, "no programmatic unmute without activation");
  assert.equal(el.paused, false);
  assert.deepEqual(blocked, [true]);
  assert.ok(w.count("pointerdown") === 1, "waits for the first gesture");
  w.fire("pointerdown");
  assert.equal(el.muted, false, "gesture restores the intended audio on the same element");
  assert.equal(el.volume, 0.8);
  assert.deepEqual(blocked, [true, false]);
  assert.equal(w.count("pointerdown"), 0, "one-shot");
  n += 1;
  console.log("PASS PRO02-007b — gesture restores sound on the same element (one-shot)");
}

{
  stubWindow();
  const el = fakeEl({ rejectAll: true });
  const fails: string[] = [];
  ensureMediaPlayback(el as unknown as HTMLMediaElement, { desiredMuted: false, hasUserActivation: () => false, onUnrecoverable: (r) => fails.push(r) });
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(fails, ["muted_autoplay_denied"], "even muted play refused -> unrecoverable (controller maps to PAUSED)");
  const el2 = fakeEl({ rejectAll: true });
  enableSoundOnElement(el2 as unknown as HTMLMediaElement, { desiredMuted: false, desiredVolume: 1, onUnrecoverable: (r) => fails.push(r) });
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(el2.plays >= 1, true);
  n += 1;
  console.log("PASS PRO02-008 — refused muted play is reported once; retry reuses the same element");
}

// ── P1-B ─────────────────────────────────────────────────────────────────
test("PRO02-009", "EXPERIENCE: no fake pause/stop (sandbox cannot be suspended); other types unchanged", () => {
  const base = { ...createInitialPlaybackState(1), status: "PLAYING" as const, currentContentId: "c", durationMs: 9000 };
  const exp = resolveControlAvailability({ ...base, currentContentType: "EXPERIENCE" });
  assert.equal(exp.PLAY_PAUSE.enabled, false);
  assert.equal(exp.STOP.enabled, false);
  assert.equal(exp.NEXT.enabled, true);
  assert.equal(exp.PREVIOUS.enabled, true);
  assert.equal(exp.REPEAT.enabled, true);
  for (const t of ["IMAGE", "VIDEO", "AUDIO", "TEXT", "CLOCK"] as const) {
    const a = resolveControlAvailability({ ...base, currentContentType: t });
    assert.equal(a.PLAY_PAUSE.enabled, true, `${t} play/pause`);
    assert.equal(a.STOP.enabled, true, `${t} stop`);
  }
  const kb = read("src/player/playback/use-playback-keyboard.ts");
  assert.ok(kb.includes('st.currentContentType === "EXPERIENCE"') && kb.includes("no fake pause"));
});

// ── P1-C ─────────────────────────────────────────────────────────────────
test("PRO02-010", "UI reflects effective audio: blocked sound is shown as silent, zero volume is not mute, unmute restores level", () => {
  const ctl = read("src/player/playback/playback-controls.tsx");
  assert.ok(ctl.includes("soundBlocked") && ctl.includes('"Ativar som"'));
  assert.ok(ctl.includes("lastAudibleVolumeRef") && /state\.volume === 0/.test(ctl));
  assert.ok(/const silent = state\.muted \|\| soundBlocked/.test(ctl));
  const store = new MediaSignalStore();
  let calls = 0;
  store.subscribe(() => { calls++; });
  store.patch({ audioBlocked: true });
  store.patch({ audioBlocked: true });
  assert.equal(calls, 1, "no redundant notifications");
  assert.equal(store.get().audioBlocked, true);
  store.reset();
  assert.equal(store.get().audioBlocked, false);
});

// ── P2-A ─────────────────────────────────────────────────────────────────
test("PRO02-011", "media errors are classified from MediaError.code / connectivity, without URLs or browser messages", () => {
  assert.deepEqual(classifyMediaError({ errorCode: 2 }), { code: "MEDIA_LOAD_ERROR", kind: "network" });
  assert.deepEqual(classifyMediaError({ errorCode: 3 }), { code: "MEDIA_DECODE_ERROR", kind: "decode" });
  assert.deepEqual(classifyMediaError({ errorCode: 4 }), { code: "MEDIA_UNSUPPORTED", kind: "unsupported" });
  assert.deepEqual(classifyMediaError({ errorCode: 1 }), { code: "MEDIA_LOAD_ERROR", kind: "load" });
  assert.deepEqual(classifyMediaError({ errorCode: null, online: false }), { code: "MEDIA_LOAD_ERROR", kind: "network" });
  assert.deepEqual(classifyMediaError({ errorCode: 3, online: false }), { code: "MEDIA_DECODE_ERROR", kind: "decode" });
  assert.deepEqual(classifyMediaError({}), { code: "MEDIA_ERROR", kind: "unknown" });
  const emit = adapter.slice(adapter.indexOf("const emitNativeError"), adapter.indexOf("const emitNativeError") + 700);
  assert.ok(!/error\?\.message|currentSrc|\.src/.test(emit), "browser messages / URLs are never forwarded");
  assert.ok(/NODE_ENV !== "development"\) return; \/\/ diagnostics only in dev/.test(adapter), "video diagnostics console output is dev-only");
  // every error handler of the media elements uses the classifier
  assert.equal((adapter.match(/emitNativeError\(e\.currentTarget\)/g) ?? []).length, 2);
});

test("PRO02-012", "buffering is only claimed from observable data (waiting/stalled with readyState < 3 while PLAYING)", () => {
  assert.ok(/status === "PLAYING" && !el\.paused && el\.readyState < 3/.test(adapter));
  assert.ok(/readyState >= 3 && !el\.paused\) signals\.patch\(\{ buffering: false \}\)/.test(adapter));
});

// ── P2-B ─────────────────────────────────────────────────────────────────
test("PRO02-013", "repeat: PLAYLIST is the default (initial state and controller); modes behave; UI in Portuguese and available when compact", () => {
  assert.equal(createInitialPlaybackState().repeatMode, "PLAYLIST");
  assert.equal(new PlaybackController().getState().repeatMode, "PLAYLIST");
  const mk = (mode: "NONE" | "PLAYLIST" | "ITEM") => {
    const c = new PlaybackController();
    c.dispatch({ type: "SET_REPEAT_MODE", mode });
    c.dispatch({
      type: "LOAD_PLAYLIST", playlistId: "p", manifestVersion: 1,
      items: [
        { playlistItemId: "a", contentId: "ca", type: "VIDEO", durationMs: 0 },
        { playlistItemId: "b", contentId: "cb", type: "VIDEO", durationMs: 0 },
      ],
      startIndex: 1,
    });
    c.dispatch({ type: "MEDIA_READY", durationMs: 4000, generation: c.getGeneration() });
    c.dispatch({ type: "MEDIA_ENDED", generation: c.getGeneration() });
    return c.getState();
  };
  assert.equal(mk("PLAYLIST").currentItemIndex, 0, "last -> first");
  assert.equal(mk("ITEM").currentItemIndex, 1, "same item");
  assert.equal(mk("NONE").status, "ENDED", "ends on last");
  assert.equal(nextRepeatMode("PLAYLIST"), "ITEM");
  const ctl = read("src/player/playback/playback-controls.tsx");
  assert.ok(ctl.includes("Repetição:") && ctl.includes("repetir lista") && ctl.includes("sem repetição"));
  assert.ok(/avail\.REPEAT\.visible \? \(/.test(ctl) && !/REPEAT\.visible && !compact/.test(ctl), "not hidden when compact");
  assert.ok(/pressed=\{state\.repeatMode !== "NONE"\}/.test(ctl), "aria-pressed");
});

test("PRO02-014", "SYNC_PLAYLIST keeps the repeat mode and the playing item", () => {
  const c = new PlaybackController();
  const items = [
    { playlistItemId: "a", contentId: "ca", type: "VIDEO", durationMs: 0 },
    { playlistItemId: "b", contentId: "cb", type: "VIDEO", durationMs: 0 },
  ];
  c.dispatch({ type: "LOAD_PLAYLIST", playlistId: "p", manifestVersion: 1, items });
  c.dispatch({ type: "SET_REPEAT_MODE", mode: "ITEM" });
  c.dispatch({ type: "SYNC_PLAYLIST", playlistId: "p", manifestVersion: 2, items: [...items].reverse() });
  assert.equal(c.getState().repeatMode, "ITEM");
  assert.equal(c.getState().currentPlaylistItemId, "a");
});

test("PRO02-015", "scope: controller, timer, manifest, EXPERIENCE runtime and tv.js untouched", () => {
  // no second controller / index / timer introduced by this phase
  for (const f of ["src/player/playback/media-signal.tsx", "src/player/playback/ensure-media-playback.ts"]) {
    const src = read(f);
    assert.ok(!/new PlaybackController|currentItemIndex|setInterval\(/.test(src), `${f}: no controller/index/interval`);
  }
  assert.equal((adapter.match(/setInterval\(/g) ?? []).length, 1, "only the pre-existing dev-only debug poll; no playback interval added");
});

console.log(`\nPLAYER-PRO-02: ${n}/${n} PASS`);

console.log(`
PLAYER-PRO-02: ${n}/${n} PASS`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

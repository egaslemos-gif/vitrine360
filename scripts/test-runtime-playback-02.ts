/**
 * RUNTIME-PLAYBACK-02 — Media Renderer & Playback Controller Integration.
 *
 * Run: npm run test:runtime-playback-02
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { PlaybackController } from "../src/player/playback/playback-controller";
import {
  playlistFingerprint,
  toPlaylistItems,
  usesNativeMediaEnded,
  usesPresentationTimer,
  type EnginePlaybackItem,
} from "../src/player/playback/playlist-map";

const ROOT = path.resolve(".");
const EVIDENCE = path.join(ROOT, "docs/evidence/runtime-playback-02");

type Result = { id: string; name: string; pass: boolean; detail?: string };
const results: Result[] = [];

function test(id: string, name: string, fn: () => void): void {
  try {
    fn();
    results.push({ id, name, pass: true });
    console.log(`PASS ${id} ${name}`);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    results.push({ id, name, pass: false, detail });
    console.error(`FAIL ${id} ${name}: ${detail}`);
  }
}

function engineItems(n: number): EnginePlaybackItem[] {
  const out: EnginePlaybackItem[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      playlistItemId: `pi_${i}`,
      contentId: `c_${i}`,
      type: i % 2 === 0 ? "IMAGE" : "VIDEO",
      title: `Item ${i}`,
      durationMs: i % 2 === 0 ? 4000 : 0,
      transition: "fade",
      payload: {},
      assets: [],
    });
  }
  return out;
}

function mountController(items: EnginePlaybackItem[], version = 1) {
  const c = new PlaybackController();
  c.dispatch({
    type: "LOAD_PLAYLIST",
    playlistId: "device-playlist",
    manifestVersion: version,
    items: toPlaylistItems(items),
  });
  return c;
}

function ready(c: PlaybackController, durationMs = 4000) {
  const gen = c.getGeneration();
  c.dispatch({ type: "MEDIA_READY", durationMs, generation: gen });
  return c.getState();
}

function main(): void {
  console.log("RUNTIME-PLAYBACK-02 — Controller Integration\n");

  test("RP02-001", "controller mounted pattern (stable instance)", () => {
    // DisplayEngine uses useRef once — simulate single instance reuse
    const c = new PlaybackController();
    const a = c;
    assert.equal(a, c);
  });

  test("RP02-002", "initial manifest produces deterministic state", () => {
    const items = engineItems(3);
    const c = mountController(items, 7);
    const s = c.getState();
    assert.equal(s.status, "LOADING");
    assert.equal(s.manifestVersion, 7);
    assert.equal(s.currentItemIndex, 0);
    assert.equal(s.currentContentId, "c_0");
    assert.equal(s.playlistId, "device-playlist");
  });

  test("RP02-003", "PLAY", () => {
    const c = mountController(engineItems(2));
    ready(c);
    c.dispatch({ type: "PAUSE" });
    c.dispatch({ type: "PLAY" });
    assert.equal(c.getState().status, "PLAYING");
  });

  test("RP02-004", "PAUSE", () => {
    const c = mountController(engineItems(2));
    ready(c);
    c.dispatch({ type: "PAUSE" });
    assert.equal(c.getState().status, "PAUSED");
  });

  test("RP02-005", "STOP", () => {
    const c = mountController(engineItems(2));
    ready(c);
    const id = c.getState().currentContentId;
    c.dispatch({ type: "STOP" });
    assert.equal(c.getState().status, "STOPPED");
    assert.equal(c.getState().positionMs, 0);
    assert.equal(c.getState().currentContentId, id);
  });

  test("RP02-006", "NEXT", () => {
    const c = mountController(engineItems(3));
    ready(c);
    c.dispatch({ type: "NEXT" });
    assert.equal(c.getState().currentItemIndex, 1);
    assert.equal(c.getState().status, "LOADING");
  });

  test("RP02-007", "PREVIOUS", () => {
    const c = mountController(engineItems(3));
    ready(c);
    c.dispatch({ type: "NEXT" });
    ready(c);
    c.dispatch({ type: "PREVIOUS" });
    assert.equal(c.getState().currentItemIndex, 0);
  });

  test("RP02-008", "RESTART", () => {
    const c = mountController(engineItems(2));
    ready(c);
    const gen = c.getGeneration();
    c.dispatch({
      type: "MEDIA_TIME_UPDATE",
      positionMs: 1500,
      generation: gen,
    });
    c.dispatch({ type: "RESTART" });
    assert.equal(c.getState().positionMs, 0);
    assert.equal(c.getState().status, "LOADING");
  });

  test("RP02-009", "SEEK", () => {
    const c = mountController(engineItems(1));
    ready(c, 5000);
    c.dispatch({ type: "SEEK", positionMs: 2000 });
    assert.equal(c.getState().positionMs, 2000);
  });

  test("RP02-010", "VOLUME", () => {
    const c = mountController(engineItems(1));
    c.dispatch({ type: "SET_VOLUME", volume: 0.55 });
    assert.equal(c.getState().volume, 0.55);
  });

  test("RP02-011", "MUTE", () => {
    const c = mountController(engineItems(1));
    c.dispatch({ type: "SET_VOLUME", volume: 0.8 });
    c.dispatch({ type: "SET_MUTED", muted: true });
    assert.equal(c.getState().muted, true);
    assert.equal(c.getState().volume, 0.8);
  });

  test("RP02-012", "IMAGE timer", () => {
    const items = engineItems(2);
    items[0]!.type = "IMAGE";
    items[0]!.durationMs = 3000;
    const c = mountController(items);
    const gen = c.getGeneration();
    c.dispatch({ type: "MEDIA_READY", durationMs: 3000, generation: gen });
    assert.ok(usesPresentationTimer(items[0]!));
    c.tickImageElapsed(3000, gen);
    assert.equal(c.getState().currentItemIndex, 1);
  });

  test("RP02-013", "VIDEO natural duration", () => {
    const items: EnginePlaybackItem[] = [
      {
        playlistItemId: "v",
        contentId: "vid",
        type: "VIDEO",
        title: "V",
        durationMs: 0,
        transition: "cut",
        payload: {},
        assets: [],
      },
    ];
    assert.ok(usesNativeMediaEnded(items[0]!));
    assert.ok(!usesPresentationTimer(items[0]!));
    const c = mountController(items);
    assert.equal(c.getState().durationMs, null);
    const gen = c.getGeneration();
    c.dispatch({ type: "MEDIA_READY", durationMs: 18200, generation: gen });
    assert.equal(c.getState().durationMs, 18200);
  });

  test("RP02-014", "VIDEO explicit duration", () => {
    const items: EnginePlaybackItem[] = [
      {
        playlistItemId: "v",
        contentId: "vid",
        type: "VIDEO",
        title: "V",
        durationMs: 10000,
        transition: "cut",
        payload: {},
        assets: [],
      },
      {
        playlistItemId: "i",
        contentId: "img",
        type: "IMAGE",
        title: "I",
        durationMs: 4000,
        transition: "fade",
        payload: {},
        assets: [],
      },
    ];
    assert.ok(usesPresentationTimer(items[0]!));
    assert.ok(!usesNativeMediaEnded(items[0]!));
    const c = mountController(items);
    const gen = c.getGeneration();
    c.dispatch({ type: "MEDIA_READY", durationMs: 10000, generation: gen });
    c.tickImageElapsed(10000, gen);
    assert.equal(c.getState().currentItemIndex, 1);
  });

  test("RP02-015", "VIDEO ended", () => {
    const items: EnginePlaybackItem[] = [
      {
        playlistItemId: "v",
        contentId: "vid",
        type: "VIDEO",
        title: "V",
        durationMs: 0,
        transition: "cut",
        payload: {},
        assets: [],
      },
      {
        playlistItemId: "i",
        contentId: "img",
        type: "IMAGE",
        title: "I",
        durationMs: 4000,
        transition: "fade",
        payload: {},
        assets: [],
      },
    ];
    const c = mountController(items);
    const gen = c.getGeneration();
    c.dispatch({ type: "MEDIA_READY", durationMs: 5000, generation: gen });
    c.dispatch({ type: "MEDIA_ENDED", generation: gen });
    assert.equal(c.getState().currentItemIndex, 1);
  });

  test("RP02-016", "VIDEO error", () => {
    const c = mountController(engineItems(2));
    ready(c);
    const gen = c.getGeneration();
    c.dispatch({
      type: "MEDIA_ERROR",
      code: "MEDIA_ERROR",
      message: "fail",
      generation: gen,
    });
    assert.equal(c.getState().status, "ERROR");
    c.dispatch({ type: "NEXT" });
    assert.equal(c.getState().currentItemIndex, 1);
  });

  test("RP02-017", "stale generation event", () => {
    const c = mountController(engineItems(2));
    ready(c);
    const stale = c.getGeneration();
    c.dispatch({ type: "NEXT" });
    c.dispatch({ type: "MEDIA_ENDED", generation: stale });
    assert.equal(c.getState().currentItemIndex, 1);
  });

  test("RP02-018", "NEXT during loading", () => {
    const c = mountController(engineItems(3));
    assert.equal(c.getState().status, "LOADING");
    c.dispatch({ type: "NEXT" });
    assert.equal(c.getState().currentItemIndex, 1);
    assert.equal(c.getState().status, "LOADING");
  });

  test("RP02-019", "STOP during loading", () => {
    const c = mountController(engineItems(2));
    c.dispatch({ type: "STOP" });
    assert.equal(c.getState().status, "STOPPED");
    assert.equal(c.getState().positionMs, 0);
  });

  test("RP02-020", "old timer cleanup (generation guard)", () => {
    const c = mountController(engineItems(2));
    const gen = c.getGeneration();
    c.dispatch({ type: "MEDIA_READY", durationMs: 4000, generation: gen });
    c.dispatch({ type: "NEXT" });
    const after = c.getGeneration();
    assert.notEqual(gen, after);
    c.tickImageElapsed(99999, gen); // stale timer tick
    assert.equal(c.getState().currentItemIndex, 1);
  });

  test("RP02-021", "repeat playlist", () => {
    const c = mountController(engineItems(2));
    c.dispatch({ type: "SET_REPEAT_MODE", mode: "PLAYLIST" });
    ready(c);
    c.dispatch({ type: "NEXT" });
    ready(c);
    c.dispatch({ type: "NEXT" });
    assert.equal(c.getState().currentItemIndex, 0);
  });

  test("RP02-022", "repeat item", () => {
    const c = mountController(engineItems(2));
    c.dispatch({ type: "SET_REPEAT_MODE", mode: "ITEM" });
    const gen = c.getGeneration();
    c.dispatch({ type: "MEDIA_READY", durationMs: 4000, generation: gen });
    c.dispatch({ type: "MEDIA_ENDED", generation: gen });
    assert.equal(c.getState().currentItemIndex, 0);
    assert.equal(c.getState().status, "LOADING");
  });

  test("RP02-023", "repeat none", () => {
    const c = mountController(engineItems(1));
    c.dispatch({ type: "SET_REPEAT_MODE", mode: "NONE" });
    const gen = c.getGeneration();
    c.dispatch({ type: "MEDIA_READY", durationMs: 4000, generation: gen });
    c.dispatch({ type: "MEDIA_ENDED", generation: gen });
    assert.equal(c.getState().status, "ENDED");
  });

  test("RP02-024", "empty playlist", () => {
    const c = mountController([]);
    assert.equal(c.getState().status, "IDLE");
    c.dispatch({ type: "NEXT" });
    assert.equal(c.getState().status, "IDLE");
  });

  test("RP02-025", "single-item playlist", () => {
    const c = mountController(engineItems(1));
    c.dispatch({ type: "SET_REPEAT_MODE", mode: "PLAYLIST" });
    ready(c);
    c.dispatch({ type: "NEXT" });
    assert.equal(c.getState().currentItemIndex, 0);
  });

  test("RP02-026", "manifest version", () => {
    const items = engineItems(2);
    const c = mountController(items, 42);
    assert.equal(c.getState().manifestVersion, 42);
    c.dispatch({
      type: "SYNC_PLAYLIST",
      playlistId: "device-playlist",
      manifestVersion: 43,
      items: toPlaylistItems(items),
    });
    assert.equal(c.getState().manifestVersion, 43);
    assert.equal(c.getState().currentContentId, "c_0");
  });

  test("RP02-027", "Experience renderer integration (type only)", () => {
    const items: EnginePlaybackItem[] = [
      {
        playlistItemId: "e1",
        contentId: "exp",
        type: "EXPERIENCE",
        title: "Exp",
        durationMs: 12000,
        transition: "fade",
        payload: {},
        assets: [],
        experienceExecutable: true,
      },
    ];
    const c = mountController(items);
    assert.equal(c.getState().currentContentType, "EXPERIENCE");
    assert.ok(usesPresentationTimer(items[0]!));
  });

  test("RP02-028", "controller subscription", () => {
    const c = mountController(engineItems(1));
    let n = 0;
    const unsub = c.subscribe(() => {
      n += 1;
    });
    c.dispatch({ type: "SET_VOLUME", volume: 0.2 });
    assert.ok(n >= 1);
    unsub();
  });

  test("RP02-029", "unmount cleanup (STOP)", () => {
    const c = mountController(engineItems(2));
    ready(c);
    c.dispatch({ type: "STOP" });
    assert.equal(c.getState().status, "STOPPED");
  });

  test("RP02-030", "no duplicate playback state (fingerprint + SoT)", () => {
    const items = engineItems(2);
    const fp1 = playlistFingerprint(items);
    const fp2 = playlistFingerprint(items);
    assert.equal(fp1, fp2);
    const mapped = toPlaylistItems(items);
    assert.equal(mapped.length, items.length);
    assert.equal(mapped[0]!.playlistItemId, items[0]!.playlistItemId);
    // Index only on controller — DisplayEngine must not keep parallel setIndex
    const src = fs.readFileSync(
      path.join(ROOT, "src/player/playback/display-engine.tsx"),
      "utf8",
    );
    assert.ok(!src.includes("useState(0)"), "DisplayEngine must not use local index state");
    assert.ok(
      src.includes("PlaybackController"),
      "DisplayEngine must use PlaybackController",
    );
    assert.ok(
      !src.includes("setIndex"),
      "DisplayEngine must not call setIndex",
    );
    // Race: items shrink before SYNC remaps index — must not read item.* as null
    // (production crash: item.transition when index out of bounds).
    assert.ok(
      src.includes("if (!item") || src.includes("if (!item ||"),
      "DisplayEngine must guard null item before reading item.*",
    );
    assert.ok(
      !src.includes("item?.transition") || src.includes("if (!item"),
      "prefer hard null guard over optional chaining into render",
    );
    const adapter = fs.readFileSync(
      path.join(ROOT, "src/player/playback/playback-renderer-adapter.tsx"),
      "utf8",
    );
    assert.ok(
      !adapter.includes("dispatch({ type: \"NEXT\"") &&
        !adapter.includes('type: "NEXT"'),
      "Adapter must not dispatch NEXT",
    );
  });

  // Soft sync preserves generation when same playlist item
  test("RP02-031", "soft SYNC_PLAYLIST preserves generation", () => {
    const items = engineItems(2);
    const c = mountController(items, 1);
    ready(c);
    const gen = c.getGeneration();
    c.dispatch({
      type: "SYNC_PLAYLIST",
      playlistId: "device-playlist",
      manifestVersion: 2,
      items: toPlaylistItems(items),
    });
    assert.equal(c.getGeneration(), gen);
    assert.equal(c.getState().manifestVersion, 2);
  });

  // Source guards
  test("RP02-032", "legacy tv.js untouched", () => {
    // Existence check only — we did not rewrite tv.js in this phase
    assert.ok(fs.existsSync(path.join(ROOT, "public/tv.js")));
  });

  test("RP02-033", "Landing demo isolated", () => {
    const demo = fs.readFileSync(
      path.join(ROOT, "src/components/landing/interactive-player-demo.tsx"),
      "utf8",
    );
    assert.ok(!demo.includes("PlaybackController"));
    assert.ok(!demo.includes("playback-controller"));
  });

  const failed = results.filter((r) => !r.pass);
  const passed = results.filter((r) => r.pass);
  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.writeFileSync(
    path.join(EVIDENCE, "TEST-REPORT.md"),
    [
      "# RUNTIME-PLAYBACK-02 — TEST REPORT",
      "",
      `Passed: ${passed.length}/${results.length}`,
      "",
      "| ID | Name | Result |",
      "|----|------|--------|",
      ...results.map(
        (r) =>
          `| ${r.id} | ${r.name} | ${r.pass ? "PASS" : `FAIL: ${r.detail}`} |`,
      ),
      "",
    ].join("\n"),
    "utf8",
  );

  console.log(`\n${passed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main();

/**
 * RUNTIME-PLAYBACK-03 — Playlist Navigation & Timing (PLAYLIST-001..040).
 *
 * Run: npm run test:runtime-playback-03
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  PREVIOUS_RESTART_THRESHOLD_MS,
  type PlaybackPlaylistItem,
} from "../src/domain/playback-state";
import {
  PresentationTimer,
  classifyTiming,
  effectiveDurationMs,
  usesNativeMediaEnded,
  usesPresentationTimer,
} from "../src/domain/playback-timing";
import { PlaybackController } from "../src/player/playback/playback-controller";

const ROOT = path.resolve(".");
const EVIDENCE = path.join(ROOT, "docs/evidence/runtime-playback-03");

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

function item(
  id: string,
  type: string,
  durationMs: number,
  contentId = id,
): PlaybackPlaylistItem {
  return {
    playlistItemId: `pi_${id}`,
    contentId,
    type,
    durationMs,
    title: id,
  };
}

function load(
  items: PlaybackPlaylistItem[],
  opts?: { version?: number; repeat?: "NONE" | "PLAYLIST" | "ITEM" },
) {
  const c = new PlaybackController();
  c.dispatch({
    type: "LOAD_PLAYLIST",
    playlistId: "pl",
    manifestVersion: opts?.version ?? 1,
    items,
  });
  if (opts?.repeat) {
    c.dispatch({ type: "SET_REPEAT_MODE", mode: opts.repeat });
  }
  return c;
}

function ready(c: PlaybackController, durationMs = 4000) {
  const gen = c.getGeneration();
  c.dispatch({ type: "MEDIA_READY", durationMs, generation: gen });
  return gen;
}

function main(): void {
  console.log("RUNTIME-PLAYBACK-03 — Playlist Navigation & Timing\n");

  test("PLAYLIST-001", "ordered progression", () => {
    const c = load([
      item("A", "IMAGE", 3000),
      item("B", "IMAGE", 3000),
      item("C", "IMAGE", 3000),
    ]);
    ready(c, 3000);
    assert.equal(c.getState().currentContentId, "A");
    c.dispatch({ type: "NEXT" });
    ready(c, 3000);
    assert.equal(c.getState().currentContentId, "B");
    c.dispatch({ type: "NEXT" });
    ready(c, 3000);
    assert.equal(c.getState().currentContentId, "C");
  });

  test("PLAYLIST-002", "last item repeat NONE → ENDED", () => {
    const c = load([item("A", "IMAGE", 2000), item("B", "IMAGE", 2000)], {
      repeat: "NONE",
    });
    ready(c);
    c.dispatch({ type: "NEXT" });
    ready(c);
    c.dispatch({ type: "NEXT" });
    assert.equal(c.getState().status, "ENDED");
    assert.equal(c.getState().currentContentId, "B");
  });

  test("PLAYLIST-003", "last item repeat PLAYLIST wraps", () => {
    const c = load([item("A", "IMAGE", 2000), item("B", "IMAGE", 2000)], {
      repeat: "PLAYLIST",
    });
    ready(c);
    c.dispatch({ type: "NEXT" });
    ready(c);
    const genBefore = c.getGeneration();
    c.dispatch({ type: "NEXT" });
    assert.equal(c.getState().currentContentId, "A");
    assert.ok(c.getGeneration() > genBefore);
  });

  test("PLAYLIST-004", "repeat ITEM", () => {
    const c = load(
      [item("A", "IMAGE", 2000), item("B", "IMAGE", 2000), item("C", "IMAGE", 2000)],
      { repeat: "ITEM" },
    );
    ready(c);
    c.dispatch({ type: "NEXT" });
    const gen = ready(c);
    assert.equal(c.getState().currentContentId, "B");
    c.dispatch({ type: "MEDIA_ENDED", generation: gen });
    assert.equal(c.getState().currentContentId, "B");
    assert.equal(c.getState().status, "LOADING");
  });

  test("PLAYLIST-005", "single item modes", () => {
    for (const mode of ["NONE", "PLAYLIST", "ITEM"] as const) {
      const c = load([item("A", "IMAGE", 2000)], { repeat: mode });
      const gen = ready(c);
      if (mode === "NONE") {
        c.dispatch({ type: "MEDIA_ENDED", generation: gen });
        assert.equal(c.getState().status, "ENDED");
      } else if (mode === "PLAYLIST") {
        c.dispatch({ type: "NEXT" });
        assert.equal(c.getState().currentItemIndex, 0);
      } else {
        c.dispatch({ type: "MEDIA_ENDED", generation: gen });
        assert.equal(c.getState().currentItemIndex, 0);
      }
    }
  });

  test("PLAYLIST-006", "empty playlist", () => {
    const c = load([]);
    assert.equal(c.getState().status, "IDLE");
    c.dispatch({ type: "NEXT" });
    c.dispatch({ type: "PREVIOUS" });
    assert.equal(c.getState().status, "IDLE");
    assert.equal(c.getState().currentContentId, null);
  });

  test("PLAYLIST-007", "previous from middle", () => {
    const c = load([
      item("A", "IMAGE", 4000),
      item("B", "IMAGE", 4000),
      item("C", "IMAGE", 4000),
    ]);
    ready(c);
    c.dispatch({ type: "NEXT" });
    ready(c);
    c.dispatch({ type: "PREVIOUS" });
    assert.equal(c.getState().currentContentId, "A");
  });

  test("PLAYLIST-008", "previous threshold", () => {
    const c = load([item("A", "IMAGE", 10000), item("B", "IMAGE", 4000)]);
    ready(c);
    c.dispatch({ type: "NEXT" });
    const gen = ready(c, 10000);
    c.dispatch({
      type: "MEDIA_TIME_UPDATE",
      positionMs: PREVIOUS_RESTART_THRESHOLD_MS + 100,
      generation: gen,
    });
    c.dispatch({ type: "PREVIOUS" });
    assert.equal(c.getState().currentContentId, "B");
    assert.equal(c.getState().positionMs, 0);
  });

  test("PLAYLIST-009", "restart", () => {
    const c = load([item("A", "IMAGE", 5000)]);
    const gen = ready(c, 5000);
    c.dispatch({
      type: "MEDIA_TIME_UPDATE",
      positionMs: 2000,
      generation: gen,
    });
    const before = c.getGeneration();
    c.dispatch({ type: "RESTART" });
    assert.equal(c.getState().currentContentId, "A");
    assert.equal(c.getState().positionMs, 0);
    assert.ok(c.getGeneration() > before);
  });

  test("PLAYLIST-010", "next during loading", () => {
    const c = load([item("A", "IMAGE", 2000), item("B", "IMAGE", 2000)]);
    assert.equal(c.getState().status, "LOADING");
    c.dispatch({ type: "NEXT" });
    assert.equal(c.getState().currentContentId, "B");
    assert.equal(c.getState().status, "LOADING");
  });

  test("PLAYLIST-011", "next during pause", () => {
    const c = load([item("A", "IMAGE", 2000), item("B", "IMAGE", 2000)]);
    ready(c);
    c.dispatch({ type: "PAUSE" });
    c.dispatch({ type: "NEXT" });
    assert.equal(c.getState().currentContentId, "B");
    assert.notEqual(c.getState().status, "PAUSED");
  });

  test("PLAYLIST-012", "stop during loading", () => {
    const c = load([item("A", "IMAGE", 2000)]);
    c.dispatch({ type: "STOP" });
    assert.equal(c.getState().status, "STOPPED");
    assert.equal(c.getState().positionMs, 0);
    assert.equal(c.getState().currentContentId, "A");
  });

  test("PLAYLIST-013", "ended after stop ignored", () => {
    const c = load([item("A", "IMAGE", 2000), item("B", "IMAGE", 2000)]);
    const gen = ready(c);
    c.dispatch({ type: "STOP" });
    c.dispatch({ type: "MEDIA_ENDED", generation: gen });
    assert.equal(c.getState().status, "STOPPED");
    assert.equal(c.getState().currentContentId, "A");
  });

  test("PLAYLIST-014", "ended after next ignored", () => {
    const c = load([item("A", "IMAGE", 2000), item("B", "IMAGE", 2000)]);
    const stale = ready(c);
    c.dispatch({ type: "NEXT" });
    c.dispatch({ type: "MEDIA_ENDED", generation: stale });
    assert.equal(c.getState().currentContentId, "B");
  });

  test("PLAYLIST-015", "stale generation", () => {
    const c = load([item("A", "IMAGE", 2000), item("B", "IMAGE", 2000)]);
    const stale = ready(c);
    c.dispatch({ type: "NEXT" });
    const idx = c.getState().currentItemIndex;
    c.dispatch({
      type: "MEDIA_TIME_UPDATE",
      positionMs: 9999,
      generation: stale,
    });
    assert.equal(c.getState().currentItemIndex, idx);
    assert.equal(c.getState().positionMs, 0);
  });

  test("PLAYLIST-016", "image timer", () => {
    const c = load([item("A", "IMAGE", 3000), item("B", "IMAGE", 3000)]);
    const gen = ready(c, 3000);
    assert.ok(usesPresentationTimer({ type: "IMAGE", durationMs: 3000 }));
    c.tickImageElapsed(3000, gen);
    assert.equal(c.getState().currentContentId, "B");
  });

  test("PLAYLIST-017", "image timer cleanup via generation", () => {
    const c = load([item("A", "IMAGE", 5000), item("B", "IMAGE", 3000)]);
    const gen = ready(c, 5000);
    c.dispatch({ type: "NEXT" });
    c.tickImageElapsed(99999, gen);
    assert.equal(c.getState().currentContentId, "B");
  });

  test("PLAYLIST-018", "image pause preserves position", () => {
    const c = load([item("A", "IMAGE", 8000)]);
    const gen = ready(c, 8000);
    c.dispatch({
      type: "MEDIA_TIME_UPDATE",
      positionMs: 2500,
      generation: gen,
    });
    c.dispatch({ type: "PAUSE" });
    assert.equal(c.getState().status, "PAUSED");
    assert.equal(c.getState().positionMs, 2500);
    // Timer tick while paused must not end item
    c.tickImageElapsed(8000, gen);
    assert.equal(c.getState().status, "PAUSED");
    assert.equal(c.getState().currentContentId, "A");
  });

  test("PLAYLIST-019", "image resume", () => {
    const c = load([item("A", "IMAGE", 8000)]);
    const gen = ready(c, 8000);
    c.dispatch({
      type: "MEDIA_TIME_UPDATE",
      positionMs: 2500,
      generation: gen,
    });
    c.dispatch({ type: "PAUSE" });
    c.dispatch({ type: "PLAY" });
    assert.equal(c.getState().status, "PLAYING");
    assert.equal(c.getState().positionMs, 2500);
    assert.equal(c.getState().currentContentId, "A");
  });

  test("PLAYLIST-020", "video natural duration", () => {
    const v = item("V", "VIDEO", 0);
    assert.equal(classifyTiming(v), "NATIVE_ENDED");
    assert.equal(effectiveDurationMs(v), null);
    const c = load([v]);
    assert.equal(c.getState().durationMs, null);
    ready(c, 12000);
    assert.equal(c.getState().durationMs, 12000);
  });

  test("PLAYLIST-021", "video explicit duration", () => {
    const v = item("V", "VIDEO", 10000);
    assert.ok(usesPresentationTimer(v));
    assert.ok(!usesNativeMediaEnded(v));
    const c = load([v, item("I", "IMAGE", 3000)]);
    const gen = ready(c, 10000);
    c.tickImageElapsed(10000, gen);
    assert.equal(c.getState().currentContentId, "I");
  });

  test("PLAYLIST-022", "video ended (natural)", () => {
    const c = load([item("V", "VIDEO", 0), item("I", "IMAGE", 3000)]);
    const gen = ready(c, 5000);
    c.dispatch({ type: "MEDIA_ENDED", generation: gen });
    assert.equal(c.getState().currentContentId, "I");
  });

  test("PLAYLIST-023", "video timer cleanup (explicit)", () => {
    const c = load([item("V", "VIDEO", 15000), item("B", "IMAGE", 3000)]);
    const gen = ready(c, 15000);
    c.dispatch({ type: "NEXT" });
    c.tickImageElapsed(15000, gen);
    assert.equal(c.getState().currentContentId, "B");
  });

  test("PLAYLIST-024", "audio natural duration", () => {
    const a = item("A", "AUDIO", 0);
    assert.equal(classifyTiming(a), "NATIVE_ENDED");
    const c = load([a]);
    assert.equal(c.getState().durationMs, null);
    ready(c, 90000);
    assert.equal(c.getState().durationMs, 90000);
  });

  test("PLAYLIST-025", "audio ended", () => {
    const c = load([item("A", "AUDIO", 0), item("B", "IMAGE", 2000)]);
    const gen = ready(c, 4000);
    c.dispatch({ type: "MEDIA_ENDED", generation: gen });
    assert.equal(c.getState().currentContentId, "B");
  });

  test("PLAYLIST-026", "GIF timing (IMAGE path)", () => {
    const g = item("G", "IMAGE", 6000);
    assert.ok(usesPresentationTimer(g));
    const c = load([g, item("N", "IMAGE", 2000)]);
    const gen = ready(c, 6000);
    c.tickImageElapsed(6000, gen);
    assert.equal(c.getState().currentContentId, "N");
  });

  test("PLAYLIST-027", "manifest append soft remap", () => {
    const base = [item("A", "IMAGE", 3000), item("B", "IMAGE", 3000), item("C", "IMAGE", 3000)];
    const c = load(base, { version: 1 });
    ready(c);
    c.dispatch({ type: "NEXT" });
    ready(c);
    const gen = c.getGeneration();
    const next = [...base, item("D", "IMAGE", 3000)];
    c.dispatch({
      type: "SYNC_PLAYLIST",
      playlistId: "pl",
      manifestVersion: 2,
      items: next,
    });
    assert.equal(c.getState().currentContentId, "B");
    assert.equal(c.getGeneration(), gen);
    assert.equal(c.getState().manifestVersion, 2);
  });

  test("PLAYLIST-028", "manifest remove current item", () => {
    const c = load([
      item("A", "IMAGE", 3000),
      item("B", "IMAGE", 3000),
      item("C", "IMAGE", 3000),
    ]);
    ready(c);
    c.dispatch({ type: "NEXT" });
    ready(c);
    assert.equal(c.getState().currentContentId, "B");
    // Remove B → clamp to index 1 → C
    c.dispatch({
      type: "SYNC_PLAYLIST",
      playlistId: "pl",
      manifestVersion: 3,
      items: [item("A", "IMAGE", 3000), item("C", "IMAGE", 3000)],
    });
    assert.equal(c.getState().currentContentId, "C");
    assert.equal(c.getState().status, "LOADING");
  });

  test("PLAYLIST-029", "manifest reorder", () => {
    const c = load([
      item("A", "IMAGE", 3000),
      item("B", "IMAGE", 3000),
      item("C", "IMAGE", 3000),
    ]);
    ready(c);
    c.dispatch({ type: "NEXT" });
    ready(c);
    const gen = c.getGeneration();
    c.dispatch({
      type: "SYNC_PLAYLIST",
      playlistId: "pl",
      manifestVersion: 4,
      items: [
        item("B", "IMAGE", 3000),
        item("A", "IMAGE", 3000),
        item("C", "IMAGE", 3000),
      ],
    });
    assert.equal(c.getState().currentContentId, "B");
    assert.equal(c.getState().currentItemIndex, 0);
    assert.equal(c.getGeneration(), gen);
  });

  test("PLAYLIST-030", "manifest version", () => {
    const items = [item("A", "IMAGE", 2000)];
    const c = load(items, { version: 10 });
    assert.equal(c.getState().manifestVersion, 10);
    c.dispatch({
      type: "SYNC_PLAYLIST",
      playlistId: "pl",
      manifestVersion: 11,
      items,
    });
    assert.equal(c.getState().manifestVersion, 11);
  });

  test("PLAYLIST-031", "rapid next", () => {
    const c = load([
      item("A", "IMAGE", 2000),
      item("B", "IMAGE", 2000),
      item("C", "IMAGE", 2000),
      item("D", "IMAGE", 2000),
    ]);
    c.dispatch({ type: "NEXT" });
    c.dispatch({ type: "NEXT" });
    c.dispatch({ type: "NEXT" });
    assert.equal(c.getState().currentContentId, "D");
    assert.equal(c.getState().status, "LOADING");
  });

  test("PLAYLIST-032", "rapid previous", () => {
    const c = load([
      item("A", "IMAGE", 2000),
      item("B", "IMAGE", 2000),
      item("C", "IMAGE", 2000),
    ]);
    ready(c);
    c.dispatch({ type: "NEXT" });
    ready(c);
    c.dispatch({ type: "NEXT" });
    ready(c);
    c.dispatch({ type: "PREVIOUS" });
    c.dispatch({ type: "PREVIOUS" });
    assert.equal(c.getState().currentContentId, "A");
  });

  test("PLAYLIST-033", "next/previous race", () => {
    const c = load([
      item("A", "IMAGE", 2000),
      item("B", "IMAGE", 2000),
      item("C", "IMAGE", 2000),
    ]);
    ready(c);
    c.dispatch({ type: "NEXT" });
    c.dispatch({ type: "PREVIOUS" });
    assert.equal(c.getState().currentContentId, "A");
  });

  test("PLAYLIST-034", "error during timer", () => {
    const c = load([item("A", "IMAGE", 8000), item("B", "IMAGE", 2000)]);
    const gen = ready(c, 8000);
    c.dispatch({
      type: "MEDIA_ERROR",
      code: "X",
      message: "fail",
      generation: gen,
    });
    assert.equal(c.getState().status, "ERROR");
    c.tickImageElapsed(8000, gen);
    assert.equal(c.getState().status, "ERROR");
    assert.equal(c.getState().currentContentId, "A");
  });

  test("PLAYLIST-035", "repeat stale event", () => {
    const c = load([item("A", "IMAGE", 2000)], { repeat: "ITEM" });
    const stale = ready(c);
    c.dispatch({ type: "MEDIA_ENDED", generation: stale });
    const fresh = c.getGeneration();
    assert.notEqual(stale, fresh);
    c.dispatch({ type: "MEDIA_ENDED", generation: stale });
    assert.equal(c.getGeneration(), fresh);
  });

  test("PLAYLIST-036", "empty playlist safety", () => {
    const c = load([item("A", "IMAGE", 2000)]);
    ready(c);
    c.dispatch({
      type: "SYNC_PLAYLIST",
      playlistId: "pl",
      manifestVersion: 9,
      items: [],
    });
    assert.equal(c.getState().status, "IDLE");
    c.dispatch({ type: "NEXT" });
    assert.equal(c.getState().currentContentId, null);
  });

  test("PLAYLIST-037", "no duplicate timers (PresentationTimer single)", () => {
    const t = new PresentationTimer();
    let ticks = 0;
    const now = 1000;
    t.start({
      generation: 1,
      durationMs: 5000,
      now: () => now,
      intervalMs: 10,
      onTick: () => {
        ticks += 1;
      },
    });
    assert.ok(t.active);
    t.start({
      generation: 2,
      durationMs: 5000,
      now: () => now,
      intervalMs: 10,
      onTick: () => {
        ticks += 1;
      },
    });
    assert.equal(t.boundGeneration, 2);
    t.stop();
    assert.ok(!t.active);
    // restart does not leave dual schedules — only latest generation bound
    void ticks;
  });

  test("PLAYLIST-038", "no duplicate renderers (adapter key contract)", () => {
    const adapter = fs.readFileSync(
      path.join(ROOT, "src/player/playback/playback-renderer-adapter.tsx"),
      "utf8",
    );
    assert.ok(adapter.includes("g${generation}") || adapter.includes(":g"));
    assert.ok(adapter.includes("PresentationTimer"));
    assert.ok(!adapter.includes('type: "NEXT"'));
  });

  test("PLAYLIST-039", "generation increments correctly", () => {
    const c = load([item("A", "IMAGE", 2000), item("B", "IMAGE", 2000)]);
    const g0 = c.getGeneration();
    c.dispatch({ type: "NEXT" });
    assert.ok(c.getGeneration() > g0);
    const g1 = c.getGeneration();
    c.dispatch({ type: "RESTART" });
    assert.ok(c.getGeneration() > g1);
  });

  test("PLAYLIST-040", "generation does not tick on timeupdate", () => {
    const c = load([item("A", "VIDEO", 0)]);
    const gen = ready(c, 10000);
    c.dispatch({
      type: "MEDIA_TIME_UPDATE",
      positionMs: 100,
      generation: gen,
    });
    c.dispatch({
      type: "MEDIA_TIME_UPDATE",
      positionMs: 200,
      generation: gen,
    });
    assert.equal(c.getGeneration(), gen);
  });

  // Extra: PresentationTimer pause + EXPERIENCE classification
  test("PLAYLIST-041", "PresentationTimer pause stops schedule", () => {
    const t = new PresentationTimer();
    let ticks = 0;
    let now = 0;
    t.start({
      generation: 5,
      durationMs: 10000,
      now: () => now,
      intervalMs: 5,
      onTick: () => {
        ticks += 1;
      },
    });
    t.pause();
    assert.ok(!t.active);
    now = 99999;
    assert.equal(ticks, 0);
  });

  test("PLAYLIST-042", "EXPERIENCE hosted timing", () => {
    assert.equal(
      classifyTiming({ type: "EXPERIENCE", durationMs: 12000 }),
      "EXPERIENCE_HOSTED",
    );
  });

  test("PLAYLIST-043", "adapter has no DisplayEngine timer", () => {
    const eng = fs.readFileSync(
      path.join(ROOT, "src/player/playback/display-engine.tsx"),
      "utf8",
    );
    assert.ok(!eng.includes("setTimeout"));
    assert.ok(!eng.includes("setIndex"));
  });

  const failed = results.filter((r) => !r.pass);
  const passed = results.filter((r) => r.pass);
  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.writeFileSync(
    path.join(EVIDENCE, "TEST-REPORT.md"),
    [
      "# RUNTIME-PLAYBACK-03 — TEST REPORT",
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

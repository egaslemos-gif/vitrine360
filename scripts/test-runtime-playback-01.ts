/**
 * RUNTIME-PLAYBACK-01 — Playback State Model unit tests (TEST 001–030).
 *
 * Run: npm run test:runtime-playback-01
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  PLAYBACK_TRANSITIONS,
  PREVIOUS_RESTART_THRESHOLD_MS,
  canTransition,
  clampVolume,
  createInitialPlaybackState,
  isPlaybackStatus,
  type PlaybackPlaylistItem,
  type PlaybackState,
} from "../src/domain/playback-state";
import { PlaybackController } from "../src/player/playback/playback-controller";

const ROOT = path.resolve(".");
const EVIDENCE = path.join(ROOT, "docs/evidence/runtime-playback-01");

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

function items(n: number, opts?: { reuseContent?: boolean }): PlaybackPlaylistItem[] {
  const out: PlaybackPlaylistItem[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      playlistItemId: `pi_${i}`,
      contentId: opts?.reuseContent ? "content_shared" : `c_${i}`,
      type: i % 2 === 0 ? "IMAGE" : "VIDEO",
      durationMs: i % 2 === 0 ? 5000 : 0,
      title: `Item ${i}`,
    });
  }
  return out;
}

function loadPlaying(ctrl: PlaybackController, list = items(3)): PlaybackState {
  ctrl.dispatch({
    type: "LOAD_PLAYLIST",
    playlistId: "pl_1",
    manifestVersion: 12,
    items: list,
  });
  const gen = ctrl.getGeneration();
  ctrl.dispatch({ type: "MEDIA_READY", durationMs: 5000, generation: gen });
  return ctrl.getState();
}

function main(): void {
  console.log("RUNTIME-PLAYBACK-01 — Playback State Model\n");

  // 001
  test("001", "Initial state IDLE", () => {
    const s = createInitialPlaybackState(1);
    assert.equal(s.status, "IDLE");
    assert.equal(s.currentContentId, null);
    assert.equal(s.positionMs, 0);
    assert.equal(s.durationMs, null);
    assert.equal(s.shuffle, false);
  });

  // 002
  test("002", "IDLE → LOADING", () => {
    const c = new PlaybackController({ now: () => 100 });
    c.dispatch({
      type: "LOAD_PLAYLIST",
      playlistId: "pl",
      manifestVersion: 1,
      items: items(1),
    });
    assert.equal(c.getState().status, "LOADING");
    assert.ok(canTransition("IDLE", "LOADING"));
  });

  // 003
  test("003", "LOADING → PLAYING", () => {
    const c = new PlaybackController();
    c.dispatch({
      type: "LOAD_PLAYLIST",
      playlistId: "pl",
      manifestVersion: 1,
      items: items(1),
    });
    const gen = c.getGeneration();
    c.dispatch({ type: "MEDIA_READY", durationMs: 5000, generation: gen });
    assert.equal(c.getState().status, "PLAYING");
  });

  // 004
  test("004", "PLAYING → PAUSED", () => {
    const c = new PlaybackController();
    loadPlaying(c);
    c.dispatch({ type: "PAUSE" });
    assert.equal(c.getState().status, "PAUSED");
  });

  // 005
  test("005", "PAUSED → PLAYING", () => {
    const c = new PlaybackController();
    loadPlaying(c);
    c.dispatch({ type: "PAUSE" });
    c.dispatch({ type: "PLAY" });
    assert.equal(c.getState().status, "PLAYING");
  });

  // 006
  test("006", "PLAYING → STOPPED", () => {
    const c = new PlaybackController();
    loadPlaying(c);
    const before = c.getState();
    c.dispatch({ type: "STOP" });
    const s = c.getState();
    assert.equal(s.status, "STOPPED");
    assert.equal(s.positionMs, 0);
    assert.equal(s.playlistId, before.playlistId);
    assert.equal(s.currentItemIndex, before.currentItemIndex);
    assert.equal(s.currentContentId, before.currentContentId);
  });

  // 007
  test("007", "PLAYING → ENDED", () => {
    const c = new PlaybackController();
    const list = items(1);
    list[0]!.durationMs = 3000;
    c.dispatch({
      type: "LOAD_PLAYLIST",
      playlistId: "pl",
      manifestVersion: 1,
      items: list,
    });
    c.dispatch({ type: "SET_REPEAT_MODE", mode: "NONE" });
    const gen = c.getGeneration();
    c.dispatch({ type: "MEDIA_READY", durationMs: 3000, generation: gen });
    c.dispatch({ type: "MEDIA_ENDED", generation: gen });
    assert.equal(c.getState().status, "ENDED");
  });

  // 008
  test("008", "PLAYING → ERROR", () => {
    const c = new PlaybackController();
    loadPlaying(c);
    const gen = c.getGeneration();
    c.dispatch({
      type: "MEDIA_ERROR",
      code: "MEDIA_DECODE",
      message: "decode failed",
      generation: gen,
    });
    const s = c.getState();
    assert.equal(s.status, "ERROR");
    assert.ok(s.error);
    assert.equal(s.error!.code, "MEDIA_DECODE");
    assert.equal(s.error!.recoverable, true);
  });

  // 009
  test("009", "NEXT increments item", () => {
    const c = new PlaybackController();
    loadPlaying(c, items(3));
    assert.equal(c.getState().currentItemIndex, 0);
    c.dispatch({ type: "NEXT" });
    assert.equal(c.getState().currentItemIndex, 1);
    assert.equal(c.getState().status, "LOADING");
    assert.equal(c.getState().positionMs, 0);
  });

  // 010
  test("010", "NEXT last + repeat PLAYLIST wraps", () => {
    const c = new PlaybackController();
    loadPlaying(c, items(2));
    c.dispatch({ type: "SET_REPEAT_MODE", mode: "PLAYLIST" });
    c.dispatch({ type: "NEXT" });
    assert.equal(c.getState().currentItemIndex, 1);
    c.dispatch({ type: "NEXT" });
    assert.equal(c.getState().currentItemIndex, 0);
    assert.equal(c.getState().status, "LOADING");
  });

  // 011
  test("011", "NEXT last + repeat NONE → ENDED", () => {
    const c = new PlaybackController();
    loadPlaying(c, items(2));
    c.dispatch({ type: "SET_REPEAT_MODE", mode: "NONE" });
    c.dispatch({ type: "NEXT" });
    assert.equal(c.getState().currentItemIndex, 1);
    const gen = c.getGeneration();
    c.dispatch({ type: "MEDIA_READY", durationMs: 5000, generation: gen });
    c.dispatch({ type: "NEXT" });
    assert.equal(c.getState().status, "ENDED");
  });

  // 012
  test("012", "PREVIOUS goes to prior item", () => {
    const c = new PlaybackController();
    loadPlaying(c, items(3));
    c.dispatch({ type: "NEXT" });
    const gen = c.getGeneration();
    c.dispatch({ type: "MEDIA_READY", durationMs: 5000, generation: gen });
    assert.equal(c.getState().currentItemIndex, 1);
    c.dispatch({ type: "PREVIOUS" });
    assert.equal(c.getState().currentItemIndex, 0);
  });

  // 013
  test("013", "PREVIOUS with position > 3s restarts", () => {
    const c = new PlaybackController();
    loadPlaying(c, items(3));
    c.dispatch({ type: "NEXT" });
    const gen = c.getGeneration();
    c.dispatch({ type: "MEDIA_READY", durationMs: 10000, generation: gen });
    c.dispatch({
      type: "MEDIA_TIME_UPDATE",
      positionMs: PREVIOUS_RESTART_THRESHOLD_MS + 1,
      generation: gen,
    });
    const idx = c.getState().currentItemIndex;
    c.dispatch({ type: "PREVIOUS" });
    assert.equal(c.getState().currentItemIndex, idx);
    assert.equal(c.getState().positionMs, 0);
    assert.equal(c.getState().status, "LOADING");
  });

  // 014
  test("014", "RESTART", () => {
    const c = new PlaybackController();
    loadPlaying(c);
    const gen = c.getGeneration();
    c.dispatch({
      type: "MEDIA_TIME_UPDATE",
      positionMs: 2000,
      generation: gen,
    });
    c.dispatch({ type: "RESTART" });
    assert.equal(c.getState().positionMs, 0);
    assert.equal(c.getState().status, "LOADING");
  });

  // 015
  test("015", "SEEK valid", () => {
    const c = new PlaybackController();
    loadPlaying(c);
    c.dispatch({ type: "SEEK", positionMs: 1500 });
    assert.equal(c.getState().positionMs, 1500);
  });

  // 016
  test("016", "SEEK negative rejected/clamped", () => {
    const c = new PlaybackController();
    loadPlaying(c);
    c.dispatch({ type: "SEEK", positionMs: -100 });
    assert.equal(c.getState().positionMs, 0);
    c.dispatch({ type: "SEEK", positionMs: Number.NaN });
    assert.equal(c.getState().positionMs, 0);
  });

  // 017
  test("017", "SEEK > duration clamped", () => {
    const c = new PlaybackController();
    loadPlaying(c);
    c.dispatch({ type: "SEEK", positionMs: 99999 });
    assert.equal(c.getState().positionMs, 5000);
    c.dispatch({ type: "SEEK", positionMs: Number.POSITIVE_INFINITY });
    assert.equal(c.getState().positionMs, 5000);
  });

  // 018
  test("018", "Volume clamp", () => {
    assert.equal(clampVolume(1.5), 1);
    assert.equal(clampVolume(-0.2), 0);
    assert.equal(clampVolume(0.4), 0.4);
    const c = new PlaybackController();
    c.dispatch({ type: "SET_VOLUME", volume: 2 });
    assert.equal(c.getState().volume, 1);
    c.dispatch({ type: "SET_VOLUME", volume: -1 });
    assert.equal(c.getState().volume, 0);
  });

  // 019
  test("019", "Mute preserves volume", () => {
    const c = new PlaybackController();
    c.dispatch({ type: "SET_VOLUME", volume: 0.7 });
    c.dispatch({ type: "SET_MUTED", muted: true });
    assert.equal(c.getState().muted, true);
    assert.equal(c.getState().volume, 0.7);
    c.dispatch({ type: "SET_MUTED", muted: false });
    assert.equal(c.getState().volume, 0.7);
  });

  // 020
  test("020", "Subscribe/unsubscribe", () => {
    const c = new PlaybackController();
    let calls = 0;
    const unsub = c.subscribe(() => {
      calls += 1;
    });
    c.dispatch({ type: "SET_VOLUME", volume: 0.5 });
    assert.ok(calls >= 1);
    const after = calls;
    unsub();
    c.dispatch({ type: "SET_VOLUME", volume: 0.2 });
    assert.equal(calls, after);
  });

  // 021
  test("021", "Stale event ignored", () => {
    const c = new PlaybackController();
    loadPlaying(c, items(2));
    const staleGen = c.getGeneration();
    c.dispatch({ type: "NEXT" });
    const freshGen = c.getGeneration();
    assert.notEqual(staleGen, freshGen);
    c.dispatch({ type: "MEDIA_ENDED", generation: staleGen });
    assert.equal(c.getState().currentItemIndex, 1);
    assert.notEqual(c.getState().status, "ENDED");
  });

  // 022
  test("022", "NEXT during LOAD", () => {
    const c = new PlaybackController();
    c.dispatch({
      type: "LOAD_PLAYLIST",
      playlistId: "pl",
      manifestVersion: 1,
      items: items(3),
    });
    assert.equal(c.getState().status, "LOADING");
    c.dispatch({ type: "NEXT" });
    assert.equal(c.getState().currentItemIndex, 1);
    assert.equal(c.getState().status, "LOADING");
  });

  // 023
  test("023", "STOP during LOAD", () => {
    const c = new PlaybackController();
    c.dispatch({
      type: "LOAD_PLAYLIST",
      playlistId: "pl",
      manifestVersion: 1,
      items: items(2),
    });
    const idx = c.getState().currentItemIndex;
    const cid = c.getState().currentContentId;
    c.dispatch({ type: "STOP" });
    const s = c.getState();
    assert.equal(s.status, "STOPPED");
    assert.equal(s.positionMs, 0);
    assert.equal(s.currentItemIndex, idx);
    assert.equal(s.currentContentId, cid);
  });

  // 024
  test("024", "ERROR then retry/loading", () => {
    const c = new PlaybackController();
    loadPlaying(c);
    const gen = c.getGeneration();
    c.dispatch({
      type: "MEDIA_ERROR",
      code: "NETWORK",
      message: "fail",
      generation: gen,
    });
    assert.equal(c.getState().status, "ERROR");
    c.dispatch({ type: "PLAY" });
    assert.equal(c.getState().status, "LOADING");
    assert.equal(c.getState().error, null);
  });

  // 025
  test("025", "Playlist content reused in multiple items", () => {
    const c = new PlaybackController();
    const list = items(3, { reuseContent: true });
    loadPlaying(c, list);
    assert.equal(c.getState().currentContentId, "content_shared");
    c.dispatch({ type: "NEXT" });
    assert.equal(c.getState().currentContentId, "content_shared");
    assert.equal(c.getState().currentPlaylistItemId, "pi_1");
    assert.notEqual(
      c.getState().currentPlaylistItemId,
      list[0]!.playlistItemId,
    );
  });

  // 026
  test("026", "currentIndex != content identity", () => {
    const list: PlaybackPlaylistItem[] = [
      {
        playlistItemId: "a",
        contentId: "same",
        type: "IMAGE",
        durationMs: 4000,
      },
      {
        playlistItemId: "b",
        contentId: "same",
        type: "IMAGE",
        durationMs: 4000,
      },
    ];
    const c = new PlaybackController();
    loadPlaying(c, list);
    assert.equal(c.getState().currentItemIndex, 0);
    assert.equal(c.getState().currentContentId, "same");
    c.dispatch({ type: "NEXT" });
    assert.equal(c.getState().currentItemIndex, 1);
    assert.equal(c.getState().currentContentId, "same");
    assert.equal(c.getState().currentPlaylistItemId, "b");
  });

  // 027
  test("027", "Manifest version preserved", () => {
    const c = new PlaybackController();
    loadPlaying(c);
    assert.equal(c.getState().manifestVersion, 12);
    c.dispatch({ type: "NEXT" });
    assert.equal(c.getState().manifestVersion, 12);
    c.dispatch({ type: "PAUSE" });
    // still loading after next — pause may no-op if LOADING
    const gen = c.getGeneration();
    c.dispatch({ type: "MEDIA_READY", durationMs: 5000, generation: gen });
    c.dispatch({ type: "PAUSE" });
    assert.equal(c.getState().manifestVersion, 12);
  });

  // 028
  test("028", "Natural video duration", () => {
    const list: PlaybackPlaylistItem[] = [
      {
        playlistItemId: "v1",
        contentId: "vid",
        type: "VIDEO",
        durationMs: 0, // natural
      },
    ];
    const c = new PlaybackController();
    c.dispatch({
      type: "LOAD_PLAYLIST",
      playlistId: "pl",
      manifestVersion: 3,
      items: list,
    });
    assert.equal(c.getState().durationMs, null);
    const gen = c.getGeneration();
    c.dispatch({ type: "MEDIA_READY", durationMs: 12345, generation: gen });
    assert.equal(c.getState().durationMs, 12345);
    assert.equal(c.getState().status, "PLAYING");
  });

  // 029
  test("029", "IMAGE timing", () => {
    const list: PlaybackPlaylistItem[] = [
      {
        playlistItemId: "img",
        contentId: "i1",
        type: "IMAGE",
        durationMs: 4000,
      },
      {
        playlistItemId: "img2",
        contentId: "i2",
        type: "IMAGE",
        durationMs: 4000,
      },
    ];
    const c = new PlaybackController();
    c.dispatch({
      type: "LOAD_PLAYLIST",
      playlistId: "pl",
      manifestVersion: 1,
      items: list,
    });
    const gen = c.getGeneration();
    c.dispatch({ type: "MEDIA_READY", durationMs: 4000, generation: gen });
    assert.equal(c.getState().status, "PLAYING");
    c.tickImageElapsed(4000, gen);
    assert.equal(c.getState().currentItemIndex, 1);
  });

  // 030
  test("030", "VIDEO error fallback", () => {
    const list: PlaybackPlaylistItem[] = [
      {
        playlistItemId: "v",
        contentId: "bad",
        type: "VIDEO",
        durationMs: 0,
      },
      {
        playlistItemId: "ok",
        contentId: "good",
        type: "IMAGE",
        durationMs: 3000,
      },
    ];
    const c = new PlaybackController();
    c.dispatch({
      type: "LOAD_PLAYLIST",
      playlistId: "pl",
      manifestVersion: 1,
      items: list,
    });
    const gen = c.getGeneration();
    c.dispatch({
      type: "MEDIA_ERROR",
      code: "MEDIA_ERROR",
      message: "video failed",
      recoverable: true,
      generation: gen,
    });
    assert.equal(c.getState().status, "ERROR");
    // Controller does not auto-skip — renderer/host may NEXT; verify NEXT works
    c.dispatch({ type: "NEXT" });
    assert.equal(c.getState().currentContentId, "good");
    assert.equal(c.getState().status, "LOADING");
  });

  // Extra: transition table sanity + snapshot immutability
  test("X01", "Transition table covers all statuses", () => {
    for (const status of Object.keys(PLAYBACK_TRANSITIONS)) {
      assert.ok(isPlaybackStatus(status));
    }
  });

  test("X02", "getState returns snapshot not live ref", () => {
    const c = new PlaybackController();
    loadPlaying(c);
    const a = c.getState();
    const b = c.getState();
    assert.notEqual(a, b);
    a.positionMs = 999;
    assert.notEqual(c.getState().positionMs, 999);
  });

  test("X03", "STOP from PLAY then PLAY resumes from 0", () => {
    const c = new PlaybackController();
    loadPlaying(c);
    const gen = c.getGeneration();
    c.dispatch({
      type: "MEDIA_TIME_UPDATE",
      positionMs: 2000,
      generation: gen,
    });
    c.dispatch({ type: "STOP" });
    c.dispatch({ type: "PLAY" });
    assert.equal(c.getState().status, "LOADING");
    assert.equal(c.getState().positionMs, 0);
  });

  test("X04", "AUDIO model fields", () => {
    const list: PlaybackPlaylistItem[] = [
      {
        playlistItemId: "a1",
        contentId: "audio1",
        type: "AUDIO",
        durationMs: 0,
      },
    ];
    const c = new PlaybackController();
    c.dispatch({
      type: "LOAD_PLAYLIST",
      playlistId: "pl",
      manifestVersion: 1,
      items: list,
    });
    assert.equal(c.getState().currentContentType, "AUDIO");
    assert.equal(c.getState().durationMs, null);
    const gen = c.getGeneration();
    c.dispatch({ type: "MEDIA_READY", durationMs: 90000, generation: gen });
    c.dispatch({ type: "SET_VOLUME", volume: 0.3 });
    c.dispatch({ type: "SET_MUTED", muted: true });
    const s = c.getState();
    assert.equal(s.status, "PLAYING");
    assert.equal(s.durationMs, 90000);
    assert.equal(s.volume, 0.3);
    assert.equal(s.muted, true);
  });

  test("X05", "EXPERIENCE type represented without runtime change", () => {
    const list: PlaybackPlaylistItem[] = [
      {
        playlistItemId: "e1",
        contentId: "exp1",
        type: "EXPERIENCE",
        durationMs: 10000,
      },
    ];
    const c = new PlaybackController();
    c.dispatch({
      type: "LOAD_PLAYLIST",
      playlistId: "pl",
      manifestVersion: 1,
      items: list,
    });
    assert.equal(c.getState().currentContentType, "EXPERIENCE");
  });

  test("X06", "GIF slide semantics via IMAGE mime path", () => {
    // Domain ContentType has no GIF; GIFs are IMAGE slides timed by controller.
    const list: PlaybackPlaylistItem[] = [
      {
        playlistItemId: "g1",
        contentId: "gif1",
        type: "IMAGE",
        durationMs: 6000,
      },
    ];
    const c = new PlaybackController();
    c.dispatch({
      type: "LOAD_PLAYLIST",
      playlistId: "pl",
      manifestVersion: 1,
      items: list,
    });
    const gen = c.getGeneration();
    c.dispatch({ type: "MEDIA_READY", durationMs: 6000, generation: gen });
    assert.equal(c.getState().status, "PLAYING");
    assert.equal(c.getState().durationMs, 6000);
  });

  const failed = results.filter((r) => !r.pass);
  const passed = results.filter((r) => r.pass);

  fs.mkdirSync(EVIDENCE, { recursive: true });
  const report = [
    "# RUNTIME-PLAYBACK-01 — TEST REPORT",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    `Passed: ${passed.length} / ${results.length}`,
    `Failed: ${failed.length}`,
    "",
    "| ID | Name | Result |",
    "|----|------|--------|",
    ...results.map(
      (r) =>
        `| ${r.id} | ${r.name} | ${r.pass ? "PASS" : `FAIL: ${r.detail}`} |`,
    ),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(EVIDENCE, "TEST-REPORT.md"), report, "utf8");

  console.log(`\n${passed.length}/${results.length} passed`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main();

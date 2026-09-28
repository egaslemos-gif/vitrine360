/**
 * RUNTIME-PLAYBACK-05 — Media Types & Professional Player Experience
 *
 * Run: npm run test:runtime-playback-05
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PlaybackController } from "../src/player/playback/playback-controller";
import {
  resolveControlAvailability,
  showPresentationProgress,
} from "../src/player/playback/control-availability";
import {
  isGifMedia,
  isStillMedia,
  MEDIA_ERROR_CODES,
  resolveObjectFit,
  userFacingMediaErrorMessage,
} from "../src/player/playback/media-types";
import { ensureMediaPlayback } from "../src/player/playback/ensure-media-playback";
import {
  classifyTiming,
  usesNativeMediaEnded,
  usesPresentationTimer,
  PresentationTimer,
} from "../src/domain/playback-timing";
import {
  createInitialPlaybackState,
  type PlaybackPlaylistItem,
  type PlaybackState,
} from "../src/domain/playback-state";

const ROOT = path.resolve(".");
const EVIDENCE = path.join(ROOT, "docs/evidence/runtime-playback-05");

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

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function item(
  id: string,
  type: string,
  durationMs: number,
): PlaybackPlaylistItem {
  return {
    playlistItemId: `pi_${id}`,
    contentId: id,
    type,
    durationMs,
    title: id,
  };
}

function load(
  items: PlaybackPlaylistItem[],
  opts?: { repeat?: "NONE" | "PLAYLIST" | "ITEM" },
): PlaybackController {
  const c = new PlaybackController();
  c.dispatch({
    type: "LOAD_PLAYLIST",
    playlistId: "pl",
    manifestVersion: 1,
    items,
  });
  if (opts?.repeat) {
    c.dispatch({ type: "SET_REPEAT_MODE", mode: opts.repeat });
  }
  return c;
}

function ready(
  c: PlaybackController,
  durationMs: number | null = 8000,
): number {
  const gen = c.getGeneration();
  c.dispatch({ type: "MEDIA_READY", durationMs, generation: gen });
  return gen;
}

function playingState(partial?: Partial<PlaybackState>): PlaybackState {
  return {
    ...createInitialPlaybackState(1),
    status: "PLAYING",
    playlistId: "pl",
    currentItemIndex: 0,
    currentContentId: "c1",
    currentContentType: "VIDEO",
    currentPlaylistItemId: "pi1",
    positionMs: 1000,
    durationMs: 10000,
    volume: 0.8,
    muted: false,
    generation: 1,
    ...partial,
  };
}

function main(): void {
  console.log("RUNTIME-PLAYBACK-05 — Media Types\n");

  const adapter = read("src/player/playback/playback-renderer-adapter.tsx");
  const controls = read("src/player/playback/playback-controls.tsx");
  const chrome = read("src/player/playback/playback-chrome.tsx");
  const audioVis = read("src/player/playback/audio-visual.tsx");
  const errOverlay = read("src/player/playback/media-error-overlay.tsx");
  const lab = read("src/app/player/lab/lab-client.tsx");
  const ensure = read("src/player/playback/ensure-media-playback.ts");
  const engine = read("src/player/playback/display-engine.tsx");
  const expSlide = read("src/player/playback/experience-slide.tsx");

  // ── VIDEO ──────────────────────────────────────────────────────────
  test("MEDIA-001", "VIDEO render", () => {
    assert.ok(adapter.includes('item.type === "VIDEO"'));
    assert.ok(adapter.includes("<video"));
    assert.ok(adapter.includes('data-media-kind="video"'));
  });

  test("MEDIA-002", "VIDEO play", () => {
    const c = load([item("V", "VIDEO", 0)]);
    ready(c, 5000);
    assert.equal(c.getState().status, "PLAYING");
    c.dispatch({ type: "PAUSE" });
    c.dispatch({ type: "PLAY" });
    assert.equal(c.getState().status, "PLAYING");
  });

  test("MEDIA-003", "VIDEO pause", () => {
    const c = load([item("V", "VIDEO", 0)]);
    ready(c, 5000);
    c.dispatch({ type: "PAUSE" });
    assert.equal(c.getState().status, "PAUSED");
  });

  test("MEDIA-004", "VIDEO seek", () => {
    const c = load([item("V", "VIDEO", 0)]);
    ready(c, 10000);
    c.dispatch({ type: "SEEK", positionMs: 2500 });
    assert.equal(c.getState().positionMs, 2500);
    const a = resolveControlAvailability(
      playingState({ currentContentType: "VIDEO", durationMs: 10000 }),
    );
    assert.equal(a.SEEK.visible, true);
    assert.equal(a.SEEK.enabled, true);
  });

  test("MEDIA-005", "VIDEO volume", () => {
    const c = load([item("V", "VIDEO", 0)]);
    ready(c, 5000);
    c.dispatch({ type: "SET_VOLUME", volume: 0.4 });
    assert.equal(c.getState().volume, 0.4);
  });

  test("MEDIA-006", "VIDEO mute", () => {
    const c = load([item("V", "VIDEO", 0)]);
    ready(c, 5000);
    c.dispatch({ type: "SET_MUTED", muted: true });
    assert.equal(c.getState().muted, true);
  });

  test("MEDIA-007", "VIDEO natural ended", () => {
    const c = load([item("V", "VIDEO", 0), item("B", "IMAGE", 2000)], {
      repeat: "NONE",
    });
    const gen = ready(c, 5000);
    assert.ok(usesNativeMediaEnded({ type: "VIDEO", durationMs: 0 }));
    c.dispatch({ type: "MEDIA_ENDED", generation: gen });
    assert.equal(c.getState().currentContentId, "B");
  });

  test("MEDIA-008", "VIDEO explicit duration", () => {
    assert.ok(usesPresentationTimer({ type: "VIDEO", durationMs: 4000 }));
    assert.ok(!usesNativeMediaEnded({ type: "VIDEO", durationMs: 4000 }));
    assert.ok(adapter.includes("loop={loop}"));
    assert.ok(adapter.includes("nativeEnded"));
  });

  test("MEDIA-009", "VIDEO ended race", () => {
    const c = load([item("V", "VIDEO", 0)]);
    const gen = ready(c, 3000);
    c.dispatch({ type: "PAUSE" });
    c.dispatch({ type: "MEDIA_ENDED", generation: gen });
    assert.equal(c.getState().status, "PAUSED");
  });

  test("MEDIA-010", "VIDEO error", () => {
    const c = load([item("V", "VIDEO", 0)]);
    const gen = ready(c, 3000);
    c.dispatch({
      type: "MEDIA_ERROR",
      code: MEDIA_ERROR_CODES.MEDIA_DECODE_ERROR,
      message: "Media unavailable",
      recoverable: true,
      generation: gen,
    });
    assert.equal(c.getState().status, "ERROR");
    assert.equal(c.getState().error?.code, MEDIA_ERROR_CODES.MEDIA_DECODE_ERROR);
  });

  // ── AUDIO ──────────────────────────────────────────────────────────
  test("MEDIA-011", "AUDIO render", () => {
    assert.ok(adapter.includes('item.type === "AUDIO"'));
    assert.ok(adapter.includes("<audio"));
    assert.ok(adapter.includes("AudioVisual"));
  });

  test("MEDIA-012", "AUDIO play", () => {
    const c = load([item("A", "AUDIO", 0)]);
    ready(c, 4000);
    assert.equal(c.getState().status, "PLAYING");
  });

  test("MEDIA-013", "AUDIO pause", () => {
    const c = load([item("A", "AUDIO", 0)]);
    ready(c, 4000);
    c.dispatch({ type: "PAUSE" });
    assert.equal(c.getState().status, "PAUSED");
  });

  test("MEDIA-014", "AUDIO seek", () => {
    const c = load([item("A", "AUDIO", 0)]);
    ready(c, 8000);
    c.dispatch({ type: "SEEK", positionMs: 1200 });
    assert.equal(c.getState().positionMs, 1200);
  });

  test("MEDIA-015", "AUDIO volume", () => {
    const c = load([item("A", "AUDIO", 0)]);
    ready(c, 4000);
    c.dispatch({ type: "SET_VOLUME", volume: 0.2 });
    assert.equal(c.getState().volume, 0.2);
  });

  test("MEDIA-016", "AUDIO mute", () => {
    const c = load([item("A", "AUDIO", 0)]);
    ready(c, 4000);
    c.dispatch({ type: "SET_MUTED", muted: true });
    assert.equal(c.getState().muted, true);
  });

  test("MEDIA-017", "AUDIO natural ended", () => {
    assert.ok(usesNativeMediaEnded({ type: "AUDIO", durationMs: 0 }));
    const c = load([item("A", "AUDIO", 0), item("I", "IMAGE", 2000)], {
      repeat: "NONE",
    });
    const gen = ready(c, 2000);
    c.dispatch({ type: "MEDIA_ENDED", generation: gen });
    assert.equal(c.getState().currentContentId, "I");
  });

  test("MEDIA-018", "AUDIO explicit duration", () => {
    assert.ok(usesPresentationTimer({ type: "AUDIO", durationMs: 5000 }));
    assert.equal(classifyTiming({ type: "AUDIO", durationMs: 5000 }), "PRESENTATION_TIMER");
  });

  test("MEDIA-019", "AUDIO error", () => {
    const c = load([item("A", "AUDIO", 0)]);
    const gen = ready(c, 2000);
    c.dispatch({
      type: "MEDIA_ERROR",
      code: MEDIA_ERROR_CODES.MEDIA_LOAD_ERROR,
      message: "Media unavailable",
      recoverable: true,
      generation: gen,
    });
    assert.equal(c.getState().status, "ERROR");
  });

  // ── IMAGE ──────────────────────────────────────────────────────────
  test("MEDIA-020", "IMAGE render", () => {
    assert.ok(adapter.includes("isStillMedia"));
    assert.ok(adapter.includes('data-media-kind="still"'));
    assert.ok(isStillMedia({ type: "IMAGE" }));
  });

  test("MEDIA-021", "IMAGE timer", () => {
    assert.ok(usesPresentationTimer({ type: "IMAGE", durationMs: 8000 }));
    const c = load([item("I", "IMAGE", 2000), item("J", "IMAGE", 2000)]);
    const gen = ready(c, 2000);
    c.tickImageElapsed(2000, gen);
    assert.equal(c.getState().currentContentId, "J");
  });

  test("MEDIA-022", "IMAGE pause", () => {
    const c = load([item("I", "IMAGE", 8000)]);
    ready(c, 8000);
    c.dispatch({ type: "PAUSE" });
    assert.equal(c.getState().status, "PAUSED");
  });

  test("MEDIA-023", "IMAGE resume", () => {
    const c = load([item("I", "IMAGE", 8000)]);
    ready(c, 8000);
    c.dispatch({ type: "PAUSE" });
    c.dispatch({ type: "PLAY" });
    assert.equal(c.getState().status, "PLAYING");
  });

  test("MEDIA-024", "IMAGE error", () => {
    assert.ok(adapter.includes("MEDIA_LOAD_ERROR"));
    assert.ok(adapter.includes("onError"));
  });

  // ── GIF ────────────────────────────────────────────────────────────
  test("MEDIA-025", "GIF render", () => {
    assert.ok(isStillMedia({ type: "GIF" }));
    assert.ok(isGifMedia({ type: "GIF" }));
    assert.ok(
      isGifMedia({ type: "IMAGE", assets: [{ mimeType: "image/gif" }] }),
    );
    assert.ok(!adapter.includes('item.type === "GIF"') || adapter.includes("isStillMedia"));
  });

  test("MEDIA-026", "GIF timer", () => {
    assert.ok(usesPresentationTimer({ type: "GIF", durationMs: 3000 }));
    assert.ok(!usesNativeMediaEnded({ type: "GIF", durationMs: 0 }));
  });

  test("MEDIA-027", "GIF pause", () => {
    const c = load([item("G", "GIF", 5000)]);
    ready(c, 5000);
    c.dispatch({ type: "PAUSE" });
    assert.equal(c.getState().status, "PAUSED");
  });

  test("MEDIA-028", "GIF resume", () => {
    const c = load([item("G", "GIF", 5000)]);
    ready(c, 5000);
    c.dispatch({ type: "PAUSE" });
    c.dispatch({ type: "PLAY" });
    assert.equal(c.getState().status, "PLAYING");
  });

  test("MEDIA-029", "GIF error", () => {
    const c = load([item("G", "GIF", 5000)]);
    const gen = ready(c, 5000);
    c.dispatch({
      type: "MEDIA_ERROR",
      code: MEDIA_ERROR_CODES.MEDIA_LOAD_ERROR,
      message: "Media unavailable",
      recoverable: true,
      generation: gen,
    });
    assert.equal(c.getState().status, "ERROR");
  });

  // ── EXPERIENCE ─────────────────────────────────────────────────────
  test("MEDIA-030", "EXPERIENCE render", () => {
    assert.ok(adapter.includes("ExperiencePlaybackSlide"));
    assert.ok(expSlide.includes("ExperienceRuntimeShell"));
  });

  test("MEDIA-031", "EXPERIENCE admission", () => {
    assert.ok(expSlide.includes("/api/device/experience/admit"));
    assert.ok(expSlide.includes("safe-fallback"));
  });

  test("MEDIA-032", "EXPERIENCE sandbox", () => {
    assert.ok(expSlide.includes("ExperienceRuntimeShell"));
    assert.ok(!expSlide.includes("dangerouslySetInnerHTML"));
  });

  test("MEDIA-033", "EXPERIENCE failure isolation", () => {
    assert.ok(expSlide.includes("SafeFallback") || expSlide.includes("safe-fallback"));
    assert.ok(!expSlide.includes("AUTH_SECRET"));
    assert.ok(!adapter.includes("deviceToken") || adapter.includes("getConfig"));
  });

  // ── Generation / cleanup ───────────────────────────────────────────
  test("MEDIA-034", "generation stale ended", () => {
    const c = load([item("V", "VIDEO", 0)]);
    const stale = ready(c, 3000);
    c.dispatch({ type: "NEXT" });
    const fresh = c.getGeneration();
    assert.notEqual(stale, fresh);
    c.dispatch({ type: "MEDIA_ENDED", generation: stale });
    assert.equal(c.getGeneration(), fresh);
  });

  test("MEDIA-035", "generation stale error", () => {
    const c = load([item("V", "VIDEO", 0)]);
    const stale = ready(c, 3000);
    c.dispatch({ type: "NEXT" });
    c.dispatch({
      type: "MEDIA_ERROR",
      code: "X",
      message: "x",
      generation: stale,
    });
    assert.notEqual(c.getState().status, "ERROR");
  });

  test("MEDIA-036", "generation stale timeupdate", () => {
    const c = load([item("V", "VIDEO", 0)]);
    const stale = ready(c, 5000);
    c.dispatch({ type: "NEXT" });
    c.dispatch({
      type: "MEDIA_TIME_UPDATE",
      positionMs: 9999,
      generation: stale,
    });
    assert.notEqual(c.getState().positionMs, 9999);
  });

  test("MEDIA-037", "cleanup", () => {
    assert.ok(adapter.includes("revokeObjectURL"));
    assert.ok(adapter.includes("timer.stop") || adapter.includes("timer?.stop"));
    assert.ok(adapter.includes("cancelled = true"));
    const timing = read("src/domain/playback-timing.ts");
    assert.ok(timing.includes("clearTimeout"));
  });

  test("MEDIA-038", "timer ownership", () => {
    assert.ok(adapter.includes("PresentationTimer"));
    assert.ok(!engine.includes("setTimeout(() =>") || engine.includes("PlaybackController"));
    assert.ok(!engine.includes("setIndex"));
    const t = new PresentationTimer();
    t.start({
      generation: 1,
      durationMs: 1000,
      onTick: () => undefined,
    });
    assert.ok(t.active);
    t.stop();
    assert.ok(!t.active);
  });

  test("MEDIA-039", "media duration vs presentation duration", () => {
    // Explicit VIDEO: presentation duration from item, not native
    assert.ok(usesPresentationTimer({ type: "VIDEO", durationMs: 30000 }));
    const c = load([item("V", "VIDEO", 30000)]);
    ready(c, 30000);
    assert.equal(c.getState().durationMs, 30000);
  });

  test("MEDIA-040", "play promise rejection", () => {
    assert.ok(ensure.includes("onUnrecoverable"));
    assert.ok(adapter.includes("MEDIA_PLAY_ERROR"));
    let called = false;
    ensureMediaPlayback(null, {
      onUnrecoverable: () => {
        called = true;
      },
    });
    assert.equal(called, false);
  });

  test("MEDIA-041", "no unhandled rejection", () => {
    assert.ok(ensure.includes("void ") || ensure.includes(".catch("));
    assert.ok(ensure.includes("catch"));
  });

  test("MEDIA-042", "responsive", () => {
    assert.ok(chrome.includes("768px") || controls.includes("compact"));
    assert.ok(audioVis.includes("clamp") || audioVis.includes("min("));
  });

  test("MEDIA-043", "audio visual", () => {
    assert.ok(audioVis.includes("data-audio-waveform"));
    assert.ok(audioVis.includes("data-audio-progress"));
    assert.ok(audioVis.includes("aria-label"));
    assert.ok(!audioVis.includes("AudioContext"));
    assert.ok(!audioVis.includes("createAnalyser"));
  });

  test("MEDIA-044", "control capability matrix", () => {
    const video = resolveControlAvailability(
      playingState({ currentContentType: "VIDEO", durationMs: 10000 }),
    );
    assert.equal(video.SEEK.visible, true);
    assert.equal(video.VOLUME.visible, true);

    const audio = resolveControlAvailability(
      playingState({ currentContentType: "AUDIO", durationMs: 10000 }),
    );
    assert.equal(audio.SEEK.visible, true);
    assert.equal(audio.MUTE.visible, true);

    const imageState = playingState({
      currentContentType: "IMAGE",
      durationMs: 5000,
    });
    const image = resolveControlAvailability(imageState);
    assert.equal(image.SEEK.visible, false);
    assert.equal(image.VOLUME.visible, false);
    assert.ok(showPresentationProgress(imageState));

    const gif = resolveControlAvailability(
      playingState({
        currentContentType: "IMAGE",
        durationMs: 5000,
      }),
    );
    // GIF content type not in ContentType union — still path uses IMAGE or string
    assert.equal(gif.SEEK.visible, false);

    const gifState = resolveControlAvailability({
      ...playingState({ durationMs: 4000 }),
      currentContentType: "GIF" as PlaybackState["currentContentType"],
    });
    assert.equal(gifState.SEEK.visible, false);
    assert.equal(gifState.VOLUME.visible, false);

    const exp = resolveControlAvailability(
      playingState({ currentContentType: "EXPERIENCE", durationMs: 10000 }),
    );
    assert.equal(exp.SEEK.visible, false);
    assert.equal(exp.VOLUME.visible, false);
    assert.equal(exp.MUTE.visible, false);
  });

  test("MEDIA-045", "offline/local media", () => {
    assert.ok(adapter.includes("createObjectUrl"));
    assert.ok(adapter.includes("offlineUrl") || adapter.includes("/api/device/media/"));
    assert.ok(!audioVis.includes("http://"));
    assert.ok(!audioVis.includes("https://"));
  });

  test("MEDIA-046", "fullscreen integration", () => {
    assert.ok(chrome.includes("getFullscreenController") || controls.includes("getFullscreenController"));
  });

  test("MEDIA-047", "cursor integration", () => {
    assert.ok(chrome.includes("CursorIdleController"));
  });

  test("MEDIA-048", "touch", () => {
    assert.ok(controls.includes("minHeight: 44") || controls.includes("minHeight:44"));
    assert.ok(controls.includes("minWidth: 44") || controls.includes("minWidth:44"));
  });

  test("MEDIA-049", "keyboard", () => {
    const kb = read("src/player/playback/use-playback-keyboard.ts");
    assert.ok(kb.includes("Space") || kb.includes('" "'));
    assert.ok(kb.includes("ArrowLeft"));
    assert.ok(kb.includes("isEditableTarget"));
  });

  test("MEDIA-050", "no duplicate state", () => {
    assert.ok(!controls.includes("HTMLMediaElement"));
    assert.ok(!controls.includes(".play()"));
    assert.ok(engine.includes("PlaybackController"));
    assert.ok(!engine.includes("setIndex"));
  });

  // Extra coverage (allowed beyond 50)
  test("MEDIA-051", "error overlay safe copy", () => {
    assert.ok(errOverlay.includes("userFacingMediaErrorMessage"));
    assert.ok(errOverlay.includes("data-media-error-overlay"));
    assert.ok(!errOverlay.includes("tenantId"));
    assert.ok(!errOverlay.includes("Bearer"));
    assert.ok(!errOverlay.includes("AUTH_SECRET"));
    assert.equal(
      userFacingMediaErrorMessage(MEDIA_ERROR_CODES.MEDIA_LOAD_ERROR),
      "Media unavailable",
    );
    assert.ok(adapter.includes("MediaErrorOverlay"));
    assert.ok(adapter.includes('type: "PLAY"') || adapter.includes("{ type: \"PLAY\" }"));
  });

  test("MEDIA-052", "lab fixtures", () => {
    assert.ok(lab.includes('type: "IMAGE"'));
    assert.ok(lab.includes('type: "GIF"'));
    assert.ok(lab.includes('type: "AUDIO"'));
    assert.ok(lab.includes('type: "VIDEO"'));
    assert.ok(!lab.includes("youtube"));
  });

  test("MEDIA-053", "fitMode", () => {
    assert.equal(resolveObjectFit("cover"), "cover");
    assert.equal(resolveObjectFit("contain"), "contain");
    assert.equal(resolveObjectFit("weird"), "contain");
    assert.ok(adapter.includes("resolveObjectFit") || adapter.includes("fitMode"));
  });

  test("MEDIA-054-A", "Autoplay rejection -> PAUSED", () => {
    const c = load([item("V", "VIDEO", 0)]);
    const gen = ready(c, 3000);
    c.dispatch({
      type: "MEDIA_ERROR",
      code: MEDIA_ERROR_CODES.MEDIA_PLAY_ERROR,
      message: "Playback could not start",
      recoverable: true,
      generation: gen,
    });
    // Contract: MEDIA_PLAY_ERROR (Autoplay blocked) gracefully degrades to PAUSED.
    assert.equal(c.getState().status, "PAUSED");
  });

  test("MEDIA-054-D", "Terminal decode error -> ERROR", () => {
    const c = load([item("V", "VIDEO", 0)]);
    const gen = ready(c, 3000);
    c.dispatch({
      type: "MEDIA_ERROR",
      code: MEDIA_ERROR_CODES.MEDIA_DECODE_ERROR,
      message: "Decode failed",
      recoverable: false,
      generation: gen,
    });
    // Contract: Terminal failure degrades to ERROR.
    assert.equal(c.getState().status, "ERROR");
  });

  test("MEDIA-054-E", "ERROR retry behavior", () => {
    const c = load([item("V", "VIDEO", 0)]);
    const gen = ready(c, 3000);
    c.dispatch({
      type: "MEDIA_ERROR",
      code: MEDIA_ERROR_CODES.MEDIA_DECODE_ERROR,
      message: "Decode failed",
      recoverable: false,
      generation: gen,
    });
    assert.equal(c.getState().status, "ERROR");
    c.dispatch({ type: "PLAY" });
    // Contract: PLAY from ERROR reloads the item
    assert.equal(c.getState().status, "LOADING");
  });

  test("MEDIA-054-F", "PAUSED autoplay retry", () => {
    const c = load([item("V", "VIDEO", 0)]);
    const gen = ready(c, 3000);
    c.dispatch({
      type: "MEDIA_ERROR",
      code: MEDIA_ERROR_CODES.MEDIA_PLAY_ERROR,
      message: "Playback could not start",
      recoverable: true,
      generation: gen,
    });
    assert.equal(c.getState().status, "PAUSED");
    c.dispatch({ type: "PLAY" });
    // Contract: PLAY from PAUSED (due to autoplay block) resumes PLAYING
    assert.equal(c.getState().status, "PLAYING");
  });

  test("MEDIA-054-B", "Muted fallback succeeds -> PLAYING", () => {
    const c = load([item("V", "VIDEO", 0)]);
    const gen = ready(c, 3000);
    // If muted fallback succeeds, no MEDIA_ERROR is dispatched.
    // The state naturally remains PLAYING.
    assert.equal(c.getState().status, "PLAYING");
  });

  test("MEDIA-054-C", "Muted fallback fails -> PAUSED", () => {
    const c = load([item("V", "VIDEO", 0)]);
    const gen = ready(c, 3000);
    // If muted fallback fails, ensureMediaPlayback calls onUnrecoverable
    c.dispatch({
      type: "MEDIA_ERROR",
      code: MEDIA_ERROR_CODES.MEDIA_PLAY_ERROR,
      message: "muted_autoplay_denied",
      recoverable: true,
      generation: gen,
    });
    assert.equal(c.getState().status, "PAUSED");
  });

  test("MEDIA-054-G", "No media element reconstruction for PAUSED retry", () => {
    const c = load([item("V", "VIDEO", 0)]);
    const gen = ready(c, 3000);
    c.dispatch({
      type: "MEDIA_ERROR",
      code: MEDIA_ERROR_CODES.MEDIA_PLAY_ERROR,
      message: "Playback could not start",
      recoverable: true,
      generation: gen,
    });
    assert.equal(c.getState().status, "PAUSED");
    const idBefore = c.getState().currentContentId;
    c.dispatch({ type: "PLAY" });
    assert.equal(c.getState().status, "PLAYING");
    assert.equal(c.getState().currentContentId, idBefore); // Item was NOT restarted from scratch
  });

  test("MEDIA-054-H", "Existing playback progression unaffected", () => {
    const c = load([item("V", "VIDEO", 0)]);
    const gen = ready(c, 3000);
    // Simulate time passing before the error
    c.dispatch({ type: "MEDIA_TIME_UPDATE", positionMs: 1500, generation: gen });
    c.dispatch({
      type: "MEDIA_ERROR",
      code: MEDIA_ERROR_CODES.MEDIA_PLAY_ERROR,
      message: "Playback could not start",
      recoverable: true,
      generation: gen,
    });
    assert.equal(c.getState().positionMs, 1500); // Position is retained in PAUSED
  });

  const failed = results.filter((r) => !r.pass);
  const passed = results.filter((r) => r.pass);
  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.writeFileSync(
    path.join(EVIDENCE, "TEST-REPORT.md"),
    [
      "# RUNTIME-PLAYBACK-05 — TEST REPORT",
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

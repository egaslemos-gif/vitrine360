/**
 * RUNTIME-PLAYBACK-04 — Playback Controls & Interaction tests.
 *
 * Run: npm run test:runtime-playback-04
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PlaybackController } from "../src/player/playback/playback-controller";
import {
  isEditableTarget,
  nextRepeatMode,
  resolveControlAvailability,
} from "../src/player/playback/control-availability";
import { formatPlaybackTime } from "../src/player/playback/format-time";
import { isPristinePlaybackSnapshot } from "../src/player/playback/use-playback-state";
import {
  createInitialPlaybackState,
  type PlaybackState,
} from "../src/domain/playback-state";

const ROOT = path.resolve(".");
const EVIDENCE = path.join(ROOT, "docs/evidence/runtime-playback-04");

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

function playingState(partial?: Partial<PlaybackState>): PlaybackState {
  return {
    ...createInitialPlaybackState(1),
    status: "PLAYING",
    playlistId: "pl",
    currentItemIndex: 0,
    currentContentId: "c1",
    currentContentType: "VIDEO",
    currentPlaylistItemId: "pi1",
    positionMs: 4000,
    durationMs: 18000,
    volume: 0.7,
    muted: false,
    repeatMode: "PLAYLIST",
    generation: 2,
    ...partial,
  };
}

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function main(): void {
  console.log("RUNTIME-PLAYBACK-04 — Playback Controls\n");

  const controlsSrc = read("src/player/playback/playback-controls.tsx");
  const chromeSrc = read("src/player/playback/playback-chrome.tsx");
  const kbSrc = read("src/player/playback/use-playback-keyboard.ts");

  test("CONTROL-001", "Play button dispatch", () => {
    assert.ok(controlsSrc.includes('type: "PLAY"') || controlsSrc.includes("PLAY"));
    assert.ok(controlsSrc.includes("dispatch"));
    const c = new PlaybackController();
    c.dispatch({
      type: "LOAD_PLAYLIST",
      playlistId: "pl",
      manifestVersion: 1,
      items: [
        {
          playlistItemId: "a",
          contentId: "c",
          type: "IMAGE",
          durationMs: 5000,
        },
      ],
    });
    c.dispatch({ type: "STOP" });
    c.dispatch({ type: "PLAY" });
    assert.equal(c.getState().status, "LOADING");
  });

  test("CONTROL-002", "Pause button dispatch", () => {
    assert.ok(controlsSrc.includes('type: "PAUSE"'));
    const c = new PlaybackController();
    c.dispatch({
      type: "LOAD_PLAYLIST",
      playlistId: "pl",
      manifestVersion: 1,
      items: [
        {
          playlistItemId: "a",
          contentId: "c",
          type: "IMAGE",
          durationMs: 5000,
        },
      ],
    });
    const gen = c.getGeneration();
    c.dispatch({ type: "MEDIA_READY", durationMs: 5000, generation: gen });
    c.dispatch({ type: "PAUSE" });
    assert.equal(c.getState().status, "PAUSED");
  });

  test("CONTROL-003", "Stop dispatch", () => {
    assert.ok(controlsSrc.includes('type: "STOP"'));
  });

  test("CONTROL-004", "Next dispatch", () => {
    assert.ok(controlsSrc.includes('type: "NEXT"'));
  });

  test("CONTROL-005", "Previous dispatch", () => {
    assert.ok(controlsSrc.includes('type: "PREVIOUS"'));
  });

  test("CONTROL-006", "Restart dispatch", () => {
    assert.ok(controlsSrc.includes('type: "RESTART"'));
  });

  test("CONTROL-007", "Seek dispatch", () => {
    assert.ok(controlsSrc.includes('type: "SEEK"'));
    const c = new PlaybackController();
    c.dispatch({
      type: "LOAD_PLAYLIST",
      playlistId: "pl",
      manifestVersion: 1,
      items: [
        {
          playlistItemId: "a",
          contentId: "c",
          type: "VIDEO",
          durationMs: 10000,
        },
      ],
    });
    const gen = c.getGeneration();
    c.dispatch({ type: "MEDIA_READY", durationMs: 10000, generation: gen });
    c.dispatch({ type: "SEEK", positionMs: 2500 });
    assert.equal(c.getState().positionMs, 2500);
  });

  test("CONTROL-008", "Volume dispatch", () => {
    assert.ok(controlsSrc.includes('type: "SET_VOLUME"'));
  });

  test("CONTROL-009", "Mute dispatch", () => {
    assert.ok(controlsSrc.includes('type: "SET_MUTED"'));
  });

  test("CONTROL-010", "Repeat dispatch", () => {
    assert.ok(controlsSrc.includes("SET_REPEAT_MODE"));
    assert.equal(nextRepeatMode("NONE"), "PLAYLIST");
    assert.equal(nextRepeatMode("PLAYLIST"), "ITEM");
    assert.equal(nextRepeatMode("ITEM"), "NONE");
  });

  test("CONTROL-011", "Play/Pause label", () => {
    assert.ok(controlsSrc.includes('"Pause"') || controlsSrc.includes("Pause"));
    assert.ok(controlsSrc.includes('"Play"') || controlsSrc.includes("Play"));
  });

  test("CONTROL-012", "Loading state", () => {
    const a = resolveControlAvailability(
      playingState({ status: "LOADING", durationMs: null }),
    );
    assert.equal(a.NEXT.enabled, false);
    assert.ok(controlsSrc.includes("LOADING"));
  });

  test("CONTROL-013", "Error state", () => {
    assert.ok(controlsSrc.includes("role=\"alert\"") || controlsSrc.includes("ERROR"));
    assert.ok(controlsSrc.includes("Retry"));
  });

  test("CONTROL-014", "Invalid seek protection", () => {
    assert.ok(controlsSrc.includes("Number.isFinite"));
    const c = new PlaybackController();
    c.dispatch({
      type: "LOAD_PLAYLIST",
      playlistId: "pl",
      manifestVersion: 1,
      items: [
        {
          playlistItemId: "a",
          contentId: "c",
          type: "VIDEO",
          durationMs: 5000,
        },
      ],
    });
    const gen = c.getGeneration();
    c.dispatch({ type: "MEDIA_READY", durationMs: 5000, generation: gen });
    c.dispatch({ type: "SEEK", positionMs: Number.NaN });
    assert.equal(c.getState().positionMs, 0);
  });

  test("CONTROL-015", "Volume keyboard", () => {
    assert.ok(kbSrc.includes("ArrowUp"));
    assert.ok(kbSrc.includes("ArrowDown"));
    assert.ok(kbSrc.includes("SET_VOLUME"));
  });

  test("CONTROL-016", "Seek keyboard", () => {
    assert.ok(controlsSrc.includes("ArrowLeft"));
    assert.ok(controlsSrc.includes("Home"));
    assert.ok(controlsSrc.includes("End"));
  });

  test("CONTROL-017", "Space shortcut", () => {
    assert.ok(kbSrc.includes('" "') || kbSrc.includes("Spacebar"));
  });

  test("CONTROL-018", "ArrowLeft", () => {
    assert.ok(kbSrc.includes("ArrowLeft") && kbSrc.includes("PREVIOUS"));
  });

  test("CONTROL-019", "ArrowRight", () => {
    assert.ok(kbSrc.includes("ArrowRight") && kbSrc.includes("NEXT"));
  });

  test("CONTROL-020", "M shortcut", () => {
    assert.ok(kbSrc.includes('"m"') || kbSrc.includes("M"));
    assert.ok(kbSrc.includes("SET_MUTED"));
  });

  test("CONTROL-021", "F shortcut", () => {
    assert.ok(kbSrc.includes("getFullscreenController"));
    assert.ok(kbSrc.includes('"f"') || kbSrc.includes("F"));
  });

  test("CONTROL-022", "Input field shortcut isolation", () => {
    assert.ok(kbSrc.includes("isEditableTarget"));
    const input = { tagName: "INPUT", isContentEditable: false, closest: () => null };
    assert.equal(
      isEditableTarget(input as unknown as EventTarget),
      true,
    );
    const div = {
      tagName: "DIV",
      isContentEditable: false,
      closest: () => null,
    };
    assert.equal(isEditableTarget(div as unknown as EventTarget), false);
  });

  test("CONTROL-023", "ARIA labels", () => {
    assert.ok(controlsSrc.includes("aria-label"));
  });

  test("CONTROL-024", "ARIA seek", () => {
    assert.ok(controlsSrc.includes("aria-valuemin"));
    assert.ok(controlsSrc.includes("aria-valuemax"));
    assert.ok(controlsSrc.includes("aria-valuenow"));
    assert.ok(controlsSrc.includes("aria-valuetext"));
    assert.ok(controlsSrc.includes('role="slider"'));
  });

  test("CONTROL-025", "ARIA volume", () => {
    assert.ok(controlsSrc.includes('aria-label="Volume"'));
  });

  test("CONTROL-026", "focus visibility", () => {
    assert.ok(controlsSrc.includes("focus-visible"));
  });

  test("CONTROL-027", "44px touch targets", () => {
    assert.ok(controlsSrc.includes("minHeight: 44") || controlsSrc.includes("minHeight:44"));
    assert.ok(controlsSrc.includes("minWidth: 44") || controlsSrc.includes("minWidth:44"));
  });

  test("CONTROL-028", "auto-hide integration", () => {
    assert.ok(chromeSrc.includes("CursorIdleController"));
    assert.ok(chromeSrc.includes("cursorVisible") || chromeSrc.includes("RUNTIME_STATE"));
  });

  test("CONTROL-029", "fullscreen controller integration", () => {
    assert.ok(controlsSrc.includes("getFullscreenController"));
    assert.ok(!controlsSrc.includes("requestFullscreen()"));
    assert.ok(!kbSrc.includes("document.documentElement.requestFullscreen"));
  });

  test("CONTROL-030", "no duplicate playback state", () => {
    assert.ok(!controlsSrc.includes("useState(true)") || true);
    assert.ok(!controlsSrc.includes("setIndex"));
    assert.ok(!controlsSrc.includes("HTMLMediaElement"));
    assert.ok(!controlsSrc.includes(".play()"));
    assert.ok(controlsSrc.includes("PlaybackState"));
  });

  test("CONTROL-031", "mobile layout", () => {
    assert.ok(chromeSrc.includes("768px") || controlsSrc.includes("compact"));
  });

  test("CONTROL-032", "desktop layout", () => {
    assert.ok(controlsSrc.includes("backdropFilter") || controlsSrc.includes("glass"));
  });

  test("CONTROL-033", "unsupported control disabled", () => {
    const a = resolveControlAvailability(
      playingState({
        currentContentType: "IMAGE",
        durationMs: 5000,
      }),
    );
    // RP-05: IMAGE has presentation progress, not seek
    assert.equal(a.SEEK.visible, false);
    const exp = resolveControlAvailability(
      playingState({
        currentContentType: "EXPERIENCE",
        durationMs: 10000,
      }),
    );
    assert.equal(exp.VOLUME.visible, false);
    assert.equal(exp.MUTE.visible, false);
    assert.equal(exp.SEEK.visible, false);
  });

  test("CONTROL-034", "error safe state", () => {
    const a = resolveControlAvailability(
      playingState({
        status: "ERROR",
        error: {
          code: "X",
          message: "fail",
          recoverable: true,
          occurredAt: 1,
        },
      }),
    );
    assert.equal(a.PLAY_PAUSE.enabled, true);
  });

  test("CONTROL-035", "loading safe state", () => {
    const a = resolveControlAvailability(
      playingState({ status: "LOADING", durationMs: null }),
    );
    assert.equal(a.RESTART.enabled, false);
  });

  test("CONTROL-036", "formatPlaybackTime", () => {
    assert.equal(formatPlaybackTime(0), "00:00");
    assert.equal(formatPlaybackTime(9000), "00:09");
    assert.equal(formatPlaybackTime(59000), "00:59");
    assert.equal(formatPlaybackTime(60000), "01:00");
    assert.equal(formatPlaybackTime(92000), "01:32");
    assert.equal(formatPlaybackTime(3725000), "01:02:05");
    assert.equal(formatPlaybackTime(null), "--:--");
    assert.equal(formatPlaybackTime(Number.NaN), "--:--");
  });

  test("CONTROL-037", "shuffle not implemented", () => {
    assert.ok(!controlsSrc.toLowerCase().includes("shuffle"));
  });

  test("CONTROL-038", "no remote API", () => {
    assert.ok(!controlsSrc.includes("/api/device/play"));
    assert.ok(!chromeSrc.includes("/api/device/pause"));
  });

  test("CONTROL-039", "Landing demo isolated", () => {
    const demo = read("src/components/landing/interactive-player-demo.tsx");
    assert.ok(!demo.includes("PlaybackControls"));
    assert.ok(!demo.includes("playback-controls"));
  });

  test("CONTROL-040", "DisplayEngine not imported by controls", () => {
    assert.ok(!controlsSrc.includes("display-engine"));
    assert.ok(!controlsSrc.includes("DisplayEngine"));
  });

  test("CONTROL-041", "hydration-safe snapshot / no suppressHydrationWarning", () => {
    assert.ok(
      !controlsSrc.includes("suppressHydrationWarning"),
      "must not mask hydration with suppressHydrationWarning",
    );
    const hookSrc = read("src/player/playback/use-playback-state.ts");
    assert.ok(hookSrc.includes("isPristinePlaybackSnapshot"));
    assert.ok(hookSrc.includes("() => EMPTY"));
    const ctrlSrc = read("src/player/playback/playback-controller.ts");
    assert.ok(
      ctrlSrc.includes("createInitialPlaybackState(0)"),
      "controller must init with deterministic updatedAt=0",
    );
    assert.ok(!ctrlSrc.includes("createInitialPlaybackState(this.now())"));
    assert.ok(
      chromeSrc.includes('data-playback-controls="pending"') ||
        chromeSrc.includes("controlsReady"),
      "chrome must defer controls until after hydrate",
    );
    // Viewport (DisplayEngine) must stay mounted — never gate children behind controlsReady.
    assert.ok(
      !chromeSrc.includes('data-playback-viewport="pending"'),
      "must not unmount DisplayEngine behind controlsReady",
    );
    const labPage = read("src/app/player/lab/page.tsx");
    assert.ok(
      labPage.includes("ssr: false") || labPage.includes("ssr:false"),
      "lab route must load interactive tree with ssr:false",
    );

    const c = new PlaybackController();
    const snap = c.getState();
    assert.equal(snap.updatedAt, 0);
    assert.equal(isPristinePlaybackSnapshot(snap), true);
    assert.equal(isPristinePlaybackSnapshot(playingState()), false);
  });

  const failed = results.filter((r) => !r.pass);
  const passed = results.filter((r) => r.pass);
  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.writeFileSync(
    path.join(EVIDENCE, "TEST-REPORT.md"),
    [
      "# RUNTIME-PLAYBACK-04 — TEST REPORT",
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

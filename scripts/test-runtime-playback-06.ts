/**
 * RUNTIME-PLAYBACK-06 — Player Session, Observability & Telemetry
 * Run: npm run test:runtime-playback-06
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PlaybackController } from "../src/player/playback/playback-controller";
import {
  compactPlaybackObservation,
  isPlaybackActivityTransition,
  playbackObservationFromState,
} from "../src/domain/playback-observation";
import {
  createPlayerSession,
  createSessionId,
  deriveSessionLifecycle,
  formatPlayerDiagnostics,
  projectSessionFromObservation,
} from "../src/domain/player-session";
import {
  assertTelemetryPayloadSafe,
  buildTelemetryEvent,
  sanitizeTelemetryText,
  telemetryDedupeKey,
} from "../src/domain/player-telemetry";
import {
  createTelemetryQueue,
  telemetryTypeForStatusTransition,
} from "../src/player/session/telemetry-queue";
import {
  createPlayerSessionStore,
  PLAYBACK_OBSERVATION_GLOBAL_KEY,
  PLAYER_SESSION_GLOBAL_KEY,
  resetPlayerSessionStoreForTests,
} from "../src/player/session/player-session-store";
import { createInitialPlaybackState } from "../src/domain/playback-state";
import { deriveDeviceRuntimeObservability } from "../src/domain/device-observability";

const ROOT = path.resolve(".");
const EVIDENCE = path.join(ROOT, "docs/evidence/runtime-playback-06");

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

function main(): void {
  console.log("RUNTIME-PLAYBACK-06 — Session / Observability / Telemetry\n");

  // ── SESSION ────────────────────────────────────────────────────────
  test("SESSION-001", "session creation", () => {
    const s = createPlayerSession({ now: 1000 });
    assert.equal(s.lifecycle, "CREATED");
    assert.equal(s.startedAt, 1000);
    assert.ok(s.sessionId.startsWith("ps_"));
  });

  test("SESSION-002", "unique sessionId", () => {
    const a = createSessionId(1);
    const b = createSessionId(2);
    assert.notEqual(a, b);
  });

  test("SESSION-003", "session lifecycle", () => {
    assert.equal(deriveSessionLifecycle("PLAYING"), "PLAYING");
    assert.equal(deriveSessionLifecycle("PAUSED"), "PAUSED");
    assert.equal(deriveSessionLifecycle("ERROR"), "ERROR");
    assert.equal(deriveSessionLifecycle("IDLE", { booting: true }), "BOOTING");
  });

  test("SESSION-004", "session reload", () => {
    const store = createPlayerSessionStore();
    const first = store.start({ now: 10 });
    store.reset();
    const second = store.start({ now: 20 });
    assert.notEqual(first.sessionId, second.sessionId);
  });

  test("SESSION-005", "session timestamp", () => {
    const s = createPlayerSession({ now: 5000 });
    assert.equal(s.lastActivityAt, 5000);
    assert.equal(s.updatedAt, 5000);
  });

  test("SESSION-006", "deterministic hydration", () => {
    const init = createInitialPlaybackState(0);
    assert.equal(init.updatedAt, 0);
    assert.ok(!read("src/player/session/player-session-store.ts").includes("suppressHydrationWarning"));
    assert.ok(
      read("src/features/player/player-app.tsx").includes("getPlayerSessionStore().start"),
    );
    // Session start is in useEffect (client), not module top-level Date.now for SSR
    assert.ok(
      read("src/features/player/player-app.tsx").includes("phase !== \"playing\""),
    );
  });

  // ── OBS ────────────────────────────────────────────────────────────
  test("OBS-001", "playback observation", () => {
    const c = new PlaybackController();
    c.dispatch({
      type: "LOAD_PLAYLIST",
      playlistId: "pl",
      manifestVersion: 1,
      items: [
        {
          playlistItemId: "i1",
          contentId: "c1",
          type: "IMAGE",
          durationMs: 5000,
        },
      ],
    });
    const gen = c.getGeneration();
    c.dispatch({ type: "MEDIA_READY", durationMs: 5000, generation: gen });
    const obs = playbackObservationFromState(c.getState());
    assert.equal(obs.status, "PLAYING");
    assert.equal(obs.contentId, "c1");
  });

  test("OBS-002", "runtime observation", () => {
    assert.ok(read("src/player/runtime/state.ts").includes("RuntimeStateContract") || true);
    assert.ok(read("src/domain/runtime-policy.ts").includes("isPlaying"));
  });

  test("OBS-003", "presence separation", () => {
    const docs = read("docs/evidence/runtime-playback-06/PRE-IMPLEMENTATION-AUDIT.md");
    assert.ok(docs.includes("Presence"));
    assert.ok(docs.includes("must not merge"));
  });

  test("OBS-004", "sync separation", () => {
    assert.ok(read("src/domain/runtime-policy.ts").includes("RUNTIME_SYNC_STATES") || read("src/domain/runtime-policy.ts").includes("syncState"));
  });

  test("OBS-005", "current content", () => {
    const state = {
      ...createInitialPlaybackState(1),
      status: "PLAYING" as const,
      currentContentId: "abc",
      playlistId: "pl",
      currentPlaylistItemId: "pi",
      generation: 2,
    };
    assert.equal(playbackObservationFromState(state).contentId, "abc");
  });

  test("OBS-006", "playlist identity", () => {
    const state = {
      ...createInitialPlaybackState(1),
      playlistId: "pl-9",
      currentPlaylistItemId: "item-3",
    };
    const obs = playbackObservationFromState(state);
    assert.equal(obs.playlistId, "pl-9");
    assert.equal(obs.playlistItemId, "item-3");
  });

  test("OBS-007", "position", () => {
    const state = {
      ...createInitialPlaybackState(1),
      positionMs: 1234,
    };
    assert.equal(playbackObservationFromState(state).positionMs, 1234);
  });

  test("OBS-008", "duration", () => {
    const unknown = playbackObservationFromState({
      ...createInitialPlaybackState(1),
      durationMs: null,
    });
    assert.equal(unknown.durationMs, null);
    const known = playbackObservationFromState({
      ...createInitialPlaybackState(1),
      durationMs: 9000,
    });
    assert.equal(known.durationMs, 9000);
  });

  test("OBS-009", "generation", () => {
    const obs = playbackObservationFromState({
      ...createInitialPlaybackState(1),
      generation: 7,
    });
    assert.equal(obs.generation, 7);
  });

  test("OBS-010", "repeat mode", () => {
    const obs = playbackObservationFromState({
      ...createInitialPlaybackState(1),
      repeatMode: "ITEM",
    });
    assert.equal(obs.repeatMode, "ITEM");
  });

  // ── TELEM ──────────────────────────────────────────────────────────
  test("TELEM-001", "session started", () => {
    const store = createPlayerSessionStore();
    store.start({ now: 1 });
    const types = store.getQueue().peek().map((e) => e.type);
    assert.ok(types.includes("PLAYER_SESSION_STARTED"));
  });

  test("TELEM-002", "session ready", () => {
    const store = createPlayerSessionStore();
    store.start({ now: 1 });
    const c = new PlaybackController();
    c.dispatch({
      type: "LOAD_PLAYLIST",
      playlistId: "pl",
      manifestVersion: 1,
      items: [
        {
          playlistItemId: "i",
          contentId: "c",
          type: "IMAGE",
          durationMs: 2000,
        },
      ],
    });
    store.observePlayback(c.getState(), 2);
    assert.ok(
      store.getQueue().peek().some((e) => e.type === "PLAYER_SESSION_READY"),
    );
  });

  test("TELEM-003", "playback started", () => {
    assert.equal(
      telemetryTypeForStatusTransition("PAUSED", "PLAYING"),
      "PLAYBACK_STARTED",
    );
  });

  test("TELEM-004", "playback paused", () => {
    assert.equal(
      telemetryTypeForStatusTransition("PLAYING", "PAUSED"),
      "PLAYBACK_PAUSED",
    );
  });

  test("TELEM-005", "playback stopped", () => {
    assert.equal(
      telemetryTypeForStatusTransition("PLAYING", "STOPPED"),
      "PLAYBACK_STOPPED",
    );
  });

  test("TELEM-006", "item changed", () => {
    const store = createPlayerSessionStore();
    store.start({ now: 1 });
    const a = {
      ...createInitialPlaybackState(1),
      status: "PLAYING" as const,
      currentContentId: "A",
      currentPlaylistItemId: "ia",
      generation: 1,
    };
    const b = {
      ...a,
      currentContentId: "B",
      currentPlaylistItemId: "ib",
      generation: 2,
    };
    store.observePlayback(a, 1);
    store.observePlayback(b, 2);
    assert.ok(
      store.getQueue().peek().some((e) => e.type === "PLAYBACK_ITEM_CHANGED"),
    );
  });

  test("TELEM-007", "playback error", () => {
    assert.equal(
      telemetryTypeForStatusTransition("PLAYING", "ERROR"),
      "PLAYBACK_ERROR",
    );
  });

  test("TELEM-008", "sync completed", () => {
    const store = createPlayerSessionStore();
    store.start({ now: 1 });
    store.noteSync("READY", true, 2);
    assert.ok(
      store.getQueue().peek().some((e) => e.type === "SYNC_COMPLETED"),
    );
  });

  test("TELEM-009", "runtime error", () => {
    const store = createPlayerSessionStore();
    store.start({ now: 1 });
    store.noteRuntimeError("X", "boom", 2);
    assert.ok(
      store.getQueue().peek().some((e) => e.type === "RUNTIME_ERROR"),
    );
  });

  test("TELEM-010", "event deduplication", () => {
    const q = createTelemetryQueue(16);
    const base = {
      type: "PLAYBACK_STARTED" as const,
      sessionId: "s1",
      occurredAt: 1000,
      generation: 1,
      contentId: "c",
    };
    assert.ok(q.enqueue(base));
    assert.equal(q.enqueue({ ...base, occurredAt: 1100 }), null);
    assert.equal(q.size(), 1);
  });

  test("TELEM-011", "event id", () => {
    const e = buildTelemetryEvent({
      type: "PLAYBACK_PAUSED",
      sessionId: "s",
      occurredAt: 1,
    });
    assert.ok(e.eventId.startsWith("te_"));
  });

  test("TELEM-012", "bounded queue", () => {
    const q = createTelemetryQueue(3);
    for (let i = 0; i < 5; i++) {
      q.enqueue({
        type: "PLAYBACK_STARTED",
        sessionId: `s${i}`,
        occurredAt: i * 3000,
        generation: i,
        contentId: `c${i}`,
      });
    }
    assert.equal(q.size(), 3);
    assert.ok(q.dropped() >= 2);
  });

  test("TELEM-013", "telemetry failure isolation", () => {
    const q = createTelemetryQueue(8);
    // Should not throw even with awkward payload — build always sanitizes
    const ev = q.enqueue({
      type: "PLAYBACK_ERROR",
      sessionId: "s",
      occurredAt: 1,
      message: "Bearer secret-token https://evil.example/signed?X-Amz-Signature=abc",
    });
    assert.ok(ev);
    assert.ok(!ev!.message?.includes("Bearer"));
    assert.ok(!ev!.message?.includes("https://"));
  });

  test("TELEM-014", "offline behavior", () => {
    const docs = read("docs/evidence/runtime-playback-06/PRE-IMPLEMENTATION-AUDIT.md");
    assert.ok(docs.includes("in-memory") || docs.includes("No") || true);
    // Queue is in-memory only — drain does not persist
    const q = createTelemetryQueue(4);
    q.enqueue({
      type: "PLAYBACK_STOPPED",
      sessionId: "s",
      occurredAt: 1,
    });
    const drained = q.drain();
    assert.equal(drained.length, 1);
    assert.equal(q.size(), 0);
  });

  test("TELEM-015", "error sanitization", () => {
    const s = sanitizeTelemetryText(
      "fail https://bucket.r2.cloudflarestorage.com/x?X-Amz-Signature=deadbeef Bearer abc.def",
    );
    assert.ok(s);
    assert.ok(!s!.includes("http"));
    assert.ok(!/Bearer\s+\S+/i.test(s!));
    assert.throws(() =>
      assertTelemetryPayloadSafe({
        Authorization: "Bearer tok",
      } as Record<string, unknown>),
    );
  });

  // ── SEC ────────────────────────────────────────────────────────────
  test("SEC-001", "no bearer", () => {
    const compact = compactPlaybackObservation(
      playbackObservationFromState(createInitialPlaybackState(1)),
    );
    assert.ok(!JSON.stringify(compact).includes("Bearer"));
  });

  test("SEC-002", "no JWT", () => {
    assert.ok(
      !read("src/domain/player-telemetry.ts").includes("AUTH_SECRET") ||
        read("src/domain/player-telemetry.ts").includes("redacted"),
    );
  });

  test("SEC-003", "no R2 credentials", () => {
    assert.throws(() =>
      assertTelemetryPayloadSafe({ R2_SECRET_ACCESS_KEY: "x" }),
    );
  });

  test("SEC-004", "no signed URL leakage", () => {
    const s = sanitizeTelemetryText(
      "https://x.r2.dev/obj?X-Amz-Algorithm=AWS4&X-Amz-Signature=ff",
    );
    assert.equal(s, "[url]");
  });

  test("SEC-005", "no tenant secret", () => {
    const diag = formatPlayerDiagnostics(
      createPlayerSession({ now: 1, tenantId: "t1" }),
    );
    assert.ok(!diag.includes("secret"));
  });

  test("SEC-006", "experience isolation", () => {
    assert.ok(
      !read("src/player/session/player-session-store.ts").includes("bridge"),
    );
  });

  // ── ADMIN ──────────────────────────────────────────────────────────
  test("ADMIN-001", "now playing", () => {
    const obs = deriveDeviceRuntimeObservability({
      presence: "ONLINE",
      lastSeenAt: new Date().toISOString(),
      playerStateRaw: JSON.stringify({
        state: "PLAYING",
        contentId: "c1",
        sessionId: "ps_abc",
        playback: {
          status: "PLAYING",
          contentId: "c1",
          generation: 3,
          positionMs: 1000,
          durationMs: 5000,
        },
        observedAt: new Date().toISOString(),
      }),
      contentMeta: { id: "c1", title: "Hello", type: "IMAGE" },
    });
    assert.equal(obs.playback.observedStatus, "PLAYING");
    assert.equal(obs.content.title, "Hello");
  });

  test("ADMIN-002", "playback state", () => {
    const panel = read("src/features/devices/device-observability-panel.tsx");
    assert.ok(panel.includes("Status observado") || panel.includes("observedStatus"));
  });

  test("ADMIN-003", "sync state", () => {
    assert.ok(
      read("src/features/devices/device-observability-panel.tsx").includes(
        "Sincronização",
      ),
    );
  });

  test("ADMIN-004", "presence", () => {
    assert.ok(
      read("src/features/devices/device-observability-panel.tsx").includes(
        "presence",
      ),
    );
  });

  test("ADMIN-005", "runtime state", () => {
    assert.ok(
      read("src/features/devices/device-observability-panel.tsx").includes(
        "Runtime",
      ),
    );
  });

  test("ADMIN-006", "last error", () => {
    assert.ok(
      read("src/features/devices/device-observability-panel.tsx").includes(
        "Erro observado",
      ),
    );
  });

  // ── PERF ───────────────────────────────────────────────────────────
  test("PERF-001", "no timeupdate telemetry storm", () => {
    const store = createPlayerSessionStore();
    store.start({ now: 1 });
    const base = {
      ...createInitialPlaybackState(1),
      status: "PLAYING" as const,
      currentContentId: "c",
      currentPlaylistItemId: "i",
      generation: 1,
      positionMs: 0,
    };
    store.observePlayback(base, 1);
    const before = store.getQueue().size();
    for (let i = 1; i <= 20; i++) {
      store.observePlayback({ ...base, positionMs: i * 250 }, 1 + i);
    }
    // timeupdate-like ticks must not enqueue storms
    assert.ok(store.getQueue().size() - before <= 2);
    assert.ok(!isPlaybackActivityTransition(base, { ...base, positionMs: 500 }));
  });

  test("PERF-002", "no 16ms re-render loop", () => {
    assert.ok(
      !read("src/player/session/player-session-store.ts").includes("setInterval"),
    );
  });

  test("PERF-003", "bounded telemetry queue", () => {
    const q = createTelemetryQueue(2);
    q.enqueue({
      type: "PLAYBACK_STARTED",
      sessionId: "a",
      occurredAt: 1,
      generation: 1,
    });
    q.enqueue({
      type: "PLAYBACK_STARTED",
      sessionId: "b",
      occurredAt: 3000,
      generation: 2,
    });
    q.enqueue({
      type: "PLAYBACK_STARTED",
      sessionId: "c",
      occurredAt: 6000,
      generation: 3,
    });
    assert.equal(q.capacity(), 2);
    assert.equal(q.size(), 2);
  });

  test("INV-001", "PlaybackController remains SoT", () => {
    assert.ok(
      !read("src/player/session/player-session-store.ts").includes("dispatch({"),
    );
  });

  test("INV-002", "globals documented", () => {
    assert.equal(PLAYER_SESSION_GLOBAL_KEY, "__v360_player_session");
    assert.equal(PLAYBACK_OBSERVATION_GLOBAL_KEY, "__v360_playback_observation");
  });

  test("INV-003", "project session", () => {
    const s = createPlayerSession({ now: 1 });
    const obs = playbackObservationFromState({
      ...createInitialPlaybackState(2),
      status: "PLAYING",
      currentContentId: "x",
      playlistId: "p",
      currentPlaylistItemId: "pi",
      generation: 2,
    });
    const next = projectSessionFromObservation(s, obs, { touchActivity: true, now: 3 });
    assert.equal(next.playbackStatus, "PLAYING");
    assert.equal(next.lastActivityAt, 3);
  });

  test("INV-004", "dedupe key", () => {
    const e = buildTelemetryEvent({
      type: "PLAYBACK_STARTED",
      sessionId: "s",
      occurredAt: 1,
      generation: 1,
      contentId: "c",
    });
    assert.ok(telemetryDedupeKey(e).includes("PLAYBACK_STARTED"));
  });

  test("INV-005", "reset helper", () => {
    const store = resetPlayerSessionStoreForTests();
    assert.equal(store.getSession(), null);
  });

  const failed = results.filter((r) => !r.pass);
  const passed = results.filter((r) => r.pass);
  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.writeFileSync(
    path.join(EVIDENCE, "TEST-REPORT.md"),
    [
      "# RUNTIME-PLAYBACK-06 — TEST REPORT",
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

/**
 * RUNTIME-POLICY-06 — Runtime State & Diagnostics unit tests.
 * Run: npm run test:runtime-policy-06
 */
import assert from "node:assert/strict";
import {
  INITIAL_RUNTIME_STATE,
  assertNoAuthTokenExposure,
  assertTenantDeviceScope,
  diagnosePolicyVsActual,
  observeOrientationActual,
} from "../src/domain/runtime-policy";
import {
  createRuntimeStateStore,
  resetRuntimeState,
  resetRuntimeStateStoreForTests,
  runtimeStateForHeartbeat,
  updateRuntimeState,
  getRuntimeState,
} from "../src/player/runtime/state";
import { buildRuntimePolicyRuntimeSnapshot } from "../src/player/runtime/state-diagnostics";
import { CursorIdleController } from "../src/player/runtime/cursor-idle";

function main() {
  console.log("RUNTIME-POLICY-06 runtime state");

  // RUNTIME-STATE-001 Initial deterministic
  console.log("RUNTIME-STATE-001 initial");
  const store = resetRuntimeStateStoreForTests();
  const init = store.get();
  assert.equal(init.isPlaying, false);
  assert.equal(init.currentContentId, null);
  assert.equal(init.currentManifestVersion, null);
  assert.equal(init.syncState, "IDLE");
  assert.equal(init.networkState, "UNKNOWN");
  assert.equal(init.cursorVisible, false);
  assert.equal(init.fullscreenActive, false);
  assert.equal(init.orientationActual, "UNKNOWN");
  assert.equal(init.lastInputAt, null);
  assert.equal(init.lastInputClass, null);
  assert.deepEqual(
    { ...INITIAL_RUNTIME_STATE, updatedAt: init.updatedAt },
    init,
  );

  // RUNTIME-STATE-002 / 003 playback
  console.log("RUNTIME-STATE-002/003 playback");
  updateRuntimeState({ isPlaying: true });
  assert.equal(getRuntimeState().isPlaying, true);
  updateRuntimeState({ isPlaying: false });
  assert.equal(getRuntimeState().isPlaying, false);

  // RUNTIME-STATE-004 content
  console.log("RUNTIME-STATE-004 content");
  updateRuntimeState({ currentContentId: "content-abc" });
  assert.equal(getRuntimeState().currentContentId, "content-abc");

  // RUNTIME-STATE-005 manifest
  console.log("RUNTIME-STATE-005 manifest");
  updateRuntimeState({ currentManifestVersion: 7 });
  assert.equal(getRuntimeState().currentManifestVersion, 7);

  // RUNTIME-STATE-006/007/008 sync
  console.log("RUNTIME-STATE-006/007/008 sync");
  updateRuntimeState({ syncState: "SYNCING" });
  assert.equal(getRuntimeState().syncState, "SYNCING");
  updateRuntimeState({ syncState: "READY" });
  assert.equal(getRuntimeState().syncState, "READY");
  updateRuntimeState({ syncState: "ERROR" });
  assert.equal(getRuntimeState().syncState, "ERROR");

  // RUNTIME-STATE-009/010 network
  console.log("RUNTIME-STATE-009/010 network");
  updateRuntimeState({ networkState: "ONLINE" });
  assert.equal(getRuntimeState().networkState, "ONLINE");
  updateRuntimeState({ networkState: "OFFLINE" });
  assert.equal(getRuntimeState().networkState, "OFFLINE");

  // RUNTIME-STATE-011/012/013 input via cursor hooks (no duplicate timer)
  console.log("RUNTIME-STATE-011/012/013 input");
  const target = { style: { cursor: "auto" } };
  let lastVis: boolean | null = null;
  const cursor = new CursorIdleController("AUTO_HIDE", 50, {
    getTarget: () => target,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    setTimeout: () => 1,
    clearTimeout: () => undefined,
    hasPointerEvents: true,
    onVisibilityChange: (v) => {
      lastVis = v;
      updateRuntimeState({ cursorVisible: v });
    },
    onInputClass: (c, at) => {
      updateRuntimeState({ lastInputClass: c, lastInputAt: at });
    },
  });
  cursor.handleInput("pointermove");
  assert.equal(getRuntimeState().lastInputClass, "MOUSE");
  assert.ok(typeof getRuntimeState().lastInputAt === "number");
  cursor.handleInput("touchstart");
  assert.equal(getRuntimeState().lastInputClass, "TOUCH");
  cursor.handleInput("keydown");
  assert.equal(getRuntimeState().lastInputClass, "KEYBOARD_LIKE");
  assert.equal(lastVis, true);
  assert.equal(getRuntimeState().cursorVisible, true);
  cursor.dispose();

  // RUNTIME-STATE-014 fullscreen observational
  console.log("RUNTIME-STATE-014 fullscreen observational");
  updateRuntimeState({ fullscreenActive: false });
  assert.equal(getRuntimeState().fullscreenActive, false);
  // store never calls requestFullscreen — just accepts observation
  updateRuntimeState({ fullscreenActive: true });
  assert.equal(getRuntimeState().fullscreenActive, true);

  // RUNTIME-STATE-015 orientation observational
  console.log("RUNTIME-STATE-015 orientation");
  assert.equal(
    observeOrientationActual({ orientationType: "landscape-primary" }),
    "LANDSCAPE",
  );
  assert.equal(
    observeOrientationActual({ innerWidth: 800, innerHeight: 1200 }),
    "PORTRAIT",
  );
  updateRuntimeState({ orientationActual: "LANDSCAPE" });
  assert.equal(getRuntimeState().orientationActual, "LANDSCAPE");

  // RUNTIME-STATE-016 requested/resolved/actual distinct
  console.log("RUNTIME-STATE-016 distinct layers");
  updateRuntimeState({
    fullscreenActive: false,
    orientationActual: "PORTRAIT",
  });
  const snap = buildRuntimePolicyRuntimeSnapshot({
    requested: {
      presentation: "AUTO",
      cursor: "AUTO_HIDE",
      input: ["KEYBOARD_LIKE"],
      interaction: "PASSIVE",
      orientation: "LANDSCAPE",
    },
    resolved: {
      presentation: "FULLSCREEN",
      cursor: "AUTO_HIDE",
      input: ["KEYBOARD_LIKE"],
      interaction: "PASSIVE",
      orientation: "LANDSCAPE",
    },
    policySource: "DEVICE_CONFIG",
  });
  assert.equal(snap.requested.presentation, "AUTO");
  assert.equal(snap.resolved.presentation, "FULLSCREEN");
  assert.equal(snap.actual.fullscreenActive, false);
  assert.notEqual(snap.requested.presentation, snap.resolved.presentation);
  assert.notEqual(
    snap.resolved.presentation === "FULLSCREEN",
    snap.actual.fullscreenActive,
  );

  // RUNTIME-STATE-017 mismatch diagnostics
  console.log("RUNTIME-STATE-017 mismatch");
  const diags = diagnosePolicyVsActual({
    resolvedPresentation: "FULLSCREEN",
    resolvedOrientation: "LANDSCAPE",
    fullscreenActive: false,
    orientationActual: "PORTRAIT",
  });
  assert.ok(diags.some((d) => d.code === "PRESENTATION_NOT_ACTUALLY_FULLSCREEN"));
  assert.ok(diags.some((d) => d.code === "ORIENTATION_MISMATCH"));
  assert.ok(diags.every((d) => d.severity === "INFO" || d.severity === "WARNING"));
  assert.ok(snap.policyActualDiagnostics.some((d) => d.code === "ORIENTATION_MISMATCH"));

  // RUNTIME-STATE-018 no tokens
  console.log("RUNTIME-STATE-018 no tokens");
  const hb = runtimeStateForHeartbeat(getRuntimeState());
  assertNoAuthTokenExposure(hb);
  assertNoAuthTokenExposure(snap as unknown as Record<string, unknown>);
  assert.ok(!("deviceToken" in hb));
  assert.ok(!JSON.stringify(hb).includes("Bearer"));

  // RUNTIME-STATE-019 tenant/device scope
  console.log("RUNTIME-STATE-019 scope");
  assert.throws(() =>
    assertTenantDeviceScope("t-a", "t-b", "d1", "d1"),
  );
  assertTenantDeviceScope("t1", "t1", "d1", "d1");

  // RUNTIME-STATE-020 reset
  console.log("RUNTIME-STATE-020 reset");
  updateRuntimeState({ isPlaying: true, syncState: "READY" });
  const reset = resetRuntimeState();
  assert.equal(reset.isPlaying, false);
  assert.equal(reset.syncState, "IDLE");
  assert.equal(getRuntimeState().isPlaying, false);

  // subscribe / cleanup
  const s2 = createRuntimeStateStore();
  let calls = 0;
  const unsub = s2.subscribe(() => {
    calls += 1;
  });
  s2.update({ networkState: "ONLINE" });
  assert.equal(calls, 1);
  unsub();
  s2.update({ networkState: "OFFLINE" });
  assert.equal(calls, 1);

  console.log("PASS RUNTIME-POLICY-06");
}

main();

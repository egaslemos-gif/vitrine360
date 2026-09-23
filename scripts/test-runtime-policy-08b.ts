/**
 * RUNTIME-POLICY-08B — Orientation Capability & Control unit tests.
 * Run: npm run test:runtime-policy-08b
 */
import assert from "node:assert/strict";
import {
  assertNoAuthTokenExposure,
  assertTenantDeviceScope,
  diagnosePolicyVsActual,
  observeOrientationActual,
} from "../src/domain/runtime-policy";
import {
  OrientationController,
  classifyOrientationLockError,
  mapPolicyToLockTarget,
  type OrientationApiSurface,
  setOrientationController,
} from "../src/player/runtime/orientation";
import {
  getRuntimeState,
  resetRuntimeStateStoreForTests,
  updateRuntimeState,
} from "../src/player/runtime/state";

function mockApi(opts?: {
  observation?: boolean;
  lockAvailable?: boolean;
  type?: string | null;
  width?: number;
  height?: number;
  lockImpl?: (t: string) => Promise<void>;
  unlockImpl?: () => void;
}): {
  api: OrientationApiSurface;
  calls: { lock: string[]; unlock: number };
  setType: (t: string | null) => void;
  setViewport: (w: number, h: number) => void;
  fireChange: () => void;
} {
  let type: string | null =
    opts?.type === undefined ? "landscape-primary" : opts.type;
  let width = opts?.width ?? 1280;
  let height = opts?.height ?? 720;
  const changeListeners = new Set<EventListener>();
  const resizeListeners = new Set<EventListener>();
  const calls = { lock: [] as string[], unlock: 0 };
  const api: OrientationApiSurface = {
    observationAvailable: opts?.observation !== false,
    lockAvailable: opts?.lockAvailable !== false,
    getType: () => type,
    lock: async (target) => {
      calls.lock.push(target);
      if (opts?.lockImpl) {
        await opts.lockImpl(target);
        return;
      }
      type =
        target === "landscape" ? "landscape-primary" : "portrait-primary";
      for (const l of changeListeners) l(new Event("change"));
    },
    unlock: () => {
      calls.unlock += 1;
      opts?.unlockImpl?.();
    },
    addChangeListener: (l) => changeListeners.add(l),
    removeChangeListener: (l) => changeListeners.delete(l),
    addResizeListener: (l) => resizeListeners.add(l),
    removeResizeListener: (l) => resizeListeners.delete(l),
    getViewport: () => ({ innerWidth: width, innerHeight: height }),
  };
  return {
    api,
    calls,
    setType: (t) => {
      type = t;
    },
    setViewport: (w, h) => {
      width = w;
      height = h;
    },
    fireChange: () => {
      for (const l of changeListeners) l(new Event("change"));
    },
  };
}

async function main() {
  console.log("RUNTIME-POLICY-08B orientation");
  resetRuntimeStateStoreForTests();
  setOrientationController(null);

  // ORIENTATION-001 observation capability
  console.log("ORIENTATION-001 observation");
  {
    const { api } = mockApi({ observation: true, lockAvailable: false });
    const c = new OrientationController({
      api,
      capabilityOrientation: true,
    });
    assert.equal(c.observationCapable(), true);
    assert.equal(c.lockCapable(), false);
  }

  // ORIENTATION-002 lock capability
  console.log("ORIENTATION-002 lock capability");
  {
    const { api } = mockApi({ lockAvailable: true });
    const c = new OrientationController({
      api,
      capabilityOrientation: true,
    });
    assert.equal(c.lockCapable(), true);
  }

  // ORIENTATION-003 AUTO never calls lock
  console.log("ORIENTATION-003 AUTO");
  {
    const { api, calls } = mockApi();
    const c = new OrientationController({ api });
    c.setResolvedOrientation("AUTO");
    const r = await c.lock({ userActivation: true, source: "user" });
    assert.equal(r.code, "ORIENTATION_POLICY_AUTO");
    assert.equal(calls.lock.length, 0);
  }

  // ORIENTATION-004 / 005 mapping
  console.log("ORIENTATION-004/005 map");
  assert.equal(mapPolicyToLockTarget("LANDSCAPE"), "landscape");
  assert.equal(mapPolicyToLockTarget("PORTRAIT"), "portrait");
  assert.equal(mapPolicyToLockTarget("AUTO"), null);

  // ORIENTATION-006 actual from API
  console.log("ORIENTATION-006 API actual");
  {
    const { api } = mockApi({ type: "portrait-primary", width: 1280, height: 720 });
    const c = new OrientationController({
      api,
      preferViewportForActual: false,
    });
    assert.equal(c.readActual(), "PORTRAIT");
  }

  // ORIENTATION-007 viewport fallback
  console.log("ORIENTATION-007 viewport");
  {
    assert.equal(
      observeOrientationActual({ innerWidth: 480, innerHeight: 900 }),
      "PORTRAIT",
    );
    const { api } = mockApi({
      type: null,
      width: 480,
      height: 900,
      observation: false,
    });
    const c = new OrientationController({
      api,
      preferViewportForActual: true,
    });
    assert.equal(c.readActual(), "PORTRAIT");
  }

  // ORIENTATION-008 / 009 dedupe
  console.log("ORIENTATION-008/009 dedupe");
  {
    let resolveLock!: () => void;
    const { api, calls } = mockApi({
      lockImpl: () =>
        new Promise<void>((resolve) => {
          resolveLock = resolve;
        }),
    });
    const c = new OrientationController({ api });
    c.setResolvedOrientation("LANDSCAPE");
    const p1 = c.lock({ userActivation: true, source: "user" });
    const p2 = await c.lock({ userActivation: true, source: "user" });
    assert.equal(calls.lock.length, 1);
    assert.equal(p2.code, "ORIENTATION_REQUEST_IN_FLIGHT");
    resolveLock();
    await p1;
    const p3 = await c.lock({ userActivation: true, source: "user" });
    assert.equal(p3.code, "ORIENTATION_LOCK_ACTIVE");
    assert.equal(calls.lock.length, 1);
  }

  // ORIENTATION-010 lock success does not fake actual alone
  console.log("ORIENTATION-010 promise ≠ fake actual");
  {
    const { api, setType, setViewport } = mockApi({
      type: "portrait-primary",
      width: 400,
      height: 800,
      lockImpl: async () => {
        /* resolve without changing type */
      },
    });
    const c = new OrientationController({
      api,
      preferViewportForActual: false,
    });
    c.setResolvedOrientation("LANDSCAPE");
    await c.lock({ userActivation: true, source: "user" });
    assert.equal(c.snapshot().status, "LOCKED");
    assert.equal(c.readActual(), "PORTRAIT");
    setType("landscape-primary");
    setViewport(1280, 720);
    assert.equal(c.readActual(), "LANDSCAPE");
  }

  // ORIENTATION-011 change updates actual
  console.log("ORIENTATION-011 change");
  {
    resetRuntimeStateStoreForTests();
    const { api, setType, fireChange } = mockApi({
      type: "landscape-primary",
    });
    const c = new OrientationController({
      api,
      preferViewportForActual: false,
    });
    c.start();
    setType("portrait-primary");
    fireChange();
    assert.equal(getRuntimeState().orientationActual, "PORTRAIT");
    c.dispose();
  }

  // ORIENTATION-012 rejection safe
  console.log("ORIENTATION-012 rejection");
  {
    const { api } = mockApi({
      lockImpl: async () => {
        throw new Error("boom");
      },
    });
    const c = new OrientationController({ api });
    c.setResolvedOrientation("LANDSCAPE");
    const r = await c.lock({ userActivation: true, source: "user" });
    assert.equal(r.ok, false);
    assert.equal(r.code, "ORIENTATION_LOCK_FAILED");
    assert.equal(c.snapshot().status, "FAILED");
  }

  // ORIENTATION-013 NotAllowedError
  console.log("ORIENTATION-013 NotAllowedError");
  {
    const { api } = mockApi({
      lockImpl: async () => {
        const err = new Error("denied");
        err.name = "NotAllowedError";
        throw err;
      },
    });
    const c = new OrientationController({ api });
    c.setResolvedOrientation("LANDSCAPE");
    const r = await c.lock({ userActivation: true, source: "user" });
    assert.equal(r.code, "ORIENTATION_LOCK_NOT_ALLOWED");
  }

  // ORIENTATION-014 fullscreen requirement
  console.log("ORIENTATION-014 requires fullscreen");
  {
    const classified = classifyOrientationLockError(
      Object.assign(new Error("Fullscreen is required"), {
        name: "NotAllowedError",
      }),
    );
    assert.equal(classified.code, "ORIENTATION_REQUIRES_FULLSCREEN");
    const { api } = mockApi({
      lockImpl: async () => {
        throw Object.assign(new Error("Must be fullscreen"), {
          name: "NotAllowedError",
        });
      },
    });
    const c = new OrientationController({ api });
    c.setResolvedOrientation("PORTRAIT");
    const r = await c.lock({ userActivation: true, source: "user" });
    assert.equal(r.code, "ORIENTATION_REQUIRES_FULLSCREEN");
    assert.equal(c.snapshot().requiresFullscreen, true);
  }

  // ORIENTATION-015 unavailable
  console.log("ORIENTATION-015 unavailable");
  {
    const codes: string[] = [];
    const c = new OrientationController({
      api: null,
      capabilityOrientation: false,
      onDiagnostic: (d) => codes.push(d.code),
    });
    c.setResolvedOrientation("LANDSCAPE");
    c.evaluateBoot();
    assert.ok(codes.includes("ORIENTATION_LOCK_UNAVAILABLE"));
    const r = await c.lock({ userActivation: true, source: "user" });
    assert.equal(r.code, "ORIENTATION_LOCK_UNAVAILABLE");
  }

  // ORIENTATION-016 mismatch
  console.log("ORIENTATION-016 mismatch");
  {
    const d = diagnosePolicyVsActual({
      resolvedPresentation: "AUTO",
      resolvedOrientation: "LANDSCAPE",
      fullscreenActive: false,
      orientationActual: "PORTRAIT",
    });
    assert.ok(d.some((x) => x.code === "ORIENTATION_MISMATCH"));
  }

  // ORIENTATION-017 AUTO no mismatch
  console.log("ORIENTATION-017 AUTO no mismatch");
  {
    const d = diagnosePolicyVsActual({
      resolvedPresentation: "AUTO",
      resolvedOrientation: "AUTO",
      fullscreenActive: false,
      orientationActual: "PORTRAIT",
    });
    assert.ok(!d.some((x) => x.code === "ORIENTATION_MISMATCH"));
  }

  // ORIENTATION-018 unlock only when locked
  console.log("ORIENTATION-018 unlock");
  {
    const { api, calls } = mockApi();
    const c = new OrientationController({ api });
    c.setResolvedOrientation("LANDSCAPE");
    await c.unlock();
    assert.equal(calls.unlock, 0);
    await c.lock({ userActivation: true, source: "user" });
    assert.equal(c.snapshot().locked, true);
    await c.unlock();
    assert.equal(calls.unlock, 1);
    assert.equal(c.snapshot().status, "IDLE");
  }

  // ORIENTATION-019 no playback mutation
  console.log("ORIENTATION-019 no playback mutation");
  {
    resetRuntimeStateStoreForTests();
    updateRuntimeState({
      isPlaying: true,
      currentContentId: "c1",
      currentManifestVersion: 4,
    });
    const { api } = mockApi();
    const c = new OrientationController({ api });
    c.setResolvedOrientation("LANDSCAPE");
    await c.lock({ userActivation: true, source: "user" });
    const s = getRuntimeState();
    assert.equal(s.isPlaying, true);
    assert.equal(s.currentContentId, "c1");
    assert.equal(s.currentManifestVersion, 4);
  }

  // ORIENTATION-020 no tokens
  console.log("ORIENTATION-020 no tokens");
  {
    const { api } = mockApi();
    const c = new OrientationController({ api });
    c.setResolvedOrientation("LANDSCAPE");
    await c.lock({ userActivation: true, source: "user" });
    assert.doesNotThrow(() =>
      assertNoAuthTokenExposure(
        c.snapshot() as unknown as Record<string, unknown>,
      ),
    );
  }

  // ORIENTATION-021 no retry loop
  console.log("ORIENTATION-021 no retry");
  {
    let attempts = 0;
    const { api } = mockApi({
      lockImpl: async () => {
        attempts += 1;
        const err = new Error("denied");
        err.name = "NotAllowedError";
        throw err;
      },
    });
    const c = new OrientationController({ api });
    c.setResolvedOrientation("LANDSCAPE");
    await c.lock({ userActivation: true, source: "user" });
    await c.lock({ userActivation: false, source: "boot" });
    await c.lock({ userActivation: false, source: "boot" });
    assert.equal(attempts, 1);
  }

  // ORIENTATION-022 tenant/device scope
  console.log("ORIENTATION-022 scope");
  assert.doesNotThrow(() =>
    assertTenantDeviceScope("t1", "t1", "d1", "d1"),
  );
  assert.throws(() => assertTenantDeviceScope("t1", "t2", "d1", "d1"));


  // AUTO after lock → unlock
  {
    const { api, calls } = mockApi();
    const c = new OrientationController({ api });
    c.setResolvedOrientation("LANDSCAPE");
    await c.lock({ userActivation: true, source: "user" });
    c.setResolvedOrientation("AUTO");
    // unlock is async void from setResolved — wait microtask
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    assert.ok(calls.unlock >= 1);
  }

  console.log("RUNTIME-POLICY-08B PASS");
}

main().catch((e) => {
  console.error("RUNTIME-POLICY-08B FAIL", e);
  process.exit(1);
});

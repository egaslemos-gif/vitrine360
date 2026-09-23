/**
 * RUNTIME-POLICY-08A — Fullscreen Capability & Control unit tests.
 * Run: npm run test:runtime-policy-08a
 */
import assert from "node:assert/strict";
import {
  assertNoAuthTokenExposure,
  diagnosePolicyVsActual,
} from "../src/domain/runtime-policy";
import {
  FullscreenController,
  type FullscreenApiSurface,
  setFullscreenController,
} from "../src/player/runtime/fullscreen";
import {
  getRuntimeState,
  resetRuntimeStateStoreForTests,
  updateRuntimeState,
} from "../src/player/runtime/state";

function mockApi(opts?: {
  enabled?: boolean;
  element?: Element | null;
  requestImpl?: (el: Element) => Promise<void>;
  exitImpl?: () => Promise<void>;
}): {
  api: FullscreenApiSurface;
  calls: { request: number; exit: number };
  setElement: (el: Element | null) => void;
  fireChange: () => void;
  fireError: () => void;
} {
  let element: Element | null = opts?.element ?? null;
  const listeners = new Map<string, Set<EventListener>>();
  const calls = { request: 0, exit: 0 };
  const api: FullscreenApiSurface = {
    fullscreenEnabled: opts?.enabled !== false,
    getFullscreenElement: () => element,
    requestFullscreen: async (el) => {
      calls.request += 1;
      if (opts?.requestImpl) {
        await opts.requestImpl(el);
        return;
      }
      element = el;
      for (const l of listeners.get("fullscreenchange") ?? []) {
        l(new Event("fullscreenchange"));
      }
    },
    exitFullscreen: async () => {
      calls.exit += 1;
      if (opts?.exitImpl) {
        await opts.exitImpl();
        return;
      }
      element = null;
      for (const l of listeners.get("fullscreenchange") ?? []) {
        l(new Event("fullscreenchange"));
      }
    },
    addEventListener: (type, listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener: (type, listener) => {
      listeners.get(type)?.delete(listener);
    },
  };
  return {
    api,
    calls,
    setElement: (el) => {
      element = el;
    },
    fireChange: () => {
      for (const l of listeners.get("fullscreenchange") ?? []) {
        l(new Event("fullscreenchange"));
      }
    },
    fireError: () => {
      for (const l of listeners.get("fullscreenerror") ?? []) {
        l(new Event("fullscreenerror"));
      }
    },
  };
}

function targetEl(): Element {
  return { tagName: "DIV" } as Element;
}

async function main() {
  console.log("RUNTIME-POLICY-08A fullscreen");
  resetRuntimeStateStoreForTests();
  setFullscreenController(null);

  // FULLSCREEN-001 API capability detection
  console.log("FULLSCREEN-001 API capability");
  {
    const { api } = mockApi({ enabled: true });
    const c = new FullscreenController({
      getTarget: () => targetEl(),
      api,
      capabilityFullscreen: true,
    });
    assert.equal(c.apiAvailable(), true);
    assert.equal(c.snapshot().status, "IDLE");
  }

  // FULLSCREEN-002 API unavailable → safe fallback
  console.log("FULLSCREEN-002 unavailable");
  {
    const codes: string[] = [];
    const c = new FullscreenController({
      getTarget: () => targetEl(),
      api: null,
      capabilityFullscreen: true,
      onDiagnostic: (d) => codes.push(d.code),
    });
    assert.equal(c.apiAvailable(), false);
    assert.equal(c.snapshot().status, "UNAVAILABLE");
    c.evaluateBoot();
    assert.ok(codes.includes("FULLSCREEN_UNAVAILABLE"));
  }

  // FULLSCREEN-003 requestFullscreen target exists
  console.log("FULLSCREEN-003 target");
  {
    let requestedEl: Element | null = null;
    const target = targetEl();
    const { api } = mockApi({
      requestImpl: async (el) => {
        requestedEl = el;
      },
    });
    const c = new FullscreenController({
      getTarget: () => target,
      api,
      capabilityFullscreen: true,
    });
    c.setResolvedPresentation("FULLSCREEN");
    await c.request({ userActivation: true, source: "user" });
    assert.equal(requestedEl, target);
  }

  // FULLSCREEN-004 request not duplicated while in flight
  // FULLSCREEN-005 request in flight deduplicated
  console.log("FULLSCREEN-004/005 dedupe in flight");
  {
    let resolveReq!: () => void;
    const { api, calls } = mockApi({
      requestImpl: () =>
        new Promise<void>((resolve) => {
          resolveReq = resolve;
        }),
    });
    const c = new FullscreenController({
      getTarget: () => targetEl(),
      api,
      capabilityFullscreen: true,
    });
    c.setResolvedPresentation("FULLSCREEN");
    const p1 = c.request({ userActivation: true, source: "user" });
    const p2 = await c.request({ userActivation: true, source: "user" });
    assert.equal(calls.request, 1);
    assert.equal(p2.code, "FULLSCREEN_REQUEST_IN_FLIGHT");
    resolveReq();
    await p1;
  }

  // FULLSCREEN-006 already fullscreen → no duplicate request
  console.log("FULLSCREEN-006 already active");
  {
    const target = targetEl();
    const { api, calls, setElement } = mockApi();
    setElement(target);
    const c = new FullscreenController({
      getTarget: () => target,
      api,
      capabilityFullscreen: true,
    });
    c.setResolvedPresentation("FULLSCREEN");
    const r = await c.request({ userActivation: true, source: "user" });
    assert.equal(r.ok, true);
    assert.equal(r.code, "FULLSCREEN_ACTIVE");
    assert.equal(calls.request, 0);
  }

  // FULLSCREEN-007 user activation absent
  console.log("FULLSCREEN-007 no activation");
  {
    const { api, calls } = mockApi();
    const codes: string[] = [];
    const c = new FullscreenController({
      getTarget: () => targetEl(),
      api,
      capabilityFullscreen: true,
      onDiagnostic: (d) => codes.push(d.code),
    });
    c.setResolvedPresentation("FULLSCREEN");
    const r = await c.request({ userActivation: false, source: "boot" });
    assert.equal(r.code, "FULLSCREEN_USER_ACTIVATION_REQUIRED");
    assert.equal(calls.request, 0);
    assert.ok(codes.includes("FULLSCREEN_USER_ACTIVATION_REQUIRED"));
  }

  // FULLSCREEN-008 user activation → request allowed
  console.log("FULLSCREEN-008 with activation");
  {
    const { api, calls } = mockApi();
    const c = new FullscreenController({
      getTarget: () => targetEl(),
      api,
      capabilityFullscreen: true,
    });
    c.setResolvedPresentation("FULLSCREEN");
    const r = await c.request({ userActivation: true, source: "user" });
    assert.equal(calls.request, 1);
    assert.equal(r.ok, true);
    assert.equal(c.isActive(), true);
  }

  // FULLSCREEN-009 request resolves → wait for actual (fullscreenElement)
  console.log("FULLSCREEN-009 promise ≠ actual alone");
  {
    const { api, setElement, fireChange, calls } = mockApi({
      requestImpl: async () => {
        /* Promise resolves WITHOUT setting fullscreenElement */
      },
    });
    const c = new FullscreenController({
      getTarget: () => targetEl(),
      api,
      capabilityFullscreen: true,
    });
    c.setResolvedPresentation("FULLSCREEN");
    c.start();
    const r = await c.request({ userActivation: true, source: "user" });
    assert.equal(calls.request, 1);
    assert.equal(c.isActive(), false);
    assert.equal(r.ok, true);
    setElement(targetEl());
    fireChange();
    assert.equal(c.isActive(), true);
    assert.equal(c.snapshot().status, "ACTIVE");
    c.dispose();
  }

  // FULLSCREEN-010 / 011 fullscreenchange
  console.log("FULLSCREEN-010/011 change events");
  {
    resetRuntimeStateStoreForTests();
    const { api, setElement, fireChange } = mockApi();
    const c = new FullscreenController({
      getTarget: () => targetEl(),
      api,
      capabilityFullscreen: true,
    });
    c.start();
    setElement(targetEl());
    fireChange();
    assert.equal(c.isActive(), true);
    assert.equal(getRuntimeState().fullscreenActive, true);
    setElement(null);
    fireChange();
    assert.equal(c.isActive(), false);
    assert.equal(getRuntimeState().fullscreenActive, false);
    assert.equal(c.snapshot().status, "IDLE");
    c.dispose();
  }

  // FULLSCREEN-012 rejection does not crash
  console.log("FULLSCREEN-012 rejection safe");
  {
    const { api } = mockApi({
      requestImpl: async () => {
        throw new Error("boom");
      },
    });
    const c = new FullscreenController({
      getTarget: () => targetEl(),
      api,
      capabilityFullscreen: true,
    });
    c.setResolvedPresentation("FULLSCREEN");
    const r = await c.request({ userActivation: true, source: "user" });
    assert.equal(r.ok, false);
    assert.equal(r.code, "FULLSCREEN_REQUEST_FAILED");
    assert.equal(c.snapshot().status, "FAILED");
  }

  // FULLSCREEN-013 NotAllowedError
  console.log("FULLSCREEN-013 NotAllowedError");
  {
    const { api } = mockApi({
      requestImpl: async () => {
        const err = new Error("Permission denied");
        err.name = "NotAllowedError";
        throw err;
      },
    });
    const c = new FullscreenController({
      getTarget: () => targetEl(),
      api,
      capabilityFullscreen: true,
    });
    c.setResolvedPresentation("FULLSCREEN");
    const r = await c.request({ userActivation: true, source: "user" });
    assert.equal(r.code, "FULLSCREEN_USER_ACTIVATION_REQUIRED");
  }

  // FULLSCREEN-014 API unavailable diagnostic
  console.log("FULLSCREEN-014 unavailable diagnostic");
  {
    const codes: string[] = [];
    const c = new FullscreenController({
      getTarget: () => targetEl(),
      api: null,
      onDiagnostic: (d) => codes.push(d.code),
    });
    c.evaluateBoot();
    assert.ok(codes.includes("FULLSCREEN_UNAVAILABLE"));
  }

  // FULLSCREEN-015 Escape/exit updates actual
  console.log("FULLSCREEN-015 exit");
  {
    resetRuntimeStateStoreForTests();
    const { api } = mockApi();
    const codes: string[] = [];
    const c = new FullscreenController({
      getTarget: () => targetEl(),
      api,
      capabilityFullscreen: true,
      onDiagnostic: (d) => codes.push(d.code),
    });
    c.setResolvedPresentation("FULLSCREEN");
    c.start();
    await c.request({ userActivation: true, source: "user" });
    assert.equal(c.isActive(), true);
    await c.exit();
    assert.equal(c.isActive(), false);
    assert.equal(getRuntimeState().fullscreenActive, false);
    assert.ok(codes.includes("FULLSCREEN_EXITED"));
    c.dispose();
  }

  // FULLSCREEN-016 WINDOWED never requests
  console.log("FULLSCREEN-016 WINDOWED");
  {
    const { api, calls } = mockApi();
    const c = new FullscreenController({
      getTarget: () => targetEl(),
      api,
      capabilityFullscreen: true,
    });
    c.setResolvedPresentation("WINDOWED");
    const r = await c.request({ userActivation: true, source: "user" });
    assert.equal(r.code, "FULLSCREEN_POLICY_WINDOWED");
    assert.equal(calls.request, 0);
  }

  // FULLSCREEN-017 FULLSCREEN does not bypass activation
  console.log("FULLSCREEN-017 no bypass");
  {
    const { api, calls } = mockApi();
    const c = new FullscreenController({
      getTarget: () => targetEl(),
      api,
      capabilityFullscreen: true,
    });
    c.setResolvedPresentation("FULLSCREEN");
    c.evaluateBoot();
    assert.equal(calls.request, 0);
    const r = await c.request({ userActivation: false });
    assert.equal(r.code, "FULLSCREEN_USER_ACTIVATION_REQUIRED");
    assert.equal(calls.request, 0);
  }

  // FULLSCREEN-018 no playback mutation
  console.log("FULLSCREEN-018 no playback mutation");
  {
    resetRuntimeStateStoreForTests();
    updateRuntimeState({
      isPlaying: true,
      currentContentId: "c1",
      currentManifestVersion: 3,
    });
    const { api } = mockApi();
    const c = new FullscreenController({
      getTarget: () => targetEl(),
      api,
      capabilityFullscreen: true,
    });
    c.setResolvedPresentation("FULLSCREEN");
    await c.request({ userActivation: true, source: "user" });
    const s = getRuntimeState();
    assert.equal(s.isPlaying, true);
    assert.equal(s.currentContentId, "c1");
    assert.equal(s.currentManifestVersion, 3);
    assert.equal(s.fullscreenActive, true);
  }

  // FULLSCREEN-019 no token exposure
  console.log("FULLSCREEN-019 no tokens");
  {
    const { api } = mockApi();
    const c = new FullscreenController({
      getTarget: () => targetEl(),
      api,
      capabilityFullscreen: true,
    });
    c.setResolvedPresentation("FULLSCREEN");
    await c.request({ userActivation: true, source: "user" });
    assert.doesNotThrow(() =>
      assertNoAuthTokenExposure(
        c.snapshot() as unknown as Record<string, unknown>,
      ),
    );
    assert.doesNotThrow(() =>
      assertNoAuthTokenExposure(
        getRuntimeState() as unknown as Record<string, unknown>,
      ),
    );
  }

  // FULLSCREEN-020 no automatic retry loop
  console.log("FULLSCREEN-020 no retry loop");
  {
    let attempts = 0;
    const { api } = mockApi({
      requestImpl: async () => {
        attempts += 1;
        const err = new Error("denied");
        err.name = "NotAllowedError";
        throw err;
      },
    });
    const c = new FullscreenController({
      getTarget: () => targetEl(),
      api,
      capabilityFullscreen: true,
    });
    c.setResolvedPresentation("FULLSCREEN");
    await c.request({ userActivation: true, source: "user" });
    await c.request({ userActivation: false, source: "boot" });
    await c.request({ userActivation: false, source: "boot" });
    assert.equal(attempts, 1);
  }

  // PRESENTATION_NOT_ACTUALLY_FULLSCREEN reason message
  {
    const d = diagnosePolicyVsActual({
      resolvedPresentation: "FULLSCREEN",
      resolvedOrientation: "AUTO",
      fullscreenActive: false,
      orientationActual: "UNKNOWN",
      fullscreenReason: "user activation is required",
    });
    assert.ok(
      d.some((x) =>
        x.message.includes("because user activation is required"),
      ),
    );
  }

  console.log("RUNTIME-POLICY-08A PASS");
}

main().catch((e) => {
  console.error("RUNTIME-POLICY-08A FAIL", e);
  process.exit(1);
});

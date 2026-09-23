/**
 * RUNTIME-POLICY-06/08A/08B — Ephemeral Runtime State store (SSoT, in-memory).
 * Fullscreen/orientation control fields updated by their controllers.
 * Store itself never calls requestFullscreen / orientation.lock.
 */

import {
  INITIAL_RUNTIME_STATE,
  assertNoAuthTokenExposure,
  type RuntimeStateContract,
} from "@/domain/runtime-policy";

export const RUNTIME_STATE_GLOBAL_KEY = "__v360_runtime_state";
export const RUNTIME_STATE_UPDATED_EVENT = "v360-runtime-state-updated";

export type RuntimeStateListener = (state: RuntimeStateContract) => void;

export type RuntimeStateStore = {
  get: () => RuntimeStateContract;
  update: (partial: Partial<RuntimeStateContract>) => RuntimeStateContract;
  reset: () => RuntimeStateContract;
  subscribe: (listener: RuntimeStateListener) => () => void;
};

function nowMs(): number {
  return Date.now();
}

export function createRuntimeStateStore(
  initial?: Partial<RuntimeStateContract>,
): RuntimeStateStore {
  let state: RuntimeStateContract = {
    ...INITIAL_RUNTIME_STATE,
    ...initial,
    updatedAt: nowMs(),
  };
  const listeners = new Set<RuntimeStateListener>();

  const notify = () => {
    for (const l of listeners) {
      try {
        l(state);
      } catch {
        /* listener errors must not break store */
      }
    }
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(
          new CustomEvent(RUNTIME_STATE_UPDATED_EVENT, { detail: state }),
        );
      } catch {
        /* ignore */
      }
    }
  };

  return {
    get: () => ({ ...state }),
    update: (partial) => {
      state = {
        ...state,
        ...partial,
        updatedAt: nowMs(),
      };
      assertNoAuthTokenExposure(state as unknown as Record<string, unknown>);
      notify();
      return { ...state };
    },
    reset: () => {
      state = { ...INITIAL_RUNTIME_STATE, updatedAt: nowMs() };
      notify();
      return { ...state };
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Process-wide singleton for the Player Runtime (browser). */
let singleton: RuntimeStateStore | null = null;

export function getRuntimeStateStore(): RuntimeStateStore {
  if (!singleton) {
    singleton = createRuntimeStateStore();
  }
  return singleton;
}

/** Test helper — replace singleton between cases. */
export function resetRuntimeStateStoreForTests(): RuntimeStateStore {
  singleton = createRuntimeStateStore();
  return singleton;
}

export function getRuntimeState(): RuntimeStateContract {
  return getRuntimeStateStore().get();
}

export function updateRuntimeState(
  partial: Partial<RuntimeStateContract>,
): RuntimeStateContract {
  return getRuntimeStateStore().update(partial);
}

export function resetRuntimeState(): RuntimeStateContract {
  return getRuntimeStateStore().reset();
}

export function subscribeRuntimeState(
  listener: RuntimeStateListener,
): () => void {
  return getRuntimeStateStore().subscribe(listener);
}

/** Heartbeat-safe subset (no secrets / no Error objects). */
export function runtimeStateForHeartbeat(
  state: RuntimeStateContract = getRuntimeState(),
): Record<string, unknown> {
  return {
    isPlaying: state.isPlaying,
    currentContentId: state.currentContentId,
    currentManifestVersion: state.currentManifestVersion,
    syncState: state.syncState,
    networkState: state.networkState,
    cursorVisible: state.cursorVisible,
    fullscreenActive: state.fullscreenActive,
    fullscreenStatus: state.fullscreenStatus,
    fullscreenDiagnosticCode: state.fullscreenDiagnosticCode,
    orientationActual: state.orientationActual,
    orientationStatus: state.orientationStatus,
    orientationDiagnosticCode: state.orientationDiagnosticCode,
    lastInputAt: state.lastInputAt,
    lastInputClass: state.lastInputClass,
  };
}

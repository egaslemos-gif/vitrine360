/**
 * RUNTIME-POLICY-02 — Cursor contract unit tests (CURSOR-001 … 013)
 * Run: npm run test:cursor-02
 */
import assert from "node:assert/strict";
import {
  CursorIdleController,
  CURSOR_CANONICAL_TARGET,
  type CursorIdleHooks,
} from "../src/player/runtime/cursor-idle";
import {
  CURSOR_IDLE_MS,
  classifyInputEvent,
} from "../src/domain/runtime-policy";

type FakeEl = { style: { cursor: string } };

function createHarness(policy: "HIDDEN" | "AUTO_HIDE" | "VISIBLE" = "AUTO_HIDE") {
  const target: FakeEl = { style: { cursor: "" } };
  const listeners = new Map<string, Set<EventListener>>();
  let nextTimerId = 1;
  const timers = new Map<number, { fn: () => void; ms: number }>();

  const hooks: CursorIdleHooks = {
    getTarget: () => target,
    addEventListener: (type, listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener: (type, listener) => {
      listeners.get(type)?.delete(listener);
    },
    setTimeout: (fn, ms) => {
      const id = nextTimerId++;
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimeout: (id) => {
      timers.delete(id);
    },
    hasPointerEvents: true,
  };

  const ctrl = new CursorIdleController(policy, CURSOR_IDLE_MS, hooks);

  function fire(type: string) {
    const set = listeners.get(type);
    if (!set) return;
    for (const l of set) {
      l({ type } as unknown as Event);
    }
  }

  function advance(ms: number) {
    // Fire timers whose delay <= ms (single-shot model used by controller)
    for (const [id, t] of [...timers.entries()]) {
      if (t.ms <= ms) {
        timers.delete(id);
        t.fn();
      }
    }
  }

  function listenerCount() {
    let n = 0;
    for (const set of listeners.values()) n += set.size;
    return n;
  }

  function activeTimers() {
    return timers.size;
  }

  return { ctrl, target, fire, advance, listenerCount, activeTimers, listeners };
}

function main() {
  console.log("RUNTIME-POLICY-02 cursor contract");
  assert.equal(CURSOR_CANONICAL_TARGET, "documentElement");
  assert.equal(CURSOR_IDLE_MS, 3000);

  // CURSOR-001 Initial hidden (AUTO_HIDE)
  console.log("CURSOR-001 initial hidden");
  {
    const h = createHarness("AUTO_HIDE");
    h.ctrl.start();
    assert.equal(h.target.style.cursor, "none");
    assert.equal(h.ctrl.snapshot().visible, false);
  }

  // CURSOR-002 Input shows cursor
  console.log("CURSOR-002 input shows");
  {
    const h = createHarness();
    h.ctrl.start();
    h.fire("pointermove");
    assert.equal(h.target.style.cursor, "auto");
    assert.equal(h.ctrl.snapshot().visible, true);
  }

  // CURSOR-003 Timeout hides after 3000ms
  console.log("CURSOR-003 timeout hides");
  {
    const h = createHarness();
    h.ctrl.start();
    h.fire("pointerdown");
    assert.equal(h.target.style.cursor, "auto");
    h.advance(3000);
    assert.equal(h.target.style.cursor, "none");
    assert.equal(h.ctrl.snapshot().visible, false);
  }

  // CURSOR-004 Repeated input resets timer
  console.log("CURSOR-004 reset timer");
  {
    const h = createHarness();
    h.ctrl.start();
    h.fire("pointermove");
    assert.equal(h.activeTimers(), 1);
    h.fire("pointermove");
    assert.equal(h.activeTimers(), 1, "single timer after reset");
    h.advance(3000);
    assert.equal(h.target.style.cursor, "none");
  }

  // CURSOR-005 No multiple timers
  console.log("CURSOR-005 no multiple timers");
  {
    const h = createHarness();
    h.ctrl.start();
    h.fire("keydown");
    h.fire("touchstart");
    h.fire("pointermove");
    assert.equal(h.activeTimers(), 1);
  }

  // CURSOR-006 Cleanup removes listeners
  console.log("CURSOR-006 cleanup listeners");
  {
    const h = createHarness();
    h.ctrl.start();
    assert.ok(h.listenerCount() > 0);
    h.ctrl.dispose();
    assert.equal(h.listenerCount(), 0);
  }

  // CURSOR-007 Unmount clears timer
  console.log("CURSOR-007 unmount clears timer");
  {
    const h = createHarness();
    h.ctrl.start();
    h.fire("pointermove");
    assert.equal(h.activeTimers(), 1);
    h.ctrl.dispose();
    assert.equal(h.activeTimers(), 0);
  }

  // CURSOR-008 Keyboard KEYBOARD_LIKE
  console.log("CURSOR-008 keyboard KEYBOARD_LIKE");
  {
    assert.equal(classifyInputEvent("keydown"), "KEYBOARD_LIKE");
    const h = createHarness();
    h.ctrl.start();
    h.fire("keydown");
    assert.equal(h.ctrl.snapshot().lastInputClass, "KEYBOARD_LIKE");
  }

  // CURSOR-009 Touch shows cursor
  console.log("CURSOR-009 touch");
  {
    const h = createHarness();
    h.ctrl.start();
    h.fire("touchstart");
    assert.equal(h.target.style.cursor, "auto");
    assert.equal(h.ctrl.snapshot().lastInputClass, "TOUCH");
  }

  // CURSOR-010 Pointer shows cursor
  console.log("CURSOR-010 pointer");
  {
    const h = createHarness();
    h.ctrl.start();
    h.fire("pointerdown");
    assert.equal(h.target.style.cursor, "auto");
    assert.equal(h.ctrl.snapshot().lastInputClass, "MOUSE");
  }

  // CURSOR-011 Policy HIDDEN stays hidden
  console.log("CURSOR-011 HIDDEN");
  {
    const h = createHarness("HIDDEN");
    h.ctrl.start();
    assert.equal(h.target.style.cursor, "none");
    h.fire("pointermove");
    assert.equal(h.target.style.cursor, "none");
    assert.equal(h.activeTimers(), 0);
  }

  // CURSOR-012 Policy VISIBLE stays visible
  console.log("CURSOR-012 VISIBLE");
  {
    const h = createHarness("VISIBLE");
    h.ctrl.start();
    assert.equal(h.target.style.cursor, "auto");
    h.fire("pointermove");
    assert.equal(h.target.style.cursor, "auto");
    assert.equal(h.activeTimers(), 0);
  }

  // CURSOR-013 AUTO_HIDE follows contract
  console.log("CURSOR-013 AUTO_HIDE contract");
  {
    const h = createHarness("AUTO_HIDE");
    h.ctrl.start();
    assert.equal(h.target.style.cursor, "none");
    h.fire("mousedown"); // not attached when hasPointerEvents — use pointer
    h.fire("pointermove");
    assert.equal(h.target.style.cursor, "auto");
    h.advance(2999);
    // our fake advance fires timers with ms <= elapsed; 3000 not fired yet if we only advance 2999
    // with simple model timers fire if t.ms <= ms, so 3000 > 2999 → still visible
    assert.equal(h.target.style.cursor, "auto");
    h.advance(3000);
    assert.equal(h.target.style.cursor, "none");
  }

  console.log("PASS RUNTIME-POLICY-02 cursor");
}

main();

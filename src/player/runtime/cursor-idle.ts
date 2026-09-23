/**
 * RUNTIME-POLICY-02 — Cursor idle controller (AUTO_HIDE contract).
 *
 * Canonical paint target: document.documentElement (see docs/RUNTIME-POLICY-02-CURSOR.md).
 * Pure timer/listener logic; injectable for unit tests.
 */

import {
  CURSOR_IDLE_MS,
  classifyInputEvent,
  type CursorPolicy,
  type InputClass,
} from "@/domain/runtime-policy";

export const CURSOR_CANONICAL_TARGET = "documentElement" as const;

export type CursorIdleHooks = {
  getTarget: () => { style: { cursor: string } };
  addEventListener: (
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions | boolean,
  ) => void;
  removeEventListener: (
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions | boolean,
  ) => void;
  setTimeout: (fn: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
  /** Prefer Pointer Events when true (skip redundant mouse listeners). */
  hasPointerEvents?: boolean;
  /** Observability — Runtime State mirrors visibility (no second timer). */
  onVisibilityChange?: (visible: boolean) => void;
  /** Observability — classified input without inventing REMOTE. */
  onInputClass?: (inputClass: InputClass, at: number) => void;
};

export type CursorIdleSnapshot = {
  visible: boolean;
  timerActive: boolean;
  lastInputClass: InputClass | null;
  showCount: number;
  hideCount: number;
};

function defaultHooks(): CursorIdleHooks {
  return {
    getTarget: () => document.documentElement,
    addEventListener: (type, listener, options) =>
      window.addEventListener(type, listener, options),
    removeEventListener: (type, listener, options) =>
      window.removeEventListener(type, listener, options),
    setTimeout: (fn, ms) => window.setTimeout(fn, ms) as unknown as number,
    clearTimeout: (id) => window.clearTimeout(id),
    hasPointerEvents: typeof window !== "undefined" && "PointerEvent" in window,
  };
}

export class CursorIdleController {
  private readonly policy: CursorPolicy;
  private readonly idleMs: number;
  private readonly hooks: CursorIdleHooks;
  private timerId: number | null = null;
  private attached = false;
  private visible = false;
  private lastInputClass: InputClass | null = null;
  private showCount = 0;
  private hideCount = 0;
  private readonly onInput: EventListener;

  constructor(
    policy: CursorPolicy = "AUTO_HIDE",
    idleMs: number = CURSOR_IDLE_MS,
    hooks?: Partial<CursorIdleHooks>,
  ) {
    this.policy = policy;
    this.idleMs = idleMs;
    this.hooks = { ...defaultHooks(), ...hooks };
    this.onInput = (ev: Event) => {
      this.handleInput(ev.type);
    };
  }

  /** Start: apply initial policy + attach listeners (idempotent). */
  start(): void {
    this.applyInitial();
    this.attach();
  }

  /** Stop: clear single timer + remove listeners. */
  dispose(): void {
    this.clearTimer();
    this.detach();
  }

  snapshot(): CursorIdleSnapshot {
    return {
      visible: this.visible,
      timerActive: this.timerId != null,
      lastInputClass: this.lastInputClass,
      showCount: this.showCount,
      hideCount: this.hideCount,
    };
  }

  /** Test/helper: simulate input without a DOM Event. */
  handleInput(eventType: string): void {
    this.lastInputClass = classifyInputEvent(eventType);
    this.hooks.onInputClass?.(this.lastInputClass, Date.now());

    if (this.policy === "HIDDEN") {
      this.hide();
      return;
    }
    if (this.policy === "VISIBLE") {
      this.show();
      this.clearTimer();
      return;
    }

    // AUTO_HIDE
    this.show();
    this.resetTimer();
  }

  private applyInitial(): void {
    if (this.policy === "VISIBLE") {
      this.show();
    } else {
      this.hide();
    }
  }

  private show(): void {
    this.hooks.getTarget().style.cursor = "auto";
    if (!this.visible) this.showCount += 1;
    this.visible = true;
    this.hooks.onVisibilityChange?.(true);
  }

  private hide(): void {
    this.hooks.getTarget().style.cursor = "none";
    if (this.visible) this.hideCount += 1;
    this.visible = false;
    this.hooks.onVisibilityChange?.(false);
  }

  private clearTimer(): void {
    if (this.timerId != null) {
      this.hooks.clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private resetTimer(): void {
    this.clearTimer();
    this.timerId = this.hooks.setTimeout(() => {
      this.timerId = null;
      this.hide();
    }, this.idleMs);
  }

  private eventTypes(): string[] {
    const types: string[] = ["touchstart", "keydown"];
    if (this.hooks.hasPointerEvents) {
      types.push("pointermove", "pointerdown");
    } else {
      types.push("mousemove", "mousedown");
    }
    return types;
  }

  private attach(): void {
    if (this.attached) return;
    for (const type of this.eventTypes()) {
      this.hooks.addEventListener(type, this.onInput, { passive: true });
    }
    this.attached = true;
  }

  private detach(): void {
    if (!this.attached) return;
    for (const type of this.eventTypes()) {
      this.hooks.removeEventListener(type, this.onInput, { passive: true });
    }
    this.attached = false;
  }
}

/** Browser helper: read computed cursor on canonical target. */
export function readCanonicalCursor(): string {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement).cursor;
}

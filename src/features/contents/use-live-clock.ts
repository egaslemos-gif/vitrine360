"use client";

import { useEffect, useState } from "react";

/**
 * Live device/local clock for CLOCK content (admin preview + React player).
 * Source of truth: Date.now() / local Date — no network.
 */
export function useLiveClock(showSeconds: boolean): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      if (!cancelled) setNow(new Date());
    };

    tick();

    if (showSeconds) {
      intervalId = setInterval(tick, 1000);
    } else {
      const msUntilNextMinute = 60_000 - (Date.now() % 60_000) + 25;
      timeoutId = setTimeout(() => {
        tick();
        intervalId = setInterval(tick, 60_000);
      }, msUntilNextMinute);
    }

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [showSeconds]);

  return now;
}

export function clockShowSeconds(payload: Record<string, unknown>): boolean {
  return payload.showSeconds === true;
}

export function clockStyle(
  payload: Record<string, unknown>,
): "digital" | "analog" {
  return payload.style === "analog" ? "analog" : "digital";
}

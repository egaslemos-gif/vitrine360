"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/** True only after hydration — safe for createPortal without setState-in-effect. */
export function useIsClient(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

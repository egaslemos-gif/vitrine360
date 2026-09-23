/**
 * Player Runtime — Passive (MVP).
 *
 * Architecture allows a future Interactive Runtime without rewriting pairing/sync.
 * This module is the explicit boundary; do not assume "Player === slideshow only"
 * outside Passive-specific UI code.
 */

import {
  PLAYER_RUNTIME,
  type DisplayType,
  type InteractionMode,
  type PlayerRuntimeKind,
} from "@/domain/types";

export const ACTIVE_PLAYER_RUNTIME: PlayerRuntimeKind = PLAYER_RUNTIME;

export const DEFAULT_DISPLAY_TYPE: DisplayType = "TV";
export const DEFAULT_INTERACTION_MODE: InteractionMode = "PASSIVE";

export type RuntimeCapabilities = {
  runtime: PlayerRuntimeKind;
  autoplay: boolean;
  schedules: boolean;
  offlineSync: boolean;
  touchNavigation: boolean;
  interactiveSearch: boolean;
};

export function getPassiveRuntimeCapabilities(): RuntimeCapabilities {
  return {
    runtime: "PASSIVE",
    autoplay: true,
    schedules: true,
    offlineSync: true,
    touchNavigation: false,
    interactiveSearch: false,
  };
}

/** Placeholder for future Interactive Runtime — must not be wired in MVP UI. */
export function getInteractiveRuntimeCapabilities(): RuntimeCapabilities {
  return {
    runtime: "INTERACTIVE",
    autoplay: false,
    schedules: true,
    offlineSync: true,
    touchNavigation: true,
    interactiveSearch: true,
  };
}

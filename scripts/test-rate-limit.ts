/**
 * Rate-limit unit checks (in-memory fixed window).
 */
import assert from "node:assert/strict";
import { clearRateLimitBuckets, rateLimit } from "../src/lib/rate-limit";
import {
  ACTIVE_PLAYER_RUNTIME,
  getPassiveRuntimeCapabilities,
  getInteractiveRuntimeCapabilities,
} from "../src/player/runtime/passive";
import { DISPLAY_TYPES, INTERACTION_MODES } from "../src/domain/types";

clearRateLimitBuckets();
const a = rateLimit({ key: "t:1", limit: 2, windowMs: 60_000, now: 1000 });
assert.equal(a.allowed, true);
const b = rateLimit({ key: "t:1", limit: 2, windowMs: 60_000, now: 1001 });
assert.equal(b.allowed, true);
const c = rateLimit({ key: "t:1", limit: 2, windowMs: 60_000, now: 1002 });
assert.equal(c.allowed, false);
assert.ok(c.retryAfterSec >= 1);
// Window reset
const d = rateLimit({ key: "t:1", limit: 2, windowMs: 60_000, now: 70_000 });
assert.equal(d.allowed, true);

assert.equal(ACTIVE_PLAYER_RUNTIME, "PASSIVE");
assert.equal(getPassiveRuntimeCapabilities().touchNavigation, false);
assert.equal(getInteractiveRuntimeCapabilities().touchNavigation, true);
assert.ok(DISPLAY_TYPES.includes("TV"));
assert.ok(INTERACTION_MODES.includes("PASSIVE"));

console.log("rate-limit + runtime tests passed");

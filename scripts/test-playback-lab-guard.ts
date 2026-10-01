/**
 * Playback Lab guard — env matrix + static contract checks.
 * Run: npm run test:playback-lab-guard
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isPlaybackLabEnabled } from "../src/lib/playback-lab-guard";

// A. production configuration → blocked
assert.equal(isPlaybackLabEnabled({ NODE_ENV: "production" }), false);
assert.equal(isPlaybackLabEnabled({ NODE_ENV: "production", PLAYBACK_LAB_ENABLED: "false" }), false);
assert.equal(isPlaybackLabEnabled({ NODE_ENV: "production", PLAYBACK_LAB_ENABLED: "" }), false);
assert.equal(isPlaybackLabEnabled({ NODE_ENV: "production", PLAYBACK_LAB_ENABLED: "TRUE" }), false);
assert.equal(isPlaybackLabEnabled({ NODE_ENV: "production", PLAYBACK_LAB_ENABLED: "1" }), false);

// B. staging/preview configuration → available
assert.equal(isPlaybackLabEnabled({ NODE_ENV: "production", PLAYBACK_LAB_ENABLED: "true" }), true);

// Development / test unchanged
assert.equal(isPlaybackLabEnabled({ NODE_ENV: "development" }), true);
assert.equal(isPlaybackLabEnabled({ NODE_ENV: "test" }), true);

// Contract: flag is server-only, layout uses the guard, page has no hardcoded block.
const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
assert.ok(read("src/app/player/lab/layout.tsx").includes("isPlaybackLabEnabled"));
assert.ok(!read("src/app/player/lab/page.tsx").includes("NODE_ENV"));
assert.ok(!read("src/lib/playback-lab-guard.ts").includes("NEXT_PUBLIC_PLAYBACK_LAB"));

console.log("playback-lab-guard: PASS");

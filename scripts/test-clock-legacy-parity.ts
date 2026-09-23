/**
 * CLOCK RUNTIME PARITY — Legacy tv.js Analog + Digital contracts.
 * Included by test-content-templates-01; also: npx tsx scripts/test-clock-legacy-parity.ts
 *
 * CLOCK-LEGACY-001 … 016
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Same formula as React LiveClockSlide / tv.js clockHandAngles. */
export function clockHandAngles(h24: number, m: number, s: number) {
  const h = h24 % 12;
  return {
    hour: h * 30 + m * 0.5,
    minute: m * 6 + s * 0.1,
    second: s * 6,
  };
}

export function runClockLegacyParityTests() {
  console.log("CLOCK-LEGACY PARITY");
  const root = process.cwd();
  const tv = readFileSync(join(root, "public/tv.js"), "utf8");
  const reactEng = readFileSync(
    join(root, "src/player/playback/display-engine.tsx"),
    "utf8",
  );
  const reactVis = readFileSync(
    join(root, "src/features/contents/content-visual.tsx"),
    "utf8",
  );
  const liveSrc = readFileSync(
    join(root, "src/features/contents/use-live-clock.ts"),
    "utf8",
  );

  const clockBlock = tv.slice(
    tv.indexOf("function clearClockTimer"),
    tv.indexOf("function renderNoContent"),
  );

  // CLOCK-LEGACY-001 — Analog DOM exists
  assert.ok(tv.includes("renderAnalogClockFace"), "CLOCK-LEGACY-001 analog renderer");
  assert.ok(tv.includes("clock-analog"), "CLOCK-LEGACY-001 analog DOM class");
  assert.ok(tv.includes("clock-analog-face"), "CLOCK-LEGACY-001 face");

  // CLOCK-LEGACY-002 — Hour hand
  assert.ok(tv.includes("v360-hour-hand"), "CLOCK-LEGACY-002 hour hand");

  // CLOCK-LEGACY-003 — Minute hand
  assert.ok(tv.includes("v360-minute-hand"), "CLOCK-LEGACY-003 minute hand");

  // CLOCK-LEGACY-004 — Second hand (when showSeconds)
  assert.ok(tv.includes("v360-second-hand"), "CLOCK-LEGACY-004 second hand");
  assert.ok(
    /showSeconds[\s\S]*?v360-second-hand/.test(clockBlock),
    "CLOCK-LEGACY-004 second hand gated by showSeconds",
  );

  // CLOCK-LEGACY-005 — 12:00 → 0°
  assert.equal(clockHandAngles(12, 0, 0).hour, 0, "CLOCK-LEGACY-005 12:00 hour 0°");
  assert.equal(clockHandAngles(0, 0, 0).hour, 0, "CLOCK-LEGACY-005 00:00 hour 0°");

  // CLOCK-LEGACY-006 — 03:00 → 90°
  assert.equal(clockHandAngles(3, 0, 0).hour, 90, "CLOCK-LEGACY-006 03:00 hour 90°");

  // CLOCK-LEGACY-007 — 06:00 → 180°
  assert.equal(clockHandAngles(6, 0, 0).hour, 180, "CLOCK-LEGACY-007 06:00 hour 180°");

  // CLOCK-LEGACY-008 — 09:00 → 270°
  assert.equal(clockHandAngles(9, 0, 0).hour, 270, "CLOCK-LEGACY-008 09:00 hour 270°");

  // CLOCK-LEGACY-009 — Hour hand follows minutes (10:30 → 315°)
  const at1030 = clockHandAngles(10, 30, 0);
  assert.ok(
    Math.abs(at1030.hour - 315) < 0.01,
    "CLOCK-LEGACY-009 hour follows minutes (10:30 → 315°)",
  );
  assert.equal(at1030.minute, 180, "CLOCK-LEGACY-009 minute at :30 → 180°");
  assert.ok(tv.includes("h * 30 + m * 0.5"), "CLOCK-LEGACY-009 formula in tv.js");
  assert.ok(reactEng.includes("h * 30 + m * 0.5"), "CLOCK-LEGACY-009 React engine");
  assert.ok(reactVis.includes("h * 30 + m * 0.5"), "CLOCK-LEGACY-009 React visual");

  // Second / minute fraction parity
  assert.equal(clockHandAngles(0, 0, 15).second, 90, "second :15 → 90°");
  assert.ok(tv.includes("m * 6 + s * 0.1"), "minute follows seconds");
  assert.ok(tv.includes("s * 6"), "second degrees");

  // CLOCK-LEGACY-010 — Timer cleanup helper
  assert.ok(tv.includes("function clearClockTimer"), "CLOCK-LEGACY-010 clearClockTimer");
  assert.ok(
    /clearInterval\(playState\.clockTimer\)/.test(tv),
    "CLOCK-LEGACY-010 clears interval",
  );

  // CLOCK-LEGACY-011 — CLOCK → VIDEO cleanup (advanceSlide clears before next)
  assert.ok(
    /function advanceSlide\(\)\s*\{[\s\S]*?clearClockTimer\(\)/.test(tv),
    "CLOCK-LEGACY-011 advanceSlide clears clock before next slide",
  );

  // CLOCK-LEGACY-012 — VIDEO → CLOCK initialization
  assert.ok(
    /function renderClock\([\s\S]*?clearClockTimer\(\)/.test(tv),
    "CLOCK-LEGACY-012 renderClock clears then arms",
  );
  assert.ok(
    /if \(type === "CLOCK"\)[\s\S]*?renderClock\(item\)/.test(tv),
    "CLOCK-LEGACY-012 CLOCK branch in renderSlide",
  );

  // CLOCK-LEGACY-013 — CLOCK → CLOCK no duplicate timers
  assert.ok(
    (tv.match(/playState\.clockTimer = setInterval/g) || []).length >= 2,
    "CLOCK-LEGACY-013 digital+analog assign clockTimer",
  );
  assert.ok(
    /function renderClock\([\s\S]*?clearClockTimer\(\)[\s\S]*?renderAnalogClockFace|renderDigitalClockFace/.test(
      tv,
    ),
    "CLOCK-LEGACY-013 clear before re-arm on CLOCK→CLOCK",
  );

  // CLOCK-LEGACY-014 — Offline (no network in clock path)
  assert.ok(clockBlock.includes("new Date()"), "CLOCK-LEGACY-014 uses Date");
  assert.ok(!clockBlock.includes("fetch("), "CLOCK-LEGACY-014 no fetch in clock");
  assert.ok(!liveSrc.includes("fetch("), "CLOCK-LEGACY-014 React hook offline");

  // CLOCK-LEGACY-015 — Timezone behaviour (preserve: device local Date; no browser TZ override API)
  assert.ok(
    !/toLocaleTimeString\([^)]*timeZone/.test(clockBlock),
    "CLOCK-LEGACY-015 no forced IANA TZ in legacy CLOCK",
  );
  assert.ok(
    !/toLocaleString\([^)]*timeZone/.test(clockBlock),
    "CLOCK-LEGACY-015 no forced IANA TZ string",
  );
  assert.ok(
    liveSrc.includes("Date.now()") || liveSrc.includes("new Date()"),
    "CLOCK-LEGACY-015 React same local Date source",
  );

  // CLOCK-LEGACY-016 — Playlist transition clears timer
  assert.ok(
    /function applyPlaylist\([\s\S]*?advanceSlide\(\)/.test(tv),
    "CLOCK-LEGACY-016 applyPlaylist → advanceSlide",
  );
  assert.ok(
    /function advanceSlide\(\)\s*\{[\s\S]*?clearClockTimer\(\)/.test(tv),
    "CLOCK-LEGACY-016 playlist transition clears clock",
  );

  // Digital renderer + in-place updates (no full setHtml per tick)
  assert.ok(tv.includes("renderDigitalClockFace"), "digital renderer");
  assert.ok(tv.includes("formatDigitalClockTime"), "digital format helper");
  assert.ok(
    tv.includes('getElementById("v360-clock-time")'),
    "digital updates time node in place",
  );
  assert.ok(tv.includes("showSeconds ? 1000 : 30000"), "tick cadence 1s / 30s");
  assert.ok(!/setInterval\([^,]+,\s*1[0-9]\b/.test(clockBlock), "no <20ms interval");

  // Style gate + fail-safe
  assert.ok(tv.includes('payload.style === "analog"'), "analog style gate");
  assert.ok(tv.includes("Fail-safe"), "fail-safe comment");
  assert.ok(
    /catch \(e\)[\s\S]*?renderDigitalClockFace/.test(tv),
    "fail-safe falls back to digital",
  );

  // Shell / SW cache-bust aligned with VERSION
  const html = readFileSync(join(root, "public/tv.html"), "utf8");
  const sw = readFileSync(join(root, "public/tv-sw.js"), "utf8");
  assert.ok(html.includes("tv.js?v=050"), "shell cache-bust v050");
  assert.ok(sw.includes("v050"), "service worker v050");
  assert.ok(tv.includes("0.1.22-smarttv-static"), "tv VERSION 0.1.22");

  // React cleanup
  assert.ok(liveSrc.includes("clearInterval"), "React timer cleanup");
  assert.ok(reactEng.includes("useLiveClock"), "React player live CLOCK");

  console.log("CLOCK-LEGACY PARITY PASS");
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  /test-clock-legacy-parity\.(ts|js|mjs|cjs)$/.test(
    process.argv[1].replace(/\\/g, "/"),
  );
if (isDirectRun) {
  runClockLegacyParityTests();
}

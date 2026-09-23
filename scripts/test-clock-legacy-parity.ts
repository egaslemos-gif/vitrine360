/**
 * CLOCK RUNTIME PARITY — Legacy tv.js Analog + Digital contracts.
 * Included by test-content-templates-01; also: npx tsx scripts/test-clock-legacy-parity.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Same formula as React LiveClockSlide / tv.js clockHandAngles. */
function clockHandAngles(h24: number, m: number, s: number) {
  const h = h24 % 12;
  return {
    hour: h * 30 + m * 0.5,
    minute: m * 6 + s * 0.1,
    second: s * 6,
  };
}

export function runClockLegacyParityTests() {
  console.log("CLOCK-LEGACY PARITY");
  const tv = readFileSync(join(process.cwd(), "public/tv.js"), "utf8");
  const reactEng = readFileSync(
    join(process.cwd(), "src/player/playback/display-engine.tsx"),
    "utf8",
  );
  const reactVis = readFileSync(
    join(process.cwd(), "src/features/contents/content-visual.tsx"),
    "utf8",
  );

  assert.ok(tv.includes("renderDigitalClockFace"), "CLOCK-LEGACY-001 digital renderer");
  assert.ok(tv.includes("showSeconds ? 1000 : 30000"), "CLOCK-LEGACY-001 digital interval");

  assert.ok(tv.includes("renderAnalogClockFace"), "CLOCK-LEGACY-002 analog renderer");
  assert.ok(tv.includes("clock-analog"), "CLOCK-LEGACY-002 analog DOM class");
  assert.ok(tv.includes("v360-hour-hand"), "CLOCK-LEGACY-002 hour hand");
  assert.ok(tv.includes("v360-minute-hand"), "CLOCK-LEGACY-002 minute hand");
  assert.ok(tv.includes("v360-second-hand"), "CLOCK-LEGACY-002 second hand");

  const at1030 = clockHandAngles(10, 30, 0);
  assert.ok(
    Math.abs(at1030.hour - 315) < 0.01,
    "CLOCK-LEGACY-003 hour follows minutes (10:30 → 315°)",
  );
  assert.equal(at1030.minute, 180, "CLOCK-LEGACY-004 minute hand at :30");
  const atSec = clockHandAngles(0, 0, 15);
  assert.equal(atSec.second, 90, "CLOCK-LEGACY-005 second hand at :15 → 90°");

  assert.ok(tv.includes("h * 30 + m * 0.5"), "CLOCK-LEGACY-003 formula in tv.js");
  assert.ok(tv.includes("m * 6 + s * 0.1"), "CLOCK-LEGACY-004 formula in tv.js");
  assert.ok(tv.includes("s * 6"), "CLOCK-LEGACY-005 formula in tv.js");
  assert.ok(reactEng.includes("h * 30 + m * 0.5"), "React engine same hour formula");
  assert.ok(reactVis.includes("h * 30 + m * 0.5"), "React visual same hour formula");

  const clockBlock = tv.slice(
    tv.indexOf("function clearClockTimer"),
    tv.indexOf("function renderNoContent"),
  );
  assert.ok(clockBlock.includes("new Date()"), "CLOCK-LEGACY-006 uses local Date");
  assert.ok(!clockBlock.includes("fetch("), "CLOCK-LEGACY-006 no fetch in clock");

  assert.ok(tv.includes("function clearClockTimer"), "CLOCK-LEGACY-007 clearClockTimer");
  assert.ok(
    /function advanceSlide\(\)\s*\{[\s\S]*?clearClockTimer\(\)/.test(tv),
    "CLOCK-LEGACY-007/009 advanceSlide clears clock timer",
  );

  assert.ok(
    /function renderClock\([\s\S]*?clearClockTimer\(\)/.test(tv),
    "CLOCK-LEGACY-008 renderClock clears before arming",
  );
  assert.ok(
    tv.includes("playState.clockTimer = setInterval"),
    "CLOCK-LEGACY-008 assigns single clockTimer",
  );

  assert.ok(
    tv.includes('payload.style === "analog"'),
    "CLOCK-LEGACY-010 analog style gate",
  );

  assert.ok(tv.includes("Fail-safe"), "CLOCK-LEGACY-012 fail-safe comment");
  assert.ok(
    /catch \(e\)[\s\S]*?renderDigitalClockFace/.test(tv),
    "CLOCK-LEGACY-012 falls back to digital",
  );

  const html = readFileSync(join(process.cwd(), "public/tv.html"), "utf8");
  const sw = readFileSync(join(process.cwd(), "public/tv-sw.js"), "utf8");
  assert.ok(html.includes("tv.js?v=049"), "shell cache-bust v049");
  assert.ok(sw.includes("v049"), "service worker v049");
  assert.ok(tv.includes("0.1.21-smarttv-static"), "tv VERSION bumped");

  assert.ok(!/setInterval\([^,]+,\s*1[0-9]\b/.test(clockBlock), "no <20ms interval");

  console.log("CLOCK-LEGACY PARITY PASS");
}

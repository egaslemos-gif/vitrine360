/**
 * RUNTIME-POLICY-04 — Live resolution capture
 *
 *   BASE_URL=http://127.0.0.1:3002 npm run test:runtime-policy-live
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import {
  resolvePlayerRuntimePolicy,
} from "../src/player/runtime/resolve-policy";
import type { CapabilityProbeResult } from "../src/player/runtime/capabilities";
import { UNKNOWN_CAPABILITIES } from "../src/domain/runtime-policy";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const EVIDENCE = path.resolve("docs/evidence/runtime-policy-04");

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const report: Record<string, unknown> = {
    date: new Date().toISOString(),
    base: BASE,
  };

  try {
    // SCENARIO A — live Chromium /player
    const page = await browser.newPage();
    await page.goto(`${BASE}/player`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    const snap = await page.evaluate(() => {
      return (
        window as unknown as {
          __v360_runtime_policy?: Record<string, unknown>;
        }
      ).__v360_runtime_policy;
    });
    assert.ok(snap, "runtime policy snapshot missing");
    assert.equal(snap.fullscreenApiCalled, false);
    assert.equal(snap.orientationLockCalled, false);
    assert.ok(snap.resolved);
    assert.ok(snap.requested);
    report.scenarioA = { label: "Chromium /player", snap };

    // SCENARIO B — simulated fragile environment (domain inputs only)
    const fragileProbe: CapabilityProbeResult = {
      capabilities: {
        ...UNKNOWN_CAPABILITIES,
        video: true,
        image: true,
        gif: true,
        fullscreen: true,
        orientation: false,
        network: true,
        keyboard: true,
        pointer: true,
      },
      environment: {
        userAgent: "Mozilla/5.0 Hisense VIDAA Sraf simulated",
        fragileSmartTv: true,
        secureContext: true,
        language: "pt",
      },
      probedAt: new Date().toISOString(),
      ok: true,
      error: null,
    };
    const fragile = resolvePlayerRuntimePolicy({
      device: {
        tenantId: "local",
        deviceId: "sim-fragile",
        displayType: "TV",
        interactionMode: "PASSIVE",
        orientationStored: "landscape",
        hasDevicePolicy: true,
      },
      policy: {
        presentation: "FULLSCREEN",
        cursor: "AUTO_HIDE",
        input: ["KEYBOARD_LIKE", "MOUSE", "TOUCH"],
        interaction: "PASSIVE",
        orientation: "LANDSCAPE",
      },
      probe: fragileProbe,
    });
    assert.equal(fragile.resolved.presentation, "WINDOWED");
    assert.ok(fragile.fallbacks.some((f) => f.field === "presentation"));
    report.scenarioB = {
      label: "Simulated fragileSmartTv",
      requested: fragile.requested,
      resolved: {
        presentation: fragile.resolved.presentation,
        cursor: fragile.resolved.cursor,
        orientation: fragile.resolved.orientation,
      },
      fallbacks: fragile.fallbacks,
      diagnostics: fragile.diagnostics,
      environment: fragile.environment,
    };

    report.verdict = "PASS";
    fs.writeFileSync(
      path.join(EVIDENCE, "RESOLUTION-E2E-RESULTS.md"),
      `# Runtime Policy Resolution E2E

**Date:** ${report.date}
**Base:** ${BASE}

## Scenario A — Chromium /player
\`\`\`json
${JSON.stringify(report.scenarioA, null, 2)}
\`\`\`

## Scenario B — Simulated fragile environment
\`\`\`json
${JSON.stringify(report.scenarioB, null, 2)}
\`\`\`

## Guarantees
- fullscreenApiCalled: false
- orientationLockCalled: false

## Verdict
**IMPLEMENTATION VALIDATED**
`,
      "utf8",
    );

    console.log("RUNTIME POLICY LIVE VALIDATION PASS");
    console.log(JSON.stringify(report, null, 2));
    await page.close();
  } catch (e) {
    report.verdict = "FAIL";
    report.error = e instanceof Error ? e.message : String(e);
    fs.writeFileSync(
      path.join(EVIDENCE, "RESOLUTION-E2E-RESULTS.md"),
      `# FAIL\n${report.error}\n`,
      "utf8",
    );
    throw e;
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("RUNTIME POLICY LIVE FAIL", e);
  process.exit(1);
});

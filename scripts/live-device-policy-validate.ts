/**
 * RUNTIME-POLICY-05 — Live Device → Policy enrichment
 *
 *   BASE_URL=http://127.0.0.1:3003 npm run test:device-policy-live
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { resolvePlayerRuntimePolicy } from "../src/player/runtime/resolve-policy";
import type { CapabilityProbeResult } from "../src/player/runtime/capabilities";
import { UNKNOWN_CAPABILITIES } from "../src/domain/runtime-policy";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const EVIDENCE = path.resolve("docs/evidence/runtime-policy-05");

const capsOk: CapabilityProbeResult = {
  capabilities: {
    ...UNKNOWN_CAPABILITIES,
    video: true,
    image: true,
    gif: true,
    fullscreen: true,
    orientation: true,
    network: true,
    keyboard: true,
    pointer: true,
  },
  environment: {
    userAgent: "live-device-policy",
    fragileSmartTv: false,
    secureContext: true,
    language: "pt",
  },
  probedAt: new Date().toISOString(),
  ok: true,
  error: null,
};

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const report: Record<string, unknown> = {
    date: new Date().toISOString(),
    base: BASE,
  };

  try {
    // Scenario A — TV + PASSIVE + LANDSCAPE via LocalConfig + event
    const page = await browser.newPage();
    await page.goto(`${BASE}/player`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      localStorage.setItem(
        "v360-player-config",
        JSON.stringify({
          deviceId: "e2e-device-a",
          deviceToken: "",
          tenantId: "e2e-tenant",
          displayType: "TV",
          interactionMode: "PASSIVE",
          orientation: "landscape",
          timezone: "Africa/Maputo",
          hasDevicePolicy: true,
        }),
      );
      window.dispatchEvent(new Event("v360-device-config-updated"));
    });
    await page.waitForTimeout(500);
    const snapA = await page.evaluate(() => {
      return (
        window as unknown as {
          __v360_runtime_policy?: Record<string, unknown>;
        }
      ).__v360_runtime_policy;
    });
    assert.ok(snapA, "policy snapshot missing (A)");
    const requestedA = snapA.requested as {
      presentation: string;
      cursor: string;
      interaction: string;
      orientation: string;
    };
    assert.equal(requestedA.presentation, "AUTO");
    assert.equal(requestedA.cursor, "AUTO_HIDE");
    assert.equal(requestedA.interaction, "PASSIVE");
    assert.equal(requestedA.orientation, "LANDSCAPE");
    assert.equal(snapA.policySource, "DEVICE_CONFIG");
    assert.equal(snapA.fullscreenApiCalled, false);
    assert.equal(snapA.orientationLockCalled, false);
    assert.ok(!JSON.stringify(snapA).includes("Africa/Maputo"));
    report.scenarioA = { label: "TV+PASSIVE+LANDSCAPE", snap: snapA };
    await page.close();

    // Scenario B — TOUCH_DISPLAY + TOUCH (diagnostic, no Interactive Runtime)
    const touch = resolvePlayerRuntimePolicy({
      device: {
        tenantId: "e2e-tenant",
        deviceId: "e2e-device-b",
        displayType: "TOUCH_DISPLAY",
        interactionMode: "TOUCH",
        orientationStored: "landscape",
        hasDevicePolicy: true,
      },
      probe: capsOk,
    });
    assert.equal(touch.requested.interaction, "INTERACTIVE");
    assert.ok(
      touch.diagnostics.some((d) => d.includes("INTERACTIVE_NOT_IMPLEMENTED")),
    );
    assert.equal(touch.policySource, "DEVICE_CONFIG");
    report.scenarioB = {
      label: "TOUCH_DISPLAY + TOUCH",
      requested: touch.requested,
      resolved: {
        interaction: touch.resolved.interaction,
        presentation: touch.resolved.presentation,
      },
      diagnostics: touch.diagnostics,
      interactiveRuntimeStarted: false,
    };

    // Scenario C — PORTRAIT requested
    const pageC = await browser.newPage();
    await pageC.goto(`${BASE}/player`, { waitUntil: "domcontentloaded" });
    await pageC.waitForTimeout(800);
    await pageC.evaluate(() => {
      localStorage.setItem(
        "v360-player-config",
        JSON.stringify({
          deviceId: "e2e-device-c",
          deviceToken: "",
          tenantId: "e2e-tenant",
          displayType: "TABLET",
          interactionMode: "PASSIVE",
          orientation: "portrait",
          hasDevicePolicy: true,
        }),
      );
      window.dispatchEvent(new Event("v360-device-config-updated"));
    });
    await pageC.waitForTimeout(500);
    const snapC = await pageC.evaluate(() => {
      return (
        window as unknown as {
          __v360_runtime_policy?: Record<string, unknown>;
        }
      ).__v360_runtime_policy;
    });
    assert.ok(snapC);
    const requestedC = snapC.requested as { orientation: string };
    assert.equal(requestedC.orientation, "PORTRAIT");
    assert.equal(snapC.orientationLockCalled, false);
    report.scenarioC = { label: "PORTRAIT", snap: snapC };
    await pageC.close();

    report.verdict = "PASS";
    fs.writeFileSync(
      path.join(EVIDENCE, "DEVICE-POLICY-E2E-RESULTS.md"),
      `# Device Policy Enrichment E2E

**Date:** ${report.date}
**Base:** ${BASE}

## Scenario A — TV + PASSIVE + LANDSCAPE
\`\`\`json
${JSON.stringify(report.scenarioA, null, 2)}
\`\`\`

## Scenario B — TOUCH_DISPLAY (Interactive Runtime NOT started)
\`\`\`json
${JSON.stringify(report.scenarioB, null, 2)}
\`\`\`

## Scenario C — PORTRAIT
\`\`\`json
${JSON.stringify(report.scenarioC, null, 2)}
\`\`\`

## Guarantees
- fullscreenApiCalled: false
- orientationLockCalled: false
- timezone not in policy snapshot

## Verdict
**IMPLEMENTATION VALIDATED**
`,
      "utf8",
    );

    console.log("DEVICE POLICY LIVE VALIDATION PASS");
    console.log(JSON.stringify(report, null, 2));
  } catch (e) {
    report.verdict = "FAIL";
    report.error = e instanceof Error ? e.message : String(e);
    fs.writeFileSync(
      path.join(EVIDENCE, "DEVICE-POLICY-E2E-RESULTS.md"),
      `# FAIL\n${report.error}\n`,
      "utf8",
    );
    throw e;
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("DEVICE POLICY LIVE FAIL", e);
  process.exit(1);
});
